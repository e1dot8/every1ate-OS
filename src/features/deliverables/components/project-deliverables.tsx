import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { EmptyLine, Section } from "@/components/notion/blocks";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { todayDate } from "@/lib/dates";
import { STAGES, stageLabels } from "@/features/deliverables/rules";
import { projectDeliverables } from "@/features/deliverables/service";
import { DeliverableLine } from "@/features/deliverables/components/views";

/** Onglet « Livrables » d'un projet : livrables groupés par étape. */
export async function ProjectDeliverables({ projectId, archived }: { projectId: string; archived: boolean }) {
  await connection();
  const items = await projectDeliverables(projectId);
  const today = todayDate();
  const groups = STAGES.map((stage) => ({ stage, items: items.filter((d) => d.stage === stage) })).filter(
    (g) => g.items.length,
  );
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length
            ? `${items.length} livrable${items.length > 1 ? "s" : ""}, de la préparation à la livraison.`
            : "Vidéos, posts, visuels… suivis étape par étape avec leur checklist."}
        </p>
        {!archived ? (
          <Button asChild size="sm">
            <Link href={`/livrables/nouveau?projet=${projectId}`}>
              <Plus aria-hidden="true" /> Nouveau livrable
            </Link>
          </Button>
        ) : null}
      </div>
      {groups.length ? (
        groups.map((g) => (
          <Section
            key={g.stage}
            id={`livrables-${g.stage.toLowerCase()}`}
            title={stageLabels[g.stage]}
            count={g.items.length}
          >
            <ul aria-label={`Livrables en ${stageLabels[g.stage]}`} className="flex flex-col">
              {g.items.map((d) => (
                <DeliverableLine key={d.id} d={d} today={today} />
              ))}
            </ul>
          </Section>
        ))
      ) : (
        <EmptyLine>Aucun livrable pour ce projet.</EmptyLine>
      )}
      {items.length ? (
        <TextLink href={`/livrables?projet=${projectId}`} className="w-fit">
          Ouvrir dans la base Livrables
        </TextLink>
      ) : null}
    </div>
  );
}
