'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Department = {
  department_id: string
  name: string
}

type DepartmentPickerProps = {
  departments: Department[]
  value?: string
  onChange?: (departmentId: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
  required?: boolean
}

export function DepartmentPicker({
  departments,
  value,
  onChange,
  onBlur,
  placeholder = 'Select a department',
  disabled = false,
  className,
  required = false,
}: DepartmentPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedDept = departments.find((d) => d.department_id === value)
  const filtered = departments.filter((dept) => dept.name.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      inputRef.current?.focus()
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled || departments.length === 0}
        onBlur={onBlur}
        className={cn(
          'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex items-center justify-between',
          'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className={selectedDept ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedDept?.name || placeholder}
        </span>
        <ChevronDown className={cn('size-4 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="absolute top-full z-[9999] w-full mt-1 rounded-md border border-input bg-background shadow-lg">
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search departments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full rounded px-2 text-sm border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete="off"
            />
          </div>
          <div className="max-h-48 overflow-y-auto border-t border-input">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No departments found</div>
            ) : (
              filtered.map((dept) => (
                <button
                  key={dept.department_id}
                  type="button"
                  onClick={() => {
                    onChange?.(dept.department_id)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-accent hover:text-accent-foreground',
                    value === dept.department_id && 'bg-accent text-accent-foreground',
                  )}
                >
                  <span>{dept.name}</span>
                  {value === dept.department_id && <Check className="size-4" />}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {required && <input type="hidden" name="departmentId" value={value || ''} />}
    </div>
  )
}
