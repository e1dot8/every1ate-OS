import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { ApartmentRoom } from "@/features/maison/components/apartment-room";
import { AvatarEditor, SlotPicker } from "@/features/maison/components/forms";
import {
  AVATAR_OPTIONS,
  ITEMS,
  SLOTS,
  isUnlocked,
  unlockLabel,
  type AvatarPart,
} from "@/features/maison/cosmetics";
import { apartment } from "@/features/maison/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Aménager" };

async function Editor() {
  const user = await requireUser();
  const a = (await apartment(user.id, user.id))!;
  const options = Object.fromEntries(
    (Object.keys(AVATAR_OPTIONS) as AvatarPart[]).map((part) => [
      part,
      AVATAR_OPTIONS[part].map((o) => ({
        value: o.value,
        label: o.label,
        unlocked: isUnlocked(o.unlock, a.progressContext),
        condition: unlockLabel(o.unlock),
      })),
    ]),
  ) as Record<AvatarPart, { value: string; label: string; unlocked: boolean; condition: string }[]>;
  return (
    <>
      <Card>
        <CardTitle>Mon avatar</CardTitle>
        <AvatarEditor look={a.look} options={options} />
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_24rem]">
        <Card className="gap-2 self-start p-3">
          <ApartmentRoom layout={a.layout} name={a.user.name} />
        </Card>
        <div className="flex flex-col gap-3">
          {SLOTS.map((s) => (
            <SlotPicker
              key={s.key}
              slot={s.key}
              name={s.name}
              current={a.layout[s.key] ?? null}
              choices={ITEMS.filter((i) => i.slot === s.key).map((i) => ({
                value: i.key,
                label: i.name,
                unlocked: isUnlocked(i.unlock, a.progressContext),
                condition: unlockLabel(i.unlock),
              }))}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export default function FurnishPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/appartement">Mon appartement</BackLink>
      <PageHeader
        crumb="facultatif, jamais bloquant"
        title="Aménager"
        description="Quelques options pour l'avatar, six emplacements pour la pièce. Les objets verrouillés disent comment les débloquer."
      />
      <Suspense fallback={<PageLoading />}>
        <Editor />
      </Suspense>
    </div>
  );
}
