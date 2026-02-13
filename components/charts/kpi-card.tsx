interface KPICardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
}

export function KPICard({ title, value, change, changeType }: KPICardProps) {
  return (
    <div className="p-4 border rounded-lg bg-card">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {change && (
        <p className={`text-xs mt-2 ${changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
          {change}
        </p>
      )}
    </div>
  )
}
