import { MASTERY } from "@/features/skills/tree";
import { cn } from "@/lib/utils";

/** Niveau de maîtrise en 5 points, toujours accompagné de son nom. */
export function LevelDots({ level }: { level: number }) {
  return (
    <span
      className="inline-flex items-center gap-2"
      aria-label={`Niveau ${level} sur 5 : ${MASTERY[level - 1].name}`}
    >
      <span className="inline-flex gap-1" aria-hidden="true">
        {MASTERY.map((m) => (
          <span
            key={m.level}
            className={cn("size-2.5 rounded-full border border-ink", m.level <= level && "bg-ink")}
          />
        ))}
      </span>
      <span className="text-xs font-bold" aria-hidden="true">
        {MASTERY[level - 1].name}
      </span>
    </span>
  );
}
