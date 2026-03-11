import Link from 'next/link'

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const params = await searchParams
  const email = params.email

  return (
    <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Verifique o seu email para cadastrar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Criamos a sua conta com sucesso. Para continuar, abra a sua caixa de entrada e clique no link de verificação.
      </p>

      {email ? (
        <p className="mt-4 rounded-md border bg-background p-3 text-sm">
          Email de verificação enviado para <strong>{email}</strong>.
        </p>
      ) : null}

      <p className="mt-4 text-sm text-muted-foreground">
        Após verificar, retorne para o{' '}
        <Link href="/login" className="underline underline-offset-4">
          login
        </Link>
        .
      </p>
    </section>
  )
}
