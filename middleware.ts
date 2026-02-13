import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { ROUTES } from '@/lib/constants/routes'
import { type Role, hasPermission, isRole } from '@/lib/rbac/roles'
import { createAdminClient } from '@/lib/supabase/admin'

const protectedRoutes = [
  ROUTES.DASHBOARD,
  ROUTES.SETTINGS,
  ROUTES.AGENTS,
  ROUTES.DAILY_LOG,
  ROUTES.LEADERBOARD,
  ROUTES.ONBOARDING,
]

const appRoutes = [
  ROUTES.DASHBOARD,
  ROUTES.SETTINGS,
  ROUTES.AGENTS,
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
  let response = NextResponse.next({
    request,
  })

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
    let profile: {
      company_id: string | null
      role: string | null
      is_active: boolean | null
      deleted_at: string | null
    } | null = null

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient()
      const { data: adminProfile, error: adminProfileError } = await admin
        .from('profiles')
        .select('company_id, role, is_active, deleted_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (adminProfileError) {
        return redirectToLogin(request, response, 'profile_lookup')
      }

      profile = adminProfile
    } else {
      const { data: userScopedProfile, error: userScopedProfileError } = await supabase
        .from('profiles')
        .select('company_id, role, is_active, deleted_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (userScopedProfileError) {
        return redirectToLogin(request, response, 'profile_lookup')
      }

      profile = userScopedProfile
    }

    const hasCompany =
      Boolean(profile?.company_id) && profile?.is_active !== false && profile?.deleted_at === null
    const role = isRole(profile?.role) ? profile.role : null

    if (isAppRoute && !hasCompany) {
      const onboardingUrl = request.nextUrl.clone()
      onboardingUrl.pathname = ROUTES.ONBOARDING_COMPANY
      onboardingUrl.search = ''
      return withResponseCookies(NextResponse.redirect(onboardingUrl), response)
    }

    if (isOnboardingRoute && hasCompany) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = ROUTES.DASHBOARD
      dashboardUrl.search = ''
      return withResponseCookies(NextResponse.redirect(dashboardUrl), response)
    }

    if (roleRule && (!role || !hasPermission(role, roleRule.minRole))) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = ROUTES.DASHBOARD
      dashboardUrl.search = ''
      return withResponseCookies(NextResponse.redirect(dashboardUrl), response)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
