import { CompanyOnboardingForm } from '@/components/onboarding/company-form'

export default function CompanyOnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-6 md:p-10">
      <section className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Create company</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete this step to unlock your workspace.
        </p>

        <div className="mt-6">
          <CompanyOnboardingForm />
        </div>
      </section>
    </main>
  )
}
