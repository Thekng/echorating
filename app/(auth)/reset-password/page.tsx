import Link from 'next/link'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export default function ResetPasswordPage() {
  return (
    <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
      <p className="mt-1 text-sm text-muted-foreground">We will email you reset instructions.</p>

      <div className="mt-6">
        <ResetPasswordForm />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Remembered your password?{' '}
        <Link href="/login" className="underline underline-offset-4">
          Login
        </Link>
      </p>
    </section>
  )
}
