import Link from 'next/link'
import { SignupForm } from '@/components/auth/signup-form'

export default function SignupPage() {
  return (
    <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Sign up</h1>
      <p className="mt-1 text-sm text-muted-foreground">Create your account to start onboarding.</p>

      <div className="mt-6">
        <SignupForm />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="underline underline-offset-4">
          Login
        </Link>
      </p>
    </section>
  )
}
