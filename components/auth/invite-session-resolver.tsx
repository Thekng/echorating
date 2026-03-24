'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ERROR_MESSAGE = 'This invite link is invalid or has expired. Please ask to be invited again.'

export function InviteSessionResolver() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('Checking your invite link...')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function resolveSession() {
      const code = searchParams.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setFailed(true)
          setMessage(ERROR_MESSAGE)
          return
        }
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error || !user) {
        setFailed(true)
        setMessage(ERROR_MESSAGE)
        return
      }

      router.replace(pathname)
      router.refresh()
    }

    void resolveSession()
  }, [pathname, router, searchParams])

  return (
    <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{failed ? 'Invite unavailable' : 'Checking invite'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </section>
  )
}
