"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight, BookOpen, Briefcase, ChefHat, Hammer, Home, Lock, type LucideIcon } from "lucide-react";
import { ROOMS, type Room, type RoomKey } from "@/features/maison/rooms";
import { cn } from "@/lib/utils";

const ICONS: Record<RoomKey, LucideIcon> = {
  appartement: Home,
  bureau: Briefcase,
  recettes: BookOpen,
  cuisine: ChefHat,
  atelier: Hammer,
  client: Lock,
};
const SHORT: Record<RoomKey, string> = {
  appartement: "Appartement",
  bureau: "Bureau commun",
  recettes: "Recettes",
  cuisine: "La Cuisine",
  atelier: "Atelier",
  client: "Espace client",
};

// Projection axonométrique (30°) : x vers la droite-bas, y vers la gauche-bas, z vers le haut.
const S = 30;
const C = Math.cos(Math.PI / 6);
const iso = (x: number, y: number, z: number) => [(x - y) * C * S + 230, (x + y) * 0.5 * S - z * S + 210];
const pts = (list: number[][]) => list.map(([x, y, z]) => iso(x, y, z).join(",")).join(" ");

const W = 3.2;
const D = 3.4;
const H = 2.2;
const FLOOR_GAP = 4.4;

function box(room: Room) {
  const x0 = room.column * (W + 0.6);
  const y0 = 0;
  const z0 = room.floor * FLOOR_GAP;
  const z1 = z0 + H;
  return {
    top: pts([
      [x0, y0, z1],
      [x0 + W, y0, z1],
      [x0 + W, y0 + D, z1],
      [x0, y0 + D, z1],
    ]),
    right: pts([
      [x0 + W, y0, z0],
      [x0 + W, y0 + D, z0],
      [x0 + W, y0 + D, z1],
      [x0 + W, y0, z1],
    ]),
    front: pts([
      [x0, y0 + D, z0],
      [x0 + W, y0 + D, z0],
      [x0 + W, y0 + D, z1],
      [x0, y0 + D, z1],
    ]),
    // Porte sur la façade avant.
    door: pts([
      [x0 + W * 0.4, y0 + D, z0],
      [x0 + W * 0.6, y0 + D, z0],
      [x0 + W * 0.6, y0 + D, z0 + H * 0.62],
      [x0 + W * 0.4, y0 + D, z0 + H * 0.62],
    ]),
    label: iso(x0 + W / 2, y0 + D, z0 + H * 0.82),
    // Guide de la vue éclatée (étage → rez-de-chaussée).
    guide: [iso(x0, y0 + D, z0), iso(x0, y0 + D, z0 - FLOOR_GAP + H)],
  };
}

/**
 * Le bâtiment : survol (souris) = aperçu ; clic = entrer. Au toucher : 1er tap = aperçu,
 * 2e tap ou « Ouvrir » = entrer. Au clavier : Tab = aperçu, Entrée = entrer.
 * La liste sous la carte donne le même accès sans la carte.
 */
export function BuildingMap({ previews }: { previews: Record<string, string> }) {
  const router = useRouter();
  const [selected, setSelected] = useState<RoomKey | null>(null);
  const pointer = useRef("mouse");
  const room = selected ? ROOMS.find((r) => r.key === selected)! : null;
  const ordered = [...ROOMS].sort((a, b) => a.floor - b.floor || a.column - b.column);

  const open = (r: Room) => {
    setSelected(r.key);
    if (r.href) router.push(r.href);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="overflow-hidden rounded-2xl border bg-cream">
        <svg
          viewBox="0 0 640 440"
          className="h-auto w-full touch-manipulation select-none"
          role="group"
          aria-label="Le bâtiment Every1.ate : six pièces"
        >
          <defs>
            <pattern
              id="hachures"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--paper)" />
              <path d="M0 0 L0 6" stroke="var(--input)" strokeWidth="2" />
            </pattern>
          </defs>
          <text x="20" y="428" className="fill-pen-strong font-annotation text-[13px]">
            la maison every1.ate — vue éclatée
          </text>
          {ordered.map((r) => {
            const b = box(r);
            const isSel = selected === r.key;
            const dim = selected !== null && !isSel;
            const soon = !r.href;
            return (
              <g
                key={r.key}
                role="button"
                tabIndex={0}
                aria-label={`${r.name} — ${r.purpose}${soon ? ` (${r.comingSoon})` : ""}`}
                aria-pressed={isSel}
                data-room={r.key}
                onPointerDown={(e) => (pointer.current = e.pointerType)}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setSelected(r.key);
                }}
                onClick={() => {
                  if (pointer.current === "mouse" || selected === r.key) open(r);
                  else setSelected(r.key);
                }}
                onFocus={() => setSelected(r.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open(r);
                  }
                }}
                className={cn(
                  "cursor-pointer outline-none transition-opacity duration-200 focus-visible:[&_polygon]:stroke-pen",
                  dim && "opacity-35",
                  soon && "cursor-not-allowed",
                )}
              >
                {r.floor === 1 ? (
                  <line
                    x1={b.guide[0][0]}
                    y1={b.guide[0][1]}
                    x2={b.guide[1][0]}
                    y2={b.guide[1][1]}
                    stroke="var(--ink)"
                    strokeDasharray="3 4"
                    strokeWidth="1"
                  />
                ) : null}
                <polygon
                  points={b.right}
                  fill={soon ? "url(#hachures)" : "var(--cream)"}
                  stroke="var(--ink)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <polygon
                  points={b.front}
                  fill={soon ? "url(#hachures)" : "var(--paper)"}
                  stroke="var(--ink)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <polygon
                  points={b.top}
                  fill={isSel ? "var(--highlight)" : soon ? "var(--muted)" : "var(--paper)"}
                  stroke="var(--ink)"
                  strokeWidth={isSel ? 3 : 2}
                  strokeLinejoin="round"
                />
                <polygon points={b.door} fill={isSel ? "var(--pen)" : "var(--ink)"} />
                <text
                  x={b.label[0]}
                  y={b.label[1]}
                  textAnchor="middle"
                  className={cn("fill-ink text-[12px] font-bold", soon && "fill-muted-foreground")}
                >
                  {SHORT[r.key]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <aside aria-live="polite" className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-card p-5">
        {room ? (
          <>
            <div className="flex items-center gap-3">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-highlight">
                {(() => {
                  const Icon = ICONS[room.key];
                  return <Icon aria-hidden="true" className="size-5" />;
                })()}
              </span>
              <h2 className="text-xl leading-tight font-bold">{room.name}</h2>
            </div>
            <p className="text-sm">{room.purpose}</p>
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="font-annotation text-xs text-pen-strong">à l&apos;intérieur : </span>
              {previews[room.key]}
            </p>
            {room.href ? (
              <Link
                href={room.href}
                className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-bold text-paper hover:bg-ink/85"
              >
                Ouvrir · {room.name} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            ) : (
              <p
                aria-disabled="true"
                className="inline-flex min-h-tap items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-sm font-bold text-muted-foreground"
              >
                <Lock aria-hidden="true" className="size-4" /> {room.comingSoon}
              </p>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">Choisissez une pièce</h2>
            <p className="text-sm text-muted-foreground">
              Survolez une pièce pour la découvrir, cliquez pour y entrer. Sur tablette : un premier tap pour
              la découvrir, un second pour entrer.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
