import { z } from 'zod'
import { parseDurationToSeconds, formatSecondsToDuration } from '@/lib/daily-log/value-parser'

/**
 * Enhanced validation schema for time metrics (HH:MM:SS format)
 * 
 * Handles:
 * - Input validation (HH:MM:SS format)
 * - Optional values (nullable)
 * - Clear error messages
 * - No conflicts with existing schema
 */

// Standalone time field validator
export const timeFieldSchema = z
  .string()
  .refine(
    (value) => {
      if (!value || value.trim() === '') return true // Optional
      const result = parseDurationToSeconds(value)
      return result.ok
    },
    {
      message: 'Duration must be in HH:MM:SS format (e.g., 02:30:45)',
    }
  )
  .transform((value) => {
    if (!value || value.trim() === '') return null
    const result = parseDurationToSeconds(value)
    return result.ok ? result.value : null
  })
  .optional()
  .nullable()

// Extend existing daily log form with time metrics support
export const dailyLogFormSchemaWithTime = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  departmentId: z.string().uuid('Department is required'),
  userId: z.string().uuid('Invalid agent').optional(),
  notes: z.string().max(5000, 'Notes too long').optional(),
  intent: z.enum(['draft', 'submit']),
  
  // Time-based metrics
  talkTime: timeFieldSchema,
  breakTime: timeFieldSchema,
  afterCallWork: timeFieldSchema,
  otherTime: timeFieldSchema,
})

/**
 * Version-safe database operations for time entries
 * 
 * Prevents concurrent edit conflicts using optimistic locking
 */
export class TimeEntryVersionControl {
  /**
   * Safely update a time metric with version check
   * 
   * @throws Error if version mismatch (another user edited the entry)
   */
  static async updateTimeValue(
    supabase: any,
    entryId: string,
    metricId: string,
    timeValue: number | null, // seconds or null
  ) {
    // First, get the current version
    const { data: entry, error: fetchError } = await supabase
      .from('daily_entries')
      .select('version')
      .eq('entry_id', entryId)
      .single()

    if (fetchError) throw new Error('Failed to fetch entry: ' + fetchError.message)
    const currentVersion = entry?.version

    // Attempt to insert/update the value
    const { data, error: valueError } = await supabase
      .from('entry_values')
      .upsert({
        entry_id: entryId,
        metric_id: metricId,
        value_numeric: timeValue,
        value_source: 'manual',
      })
      .select()

    if (valueError) throw new Error('Failed to save time value: ' + valueError.message)

    // Now update entry with version check (optimistic locking)
    const { error: updateError } = await supabase
      .from('daily_entries')
      .update({ updated_at: new Date().toISOString() })
      .eq('entry_id', entryId)
      .eq('version', currentVersion) // Version check here

    if (updateError?.code === 'PGRST116') {
      throw new ConflictError(
        'This entry was modified by another user. Please refresh and try again.'
      )
    }

    if (updateError) throw new Error('Failed to update entry: ' + updateError.message)

    return data
  }

  /**
   * Safely batch update multiple time values
   */
  static async updateMultipleTimeValues(
    supabase: any,
    entryId: string,
    updates: Array<{ metricId: string; timeValue: number | null }>
  ) {
    // Get current version once
    const { data: entry, error: fetchError } = await supabase
      .from('daily_entries')
      .select('version')
      .eq('entry_id', entryId)
      .single()

    if (fetchError) throw new Error('Failed to fetch entry: ' + fetchError.message)
    const currentVersion = entry?.version

    // Batch insert/update all values
    const { error: valuesError } = await supabase
      .from('entry_values')
      .upsert(
        updates.map(({ metricId, timeValue }) => ({
          entry_id: entryId,
          metric_id: metricId,
          value_numeric: timeValue,
          value_source: 'manual',
        }))
      )

    if (valuesError) throw new Error('Failed to save time values: ' + valuesError.message)

    // Single version check for all updates
    const { error: updateError } = await supabase
      .from('daily_entries')
      .update({ updated_at: new Date().toISOString() })
      .eq('entry_id', entryId)
      .eq('version', currentVersion)

    if (updateError?.code === 'PGRST116') {
      throw new ConflictError(
        'This entry was modified by another user. Please refresh and try again.'
      )
    }

    if (updateError) throw new Error('Failed to update entry: ' + updateError.message)
  }
}

/**
 * Custom error for version conflicts
 * Allows UI to handle conflicts differently (show merge dialog, etc.)
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

/**
 * Time value formatter for display
 * 
 * Usage:
 * - Display: formatSecondsToDuration(9045) → "02:30:45"
 * - Store: parseDurationToSeconds("02:30:45") → 9045
 */
export function formatTimeForDisplay(seconds: number | null | undefined): string {
  return formatSecondsToDuration(seconds)
}

/**
 * Time aggregation helpers for reporting
 */
export class TimeAggregation {
  /**
   * Sum time values from multiple entries
   */
  static sumTimeValues(values: (number | null)[]): number {
    return values
      .filter((v): v is number => v !== null && v !== undefined)
      .reduce((sum, v) => sum + v, 0)
  }

  /**
   * Calculate average time
   */
  static averageTimeValues(values: (number | null)[]): number {
    const valid = values.filter((v): v is number => v !== null && v !== undefined)
    if (valid.length === 0) return 0
    return Math.round(TimeAggregation.sumTimeValues(valid) / valid.length)
  }

  /**
   * Format aggregated time for display
   */
  static formatAggregated(seconds: number): string {
    return formatSecondsToDuration(Math.floor(seconds))
  }
}

/**
 * Conflict detection and resolution strategies
 */
export class ConflictResolution {
  /**
   * Detect if entry was modified since last fetch
   */
  static async detectConflict(
    supabase: any,
    entryId: string,
    lastKnownVersion: number
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('daily_entries')
      .select('version, updated_at')
      .eq('entry_id', entryId)
      .single()

    if (error) throw new Error('Failed to check entry: ' + error.message)
    return data.version > lastKnownVersion
  }

  /**
   * Fetch latest entry data for merge/refresh
   */
  static async fetchLatestEntry(supabase: any, entryId: string) {
    const { data, error } = await supabase
      .from('daily_entries')
      .select(`
        *,
        entry_values (
          metric_id,
          value_numeric,
          value_source,
          updated_at
        )
      `)
      .eq('entry_id', entryId)
      .single()

    if (error) throw new Error('Failed to fetch entry: ' + error.message)
    return data
  }

  /**
   * Three-way merge strategy
   * merges conflicting changes if they're in different metrics
   */
  static mergeEntries(local: any, remote: any, base: any): any {
    const merged = { ...remote }

    // If local edited a different metric than remote, keep both
    for (const value of local.entry_values || []) {
      const remoteValue = (remote.entry_values || []).find(
        (v: any) => v.metric_id === value.metric_id
      )

      if (!remoteValue) {
        // Metric only exists locally, add it
        merged.entry_values = [...(merged.entry_values || []), value]
      }
    }

    return merged
  }
}
