'use server'

export async function listMetrics() {
  try {
    // TODO: Fetch metrics from database
    return { success: true, data: [] }
  } catch (error) {
    return { success: false, error: 'Failed to fetch metrics' }
  }
}

export async function getMetricById(id: string) {
  try {
    // TODO: Fetch metric details
    return { success: true, data: {} }
  } catch (error) {
    return { success: false, error: 'Failed to fetch metric' }
  }
}
