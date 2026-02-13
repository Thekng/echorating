import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(ROUTES.DASHBOARD)
  }

  redirect(ROUTES.LOGIN)
}
