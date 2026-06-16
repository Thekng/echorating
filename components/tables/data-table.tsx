'use client'

import React from 'react'

interface DataTableProps {
  _columns: unknown[]
  _data: unknown[]
}

export function DataTable({ _columns, _data }: DataTableProps) {
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
