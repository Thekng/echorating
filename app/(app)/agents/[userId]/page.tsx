export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Agent Profile</h1>
      <p>User ID: {userId}</p>
      {/* Agent profile tabs here */}
    </div>
  )
}
