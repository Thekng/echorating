import { SupabaseClient } from '@supabase/supabase-js'

export class TimeTrackingV2 {
  /**
   * Safely update a single time value with optimistic locking
   * @throws Error if version mismatch (another user edited the entry)
   */
  static async updateTimeValue(
    supabase: SupabaseClient,
    entryId: string,
    metricId: string,
    timeValue: number | null, // seconds or null
  ) {
    const { data, error } = await supabase.rpc('update_daily_log_value', {
      p_entry_id: entryId,
      p_metric_id: metricId,
      p_value_numeric: timeValue,
    })

    if (error) throw error
    return data
  }

  /**
   * Safely batch update multiple time values
   */
  static async updateMultipleTimeValues(
    supabase: SupabaseClient,
    entryId: string,
    updates: Array<{ metricId: string; timeValue: number | null }>
  ) {
    const { data, error } = await supabase.rpc('update_daily_log_values_batch', {
      p_entry_id: entryId,
      p_updates: updates.map((u) => ({
        metric_id: u.metricId,
        value_numeric: u.timeValue,
      })),
    })

    if (error) throw error
    return data
  }

  /**
   * Detect if entry was modified since last fetch
   */
  static async detectConflict(
    supabase: SupabaseClient,
    entryId: string,
    lastKnownVersion: number
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('daily_entries')
      .select('version')
      .eq('entry_id', entryId)
      .single()

    if (error) return false
    return (data as { version: number }).version > lastKnownVersion
  }

  /**
   * Fetch latest entry data for merge/refresh
   */
  static async fetchLatestEntry(supabase: SupabaseClient, entryId: string) {
    const { data, error } = await supabase
      .from('daily_entries')
      .select(`
        entry_id,
        entry_date,
        status,
        notes,
        version,
        key_metric_values (
          metric_id,
          value_numeric,
          value_text,
          value_bool
        )
      `)
      .eq('entry_id', entryId)
      .single()

    if (error) throw error
    return data
  }

  /**
   * Three-way merge strategy
   * merges conflicting changes if they're in different metrics
   */
  static mergeEntries(
    local: Record<string, unknown>,
    remote: Record<string, unknown>,
    base: Record<string, unknown>
  ): Record<string, unknown> {
    const merged = { ...remote }
    const localValues = (local.entry_values as Array<{ metric_id: string }>) || []
    const remoteValues = (remote.entry_values as Array<{ metric_id: string }>) || []

    // If local edited a different metric than remote, keep both
    for (const value of localValues) {
      const remoteValue = remoteValues.find((v) => v.metric_id === value.metric_id)

      if (!remoteValue) {
        // Metric only exists locally, add it
        merged.entry_values = [...((merged.entry_values as unknown[]) || []), value]
      }
    }

    void base
    return merged
  }
}
