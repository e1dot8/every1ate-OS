import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarPlus, ExternalLink, Mail, Pencil, Phone, Plus } from "lucide-react";
import { BackLink, ProjectStatusBadge } from "@/components/app/bits";
import { PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { stageLabels } from "@/features/crm/rules";
import { getClient } from "@/features/crm/service";
import { DocumentsPanel } from "@/features/documents/components/documents-panel";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";
import { formatMoney, toCents } from "@/lib/money";

export const metadata: Metadata = { title: "Entreprise" };

async function ClientView({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  return (
    <>
      <BackLink href="/crm/clients">Entreprises</BackLink>
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl leading-tight font-bold tracking-tight md:text-4xl">{client.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[client.sector, client.address].filter(Boolean).join(" · ") || "—"}
          </p>
          {client.website ? (
            <a
              href={client.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-bold underline"
            >
              <ExternalLink aria-hidden="true" className="size-3.5" /> Site web
            </a>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/crm/clients/${id}/modifier`}>
              <Pencil aria-hidden="true" /> Modifier
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/calendrier/nouveau?client=${id}`}>
              <CalendarPlus aria-hidden="true" /> Réunion
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/crm/opportunites/nouvelle?client=${id}`}>
              <Plus aria-hidden="true" /> Opportunité
            </Link>
          </Button>
        </div>
      </header>
      {client.notes ? <p className="whitespace-pre-line text-sm">{client.notes}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3">
          <div className="flex items-center justify-between">
            <CardTitle>Contacts</CardTitle>
            <Link
              href={`/crm/clients/${id}/contacts/nouveau`}
              className="text-sm font-bold text-pen-strong hover:underline"
            >
              + Ajouter
            </Link>
          </div>
          <ul className="flex flex-col">
            {client.contacts.map((c) => (
              <li key={c.id} className="flex flex-col gap-0.5 border-b py-2.5 text-sm last:border-b-0">
                <Link href={`/crm/contacts/${c.id}`} className="font-bold hover:underline">
                  {c.firstName} {c.lastName}
                </Link>
                {c.role ? <span className="text-muted-foreground">{c.role}</span> : null}
                <span className="flex flex-wrap gap-x-3">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 underline">
                      <Mail aria-hidden="true" className="size-3.5" /> {c.email}
                    </a>
                  ) : null}
                  {c.phone ? (
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 underline">
                      <Phone aria-hidden="true" className="size-3.5" /> {c.phone}
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
            {!client.contacts.length ? (
              <li className="text-sm text-muted-foreground">Aucun contact.</li>
            ) : null}
          </ul>
        </Card>
        <Card className="gap-3">
          <CardTitle>Opportunités</CardTitle>
          <ul className="flex flex-col">
            {client.opportunities.map((o) => (
              <li key={o.id} className="flex items-center gap-2 border-b py-2.5 text-sm last:border-b-0">
                <Link href={`/crm/opportunites/${o.id}`} className="flex-1 font-bold hover:underline">
                  {o.title}
                </Link>
                <span className="text-muted-foreground">
                  {o.amount ? formatMoney(toCents(o.amount), { round: true }) : ""}
                </span>
                <StatusBadge
                  tone={o.stage === "GAGNE" ? "success" : o.stage === "PERDU" ? "danger" : "info"}
                  label={stageLabels[o.stage]}
                />
              </li>
            ))}
            {!client.opportunities.length ? (
              <li className="text-sm text-muted-foreground">Aucune opportunité.</li>
            ) : null}
          </ul>
        </Card>
        <Card className="gap-3 md:col-span-2">
          <CardTitle>Projets</CardTitle>
          <ul className="flex flex-col">
            {client.projects.map((p) => (
              <li key={p.id} className="flex items-center gap-2 border-b py-2.5 text-sm last:border-b-0">
                <Link href={`/projets/${p.id}`} className="flex-1 font-bold hover:underline">
                  {p.name}
                </Link>
                <ProjectStatusBadge status={p.status} />
              </li>
            ))}
            {!client.projects.length ? (
              <li className="text-sm text-muted-foreground">Aucun projet.</li>
            ) : null}
          </ul>
        </Card>
      </div>
      <DocumentsPanel target={{ clientId: id }} back={`/crm/clients/${id}`} />
      <p className="text-xs text-muted-foreground">Fiche créée le {formatDay(client.createdAt)}.</p>
    </>
  );
}

export default function ClientPage({ params }: PageProps<"/crm/clients/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <ClientView params={params} />
      </Suspense>
    </div>
  );
}
