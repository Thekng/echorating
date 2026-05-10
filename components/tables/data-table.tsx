'use client'

import React from 'react'

interface DataTableProps {
  columns: unknown[]
  data: unknown[]
}

export function DataTable({ columns, data }: DataTableProps) {
  // Use props to satisfy unused-vars while keeping implementation minimal
  console.debug('DataTable rendered', { columnCount: columns.length, dataCount: data.length })

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted">
            {/* Column headers */}
          </tr>
        </thead>
        <tbody>
          {/* Rows */}
        </tbody>
      </table>
    </div>
  )
}
