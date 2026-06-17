/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React from 'react'

export function DataTable({ _columns, _data }: { _columns: any[]; _data: any[] }) {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const columns = _columns
  const data = _data
  /* eslint-enable @typescript-eslint/no-unused-vars */
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
