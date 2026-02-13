import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-8">
      <section className="w-full max-w-2xl rounded-xl border bg-card p-8 text-card-foreground shadow-sm">
        <h1 className="mb-3 text-4xl font-semibold tracking-tight">EchoRating</h1>
        <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
          Base com Next.js, Tailwind e shadcn/ui pronta para evoluir o produto.
        </p>
        <div className="flex gap-3">
          <Button>Comecar</Button>
          <Button variant="outline">Ver documentacao</Button>
        </div>
      </section>
    </main>
  );
}
