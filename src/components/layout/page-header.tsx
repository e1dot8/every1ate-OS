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
    <header className="flex flex-col gap-1.5 px-1">
      {crumb ? (
        <p className="text-[11px] font-bold tracking-[0.24em] text-ink/60 uppercase">{crumb}</p>
      ) : null}
      <h1 className="text-4xl leading-none font-bold tracking-[-0.04em] md:text-5xl">{title}</h1>
      {description ? <p className="max-w-2xl text-[15px] text-ink/65">{description}</p> : null}
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
