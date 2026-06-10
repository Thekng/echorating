import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { ROUTES } from '@/lib/constants/routes'
import { type Role, hasPermission, isRole } from '@/lib/rbac/roles'

const protectedRoutes = [
  ROUTES.DASHBOARD,
  ROUTES.SETTINGS,
  ROUTES.DAILY_LOG,
  ROUTES.LEADERBOARD,
  ROUTES.ONBOARDING,
  ROUTES.SELECT_ORGANIZATION,
]

const appRoutes = [
  ROUTES.DASHBOARD,
  ROUTES.SETTINGS,
  ROUTES.DAILY_LOG,
  ROUTES.LEADERBOARD,
]

const onboardingRoutes = [ROUTES.ONBOARDING]

const authRoutes = [ROUTES.LOGIN, ROUTES.SIGNUP, ROUTES.RESET_PASSWORD, ROUTES.VERIFY_EMAIL]
const roleProtectedRoutes: Array<{ route: string; minRole: Role }> = [
  { route: ROUTES.SETTINGS, minRole: 'manager' },
]

function isRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function withResponseCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  const requestId = source.headers.get('x-request-id')
  if (requestId) {
    target.headers.set('x-request-id', requestId)
  }
  return target
}

function redirectToLogin(request: NextRequest, response: NextResponse, reason?: string) {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = ROUTES.LOGIN
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  if (reason) {
    loginUrl.searchParams.set('error', reason)
  }
  return withResponseCookies(NextResponse.redirect(loginUrl), response)
}

export async function middleware(request: NextRequest) {
  const incomingRequestId = request.headers.get('x-request-id')
  const requestId = incomingRequestId && incomingRequestId.trim() !== ''
    ? incomingRequestId
    : crypto.randomUUID()

  // Propagate so server actions / route handlers can read it via headers().
  request.headers.set('x-request-id', requestId)

  let response = NextResponse.next({
    request,
  })
  response.headers.set('x-request-id', requestId)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

          response = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isProtectedRoute = protectedRoutes.some((route) => isRoute(pathname, route))
  const isAuthRoute = authRoutes.some((route) => isRoute(pathname, route))
  const isAppRoute = appRoutes.some((route) => isRoute(pathname, route))
  const isOnboardingRoute = onboardingRoutes.some((route) => isRoute(pathname, route))
  const roleRule = roleProtectedRoutes.find(({ route }) => isRoute(pathname, route))

  if (!user && isProtectedRoute) {
    return redirectToLogin(request, response, 'unauthenticated')
  }

  if (user && isAuthRoute) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = ROUTES.DASHBOARD
    dashboardUrl.search = ''
    return withResponseCookies(NextResponse.redirect(dashboardUrl), response)
  }

  if (user && (isAppRoute || isOnboardingRoute || Boolean(roleRule))) {
    const organizationId = typeof user.app_metadata?.active_organization_id === 'string'
      ? user.app_metadata.active_organization_id
      : null
    const role = isRole(user.app_metadata?.active_role)
      ? user.app_metadata.active_role
      : null
    const hasOrganization = Boolean(organizationId)

    if (isAppRoute && !hasOrganization) {
      const onboardingUrl = request.nextUrl.clone()
      onboardingUrl.pathname = ROUTES.ONBOARDING_COMPANY
      onboardingUrl.search = ''
      return withResponseCookies(NextResponse.redirect(onboardingUrl), response)
    }

    if (isOnboardingRoute && hasOrganization) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = ROUTES.DASHBOARD
      dashboardUrl.search = ''
      return withResponseCookies(NextResponse.redirect(dashboardUrl), response)
    }

    if (roleRule && (!role || !hasPermission(role, roleRule.minRole))) {
      const unauthorizedUrl = request.nextUrl.clone()
      unauthorizedUrl.pathname = ROUTES.UNAUTHORIZED
      unauthorizedUrl.search = ''
      return withResponseCookies(NextResponse.redirect(unauthorizedUrl), response)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
