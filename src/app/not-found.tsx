import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6">
      <p className="font-annotation text-sm text-pen-strong">{"// 404"}</p>
      <h1 className="text-3xl font-bold tracking-tight">Page introuvable</h1>
      <p className="text-muted-foreground">Cette page n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
      <Link href="/" className="font-bold underline">
        Retour à Mon espace
      </Link>
    </main>
  );
}
