import React from 'react'

interface PageShellProps {
  title: string
  description?: string
  children: React.ReactNode
}

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && <p className="text-muted-foreground mt-2">{description}</p>}
      </div>
      {children}
    </div>
  )
}
