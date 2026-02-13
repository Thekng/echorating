import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'

export default function SettingsPage() {
  redirect(ROUTES.SETTINGS_DEPARTMENTS)
}
