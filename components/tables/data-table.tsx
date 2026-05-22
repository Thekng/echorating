'use client'

import React from 'react'

interface DataTableProps {
  columns: unknown[]
  data: unknown[]
}

export function DataTable({ _columns, _data }: { _columns: unknown[]; _data: unknown[] }) {
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
