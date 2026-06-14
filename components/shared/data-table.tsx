import React from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DataTableProps {
  children: React.ReactNode
  className?: string
}

interface DataTableHeaderProps {
  children: React.ReactNode
  className?: string
}

interface DataTableRowProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

interface DataTableCellProps {
  children: React.ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
}

export function DataTable({ children, className }: DataTableProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </Card>
  )
}

export function DataTableHeader({ children, className }: DataTableHeaderProps) {
  return (
    <thead>
      <tr
        className={cn(
          'border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground',
          className,
        )}
      >
        {children}
      </tr>
    </thead>
  )
}

export function DataTableRow({ children, className, onClick }: DataTableRowProps) {
  return (
    <tr
      className={cn(
        'border-b last:border-0 transition-colors hover:bg-muted/30',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function DataTableCell({ children, className, align = 'left' }: DataTableCellProps) {
  return (
    <td
      className={cn(
        'px-4 py-3 whitespace-nowrap',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className,
      )}
    >
      {children}
    </td>
  )
}

export function DataTableHeaderCell({
  children,
  className,
  align = 'left',
}: DataTableCellProps) {
  return (
    <th
      className={cn(
        'px-4 py-3 whitespace-nowrap font-medium',
        align === 'center' && 'text-center',
        align === 'right' && 'text-right',
        className,
      )}
    >
      {children}
    </th>
  )
}
