'use client'

import React from 'react'

interface DataTableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]
}

export function DataTable({}: DataTableProps) {
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
