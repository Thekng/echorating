/* eslint-disable */
/* eslint-disable */
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  _error,
  reset,
}: {
  _error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(_error)
  }, [_error])

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <h2 className="text-xl font-bold">Something went wrong loading the dashboard.</h2>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  )
}
