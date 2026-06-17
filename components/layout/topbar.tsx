'use client'

import { UserMenu } from './user-menu'

type TopbarProps = {
  userName?: string | null
  userEmail?: string | null
  companyName?: string | null
}

export function Topbar({ userName, userEmail, companyName }: TopbarProps) {
  return (
    <div className="flex h-16 items-center justify-between px-4 md:px-8">
      <div />
      <div className="flex items-center gap-4">
        <UserMenu userName={userName} userEmail={userEmail} companyName={companyName} />
      </div>
    </div>
  )
}
