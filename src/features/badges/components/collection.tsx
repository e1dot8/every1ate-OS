import { Award, Eye, EyeOff, Star } from "lucide-react";
import { badgeByKey, familyLabels } from "@/features/badges/catalog";
import { updateBadgeAction } from "@/app/(app)/progression/actions";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Owned = {
  id: string;
  badgeKey: string;
  reason: string;
  visible: boolean;
  favorite: boolean;
  createdAt: Date;
  givenBy: { name: string } | null;
};

function Toggle({
  id,
  field,
  value,
  label,
  children,
}: {
  id: string;
  field: string;
  value: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form action={updateBadgeAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={String(value)} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="inline-flex size-tap items-center justify-center rounded-full hover:bg-muted"
      >
        {children}
      </button>
    </form>
  );
}

/** Collection de badges : favoris en tête ; chacun peut être masqué à la brigade. */
export function BadgeCollection({ badges, editable }: { badges: Owned[]; editable: boolean }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {badges.map((b) => {
        const def = badgeByKey(b.badgeKey);
        if (!def) return null;
        return (
          <li
            key={b.id}
            className={cn("flex gap-3 rounded-xl border p-3", b.favorite && "border-2 border-ink")}
          >
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-highlight">
              <Award aria-hidden="true" className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-annotation text-xs text-pen-strong">{familyLabels[def.family]}</span>
              <b>{def.name}</b>
              <span className="text-sm text-muted-foreground">{b.reason}</span>
              <span className="text-xs text-muted-foreground">
                {formatDay(b.createdAt)}
                {b.givenBy ? ` · décerné par ${b.givenBy.name}` : ""}
                {!b.visible ? " · masqué à la brigade" : ""}
              </span>
            </span>
            {editable ? (
              <span className="flex flex-col">
                <Toggle
                  id={b.id}
                  field="favorite"
                  value={!b.favorite}
                  label={
                    b.favorite ? `Retirer « ${def.name} » des favoris` : `Mettre « ${def.name} » en favori`
                  }
                >
                  <Star aria-hidden="true" className={cn("size-4", b.favorite && "fill-ink")} />
                </Toggle>
                <Toggle
                  id={b.id}
                  field="visible"
                  value={!b.visible}
                  label={
                    b.visible
                      ? `Masquer « ${def.name} » à la brigade`
                      : `Montrer « ${def.name} » à la brigade`
                  }
                >
                  {b.visible ? (
                    <Eye aria-hidden="true" className="size-4" />
                  ) : (
                    <EyeOff aria-hidden="true" className="size-4" />
                  )}
                </Toggle>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
