'use client'

import React from 'react'

interface DataTableProps {
  columns: Record<string, unknown>[]
  data: Record<string, unknown>[]
}

export function DataTable({ columns: _1, data: _2 }: DataTableProps) {
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
