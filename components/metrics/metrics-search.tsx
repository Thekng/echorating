'use client'

import { useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { getMetricIcon } from '@/lib/utils/metric-helpers'

interface Metric {
  metric_id: string
  name: string
  code: string
  data_type?: string
  unit?: string
}

interface MetricsSearchProps {
  metrics: Metric[]
  onSelect?: (metric: Metric) => void
  onSearch?: (query: string) => void
  placeholder?: string
}

export function MetricsSearch({ 
  metrics, 
  onSelect, 
  onSearch,
  placeholder = 'Search metrics by name or code...'
}: MetricsSearchProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filtered = metrics.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.code.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = useCallback((metric: Metric) => {
    setQuery('')
    setIsOpen(false)
    onSelect?.(metric)
  }, [onSelect])

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          aria-label="Search metrics"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            const val = e.target.value
            setQuery(val)
            setIsOpen(true)
            onSearch?.(val)
          }}
          onFocus={() => setIsOpen(true)}
          className="h-10 w-full pl-10 pr-10 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setIsOpen(false)
              onSearch?.('')
            }}
            aria-label="Clear search"
            className="absolute right-3 p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-md border bg-popover shadow-md z-50 max-h-64 overflow-y-auto">
          {filtered.map((metric) => (
            <button
              key={metric.metric_id}
              type="button"
              onClick={() => handleSelect(metric)}
              className="w-full px-4 py-3 text-left hover:bg-muted flex items-center gap-3 border-b last:border-b-0 transition-colors focus-visible:outline-none focus-visible:bg-muted"
            >
              <span className="text-lg">{getMetricIcon(metric.code)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{metric.name}</p>
                <p className="text-xs text-muted-foreground truncate">{metric.code}</p>
              </div>
              {metric.unit && <span className="text-xs text-muted-foreground">{metric.unit}</span>}
            </button>
          ))}
        </div>
      )}

      {isOpen && query && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-md border bg-popover shadow-md z-50 p-4">
          <p className="text-sm text-muted-foreground" role="status">No metrics found</p>
        </div>
      )}
    </div>
  )
}
