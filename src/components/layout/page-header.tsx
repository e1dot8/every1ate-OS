export function PageHeader({
  crumb,
  title,
  description,
}: {
  crumb?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      {crumb ? <p className="font-annotation text-sm text-pen-strong">{crumb}</p> : null}
      <h1 className="text-3xl leading-tight font-bold tracking-tight md:text-4xl">{title}</h1>
      {description ? <p className="text-muted-foreground">{description}</p> : null}
    </header>
  );
}

export function PageLoading() {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      Chargement…
    </p>
  );
}
