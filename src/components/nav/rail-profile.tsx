import Link from "next/link";
import { getProgress } from "@/features/progression/service";
import { BrigadeAvatar } from "@/features/maison/components/avatar";
import { getAvatar } from "@/features/maison/service";
import { getCurrentUser } from "@/lib/auth/session";

/** Carte de profil en pied de rail : rang, niveau et XP du niveau en cours, sans occuper l'écran. */
export async function RailProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [p, look] = await Promise.all([getProgress(user.id), getAvatar(user.id)]);
  return (
    <Link
      href="/appartement"
      className="flex items-center gap-3 rounded-xl border bg-paper p-3 hover:border-ink/30"
      aria-label={`Mon appartement : ${p.rank.title}, niveau ${p.level}, ${p.xp} XP`}
    >
      <BrigadeAvatar look={look} size={40} />
      <span className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
        <b className="truncate text-[13px]">{user.name}</b>
        <span className="text-[11px] text-muted-foreground">
          {p.rank.title} · Niv. {p.level}
        </span>
        <span className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className="block h-full rounded-full bg-ink" style={{ width: `${p.percent}%` }} />
        </span>
        <span className="text-right text-[10px] font-bold tabular-nums">
          {p.intoLevel} / {p.levelSpan} XP
        </span>
      </span>
    </Link>
  );
}
