import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams

  return (
    <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
      <p className="mt-1 text-sm text-muted-foreground">Use your account to access EchoRating.</p>

      <div className="mt-6">
        <LoginForm nextPath={params.next} />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        No account?{' '}
        <Link href="/signup" className="underline underline-offset-4">
          Create one
        </Link>
      </p>
    </section>
  )
}
