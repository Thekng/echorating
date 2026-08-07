'use client'

import { useState, useCallback, useId } from 'react'
import { Search, X } from 'lucide-react'
import { getMetricIcon } from '@/lib/utils/metric-helpers'
import { cn } from '@/lib/utils'

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
  const [activeIndex, setActiveIndex] = useState(-1)
  const id = useId()
  const listboxId = `${id}-listbox`

  const filtered = metrics.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.code.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = useCallback((metric: Metric) => {
    setQuery('')
    setIsOpen(false)
    setActiveIndex(-1)
    onSelect?.(metric)
  }, [onSelect])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filtered.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        if (activeIndex >= 0) {
          e.preventDefault()
          handleSelect(filtered[activeIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setActiveIndex(-1)
        break
    }
  }

  return (
    <div className="relative">
      <div
        className="relative flex items-center"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-owns={listboxId}
        aria-controls={listboxId}
      >
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={placeholder}
          aria-label="Search metrics"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-10 w-full pl-10 pr-10 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setIsOpen(false)
              setActiveIndex(-1)
            }}
            aria-label="Clear search"
            className="absolute right-3 p-1 hover:bg-muted rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 rounded-md border bg-popover shadow-md z-50 max-h-64 overflow-y-auto"
        >
          {filtered.map((metric, index) => (
            <button
              key={metric.metric_id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              onClick={() => handleSelect(metric)}
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-muted flex items-center gap-3 border-b last:border-b-0 transition-colors",
                activeIndex === index && "bg-muted"
              )}
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
          <p className="text-sm text-muted-foreground">No metrics found</p>
        </div>
      )}
    </div>
  )
}
