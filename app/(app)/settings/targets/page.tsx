import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'

export default function TargetsSettingsPage() {
  redirect(ROUTES.SETTINGS_METRICS)
}
