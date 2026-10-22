import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { BuildingMap } from "@/features/maison/components/building-map";
import { ROOMS } from "@/features/maison/rooms";
import { roomPreviews } from "@/features/maison/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "La maison" };

async function House() {
  const user = await requireUser();
  const previews = await roomPreviews(user.id);
  return (
    <>
      <BuildingMap previews={previews} />
      <Card className="gap-1">
        <CardTitle>Toutes les pièces</CardTitle>
        <p className="text-sm text-muted-foreground">Le même accès, sans passer par la carte.</p>
        <ul className="grid grid-cols-1 gap-x-6 md:grid-cols-2" aria-label="Pièces de la maison">
          {ROOMS.map((r) => (
            <li key={r.key} className="border-b">
              {r.href ? (
                <Link href={r.href} className="flex min-h-14 items-center gap-3 py-2 hover:bg-muted/60">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b>{r.name}</b>
                    <span className="text-sm text-muted-foreground">{previews[r.key]}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="flex min-h-14 items-center gap-3 py-2 text-muted-foreground"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b>{r.name}</b>
                    <span className="text-sm">{r.comingSoon}</span>
                  </span>
                  <Lock aria-hidden="true" className="size-4" />
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export default function HousePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumb="creative & strategic kitchen"
        title="La maison"
        description="Chaque pièce est un vrai espace de travail. La carte est une porte d'entrée, jamais un passage obligé."
      />
      <Suspense fallback={<PageLoading />}>
        <House />
      </Suspense>
    </div>
  );
}
