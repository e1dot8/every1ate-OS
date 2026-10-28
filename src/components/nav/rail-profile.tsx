import Link from "next/link";
import { getProgress } from "@/features/progression/service";
import { BrigadeAvatar } from "@/features/maison/components/avatar";
import { getAvatar } from "@/features/maison/service";
import { getCurrentUser } from "@/lib/auth/session";

/** Profil discret en pied de rail : la progression est là, sans occuper l'écran de travail. */
export async function RailProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [p, look] = await Promise.all([getProgress(user.id), getAvatar(user.id)]);
  return (
    <Link
      href="/appartement"
      className="flex items-center gap-3 rounded-md p-2 hover:bg-muted"
      aria-label={`Mon appartement : ${p.rank.title}, niveau ${p.level}, ${p.xp} XP`}
    >
      <BrigadeAvatar look={look} size={38} />
      <span className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
        <b className="truncate text-[13px]">{user.name}</b>
        <span className="text-[11px] text-muted-foreground">
          {p.rank.title} · niv. {p.level}
        </span>
        <span className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className="block h-full bg-ink" style={{ width: `${p.percent}%` }} />
        </span>
      </span>
    </Link>
  );
}
