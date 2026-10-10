import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, Search } from "lucide-react";
import { BackLink, EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listCrmClients } from "@/features/crm/service";
import { requireUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Entreprises" };

async function Clients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const clients = await listCrmClients(sp.q?.trim() || undefined);
  return (
    <>
      <form
        role="search"
        action="/crm/clients"
        className="flex min-h-tap items-center gap-2 rounded-lg border border-input px-3"
      >
        <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={sp.q}
          aria-label="Rechercher une entreprise"
          placeholder="Rechercher une entreprise"
          className="border-0 px-0 focus-visible:outline-none"
        />
      </form>
      {clients.length ? (
        <Card className="gap-0 py-1">
          <ul>
            {clients.map((c) => (
              <li key={c.id} className="flex min-h-14 items-center gap-3 border-b py-3 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/crm/clients/${c.id}`} className="font-bold hover:underline">
                    {c.name}
                  </Link>
                  <span className="text-[13px] text-muted-foreground">
                    {[
                      c.sector,
                      `${c._count.contacts} contact${c._count.contacts > 1 ? "s" : ""}`,
                      `${c._count.projects} projet${c._count.projects > 1 ? "s" : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                {c.openOpps ? (
                  <span className="text-right text-sm">
                    <b>{formatMoney(c.openAmount, { round: true })}</b>
                    <span className="block text-xs text-muted-foreground">{c.openOpps} en cours</span>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Aucune entreprise." />
      )}
    </>
  );
}

export default function ClientsPage({ searchParams }: PageProps<"/crm/clients">) {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/crm">CRM</BackLink>
      <div className="flex items-end justify-between gap-3">
        <PageHeader title="Entreprises" description="Clients et prospects, contacts et historique." />
        <Button asChild>
          <Link href="/crm/clients/nouveau">
            <Plus aria-hidden="true" /> Entreprise
          </Link>
        </Button>
      </div>
      <Suspense fallback={<PageLoading />}>
        <Clients searchParams={searchParams as Promise<{ q?: string }>} />
      </Suspense>
    </div>
  );
}
