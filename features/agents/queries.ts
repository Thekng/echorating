'use server'

export async function getAgentsList() {
  try {
    // TODO: Fetch all agents
    return { success: true, data: [] }
  } catch (error) {
    return { success: false, error: 'Failed to fetch agents' }
  }
}

export async function getAgentProfile(userId: string) {
  try {
    // TODO: Fetch agent profile with stats
    return { success: true, data: {} }
  } catch (error) {
    return { success: false, error: 'Failed to fetch profile' }
  }
}
