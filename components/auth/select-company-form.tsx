'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ArrowRight } from 'lucide-react'

type Company = {
  company_id: string
  name: string
  role: string
}

export function SelectCompanyForm({ companies }: { companies: Company[] }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [,, setSelectedId] = useState<string | null>(null)

  const handleSelect = async (companyId: string) => {
    setIsPending(true)
    setSelectedId(companyId)
    router.push('/dashboard')
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {companies.map((company) => (
          <button
            key={company.company_id}
            onClick={() => handleSelect(company.company_id)}
            disabled={isPending}
            className="flex items-center justify-between rounded-lg border p-4 text-left hover:bg-muted/50 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <Building2 className="size-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{company.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{company.role}</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      {companies.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          That&apos;s strange. You don&apos;t seem to belong to any companies.
        </p>
      )}
    </div>
  )
}
