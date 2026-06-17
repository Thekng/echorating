'use client'

import Link from 'next/link'
import { LogOut, UserCircle } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOutAction } from '@/features/auth/actions'
import { ROUTES } from '@/lib/constants/routes'

type UserMenuProps = {
  userName?: string | null
  userEmail?: string | null
  companyName?: string | null
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function UserMenu({ userName, userEmail, companyName }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar size="sm">
            <AvatarFallback className="text-[10px]">{getInitials(userName)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[120px] truncate font-medium sm:inline">{userName || userEmail || 'User'}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {companyName && (
          <>
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">{companyName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href={ROUTES.ACCOUNT} className="flex items-center gap-2">
            <UserCircle className="size-4" />
            My Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer">
            <LogOut className="size-4" />
            Log out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
