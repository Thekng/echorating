export default function AgentProfilePage({
  params,
}: {
  params: { userId: string }
}) {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Agent Profile</h1>
      <p>User ID: {params.userId}</p>
      {/* Agent profile tabs here */}
    </div>
  )
}
