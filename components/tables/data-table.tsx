'use client'

import React from 'react'

interface DataTableProps<TData, TValue> {
  columns: TData[]
  data: TValue[]
}

export function DataTable<TData, TValue>({ columns: _columns, data: _data }: DataTableProps<TData, TValue>) {
  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {/* Column headers placeholder */}
          </tr>
        </thead>
        <tbody>
          {/* Rows placeholder */}
        </tbody>
      </table>
    </div>
  )
}
