import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'

export default function OnboardingPage() {
  redirect(ROUTES.ONBOARDING_COMPANY)
}
