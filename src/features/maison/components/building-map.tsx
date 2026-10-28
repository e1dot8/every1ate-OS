"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ROOM_ICONS } from "@/features/maison/room-icons";
import { ROOMS, type Room, type RoomKey } from "@/features/maison/rooms";
import { cn } from "@/lib/utils";

// ─── Géométrie : axonométrie à 30°, x vers la droite, y vers l'avant, z vers le haut ─────
const VB_W = 760;
const VB_H = 600;
const S = 46;
const C = Math.cos(Math.PI / 6);
const OX = 290;
const OY = 300;
type P3 = [number, number, number];
const iso = ([x, y, z]: P3): [number, number] => [(x - y) * C * S + OX, (x + y) * 0.5 * S - z * S + OY];
const poly = (pts: P3[]) => pts.map((p) => iso(p).join(",")).join(" ");

const W = 3;
const D = 3.2;
const H = 2;
type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

function boxOf(room: Room): Box {
  if ("annex" in room.cell) return { x0: 6.8, x1: 9, y0: 0.9, y1: D, z0: 0, z1: 1.4 };
  const { floor, column } = room.cell;
  return { x0: column * W, x1: (column + 1) * W, y0: 0, y1: D, z0: floor * H, z1: (floor + 1) * H };
}

const faces = (b: Box) => ({
  top: poly([
    [b.x0, b.y0, b.z1],
    [b.x1, b.y0, b.z1],
    [b.x1, b.y1, b.z1],
    [b.x0, b.y1, b.z1],
  ]),
  front: poly([
    [b.x0, b.y1, b.z0],
    [b.x1, b.y1, b.z0],
    [b.x1, b.y1, b.z1],
    [b.x0, b.y1, b.z1],
  ]),
  right: poly([
    [b.x1, b.y0, b.z0],
    [b.x1, b.y1, b.z0],
    [b.x1, b.y1, b.z1],
    [b.x1, b.y0, b.z1],
  ]),
});

/** Fenêtre sur la façade avant (plan y = y1) : u le long de x, v en hauteur. */
const frontWindow = (b: Box, u0: number, u1: number, v0: number, v1: number) =>
  poly([
    [b.x0 + u0, b.y1, b.z0 + v0],
    [b.x0 + u1, b.y1, b.z0 + v0],
    [b.x0 + u1, b.y1, b.z0 + v1],
    [b.x0 + u0, b.y1, b.z0 + v1],
  ]);
/** Fenêtre sur la façade droite (plan x = x1) : u le long de y. */
const rightWindow = (b: Box, u0: number, u1: number, v0: number, v1: number) =>
  poly([
    [b.x1, b.y0 + u0, b.z0 + v0],
    [b.x1, b.y0 + u1, b.z0 + v0],
    [b.x1, b.y0 + u1, b.z0 + v1],
    [b.x1, b.y0 + u0, b.z0 + v1],
  ]);

const marker = (b: Box) => iso([(b.x0 + b.x1) / 2, b.y1, b.z0 + (b.z1 - b.z0) * 0.62]);

/** Ancrage des étiquettes : à gauche pour la colonne avant, à droite pour l'autre et l'annexe. */
const side = (room: Room) => ("annex" in room.cell || room.cell.column === 1 ? "right" : "left");
const ANCHOR_X = { left: 214, right: 560 };

const ink = "var(--ink)";

function RoomShape({ room, selected }: { room: Room; selected: boolean }) {
  const b = boxOf(room);
  const f = faces(b);
  const soon = !room.href;
  const fill = selected
    ? { top: "#fff9b8", front: "var(--highlight)", right: "#e6d81f" }
    : soon
      ? { top: "url(#hachures)", front: "url(#hachures)", right: "url(#hachures)" }
      : { top: "var(--paper)", front: "var(--paper)", right: "#efeee9" };
  const sw = selected ? 2.4 : 1.4;
  const line = { stroke: ink, strokeWidth: sw, strokeLinejoin: "round" as const };
  const thin = { fill: "none", stroke: ink, strokeWidth: 1 };
  return (
    <g>
      <polygon points={f.right} fill={fill.right} {...line} />
      <polygon points={f.front} fill={fill.front} {...line} />
      <polygon points={f.top} fill={fill.top} {...line} />
      {room.key === "salle" ? (
        <g>
          {/* Grande vitrine et porte de la salle */}
          <polygon points={frontWindow(b, 0.3, 1.9, 0.25, 1.55)} {...thin} />
          {[0.7, 1.1, 1.5].map((u) => (
            <polygon key={u} points={frontWindow(b, u, u, 0.25, 1.55)} {...thin} />
          ))}
          <polygon points={frontWindow(b, 2.2, 2.75, 0, 1.4)} fill={ink} />
          <polygon points={frontWindow(b, 0.15, 2.85, 1.65, 1.8)} fill={selected ? ink : "var(--pen)"} />
        </g>
      ) : room.key === "client" ? (
        <polygon points={frontWindow(b, 0.8, 1.4, 0, 1)} fill={ink} />
      ) : (
        <g>
          <polygon points={frontWindow(b, 0.35, 1.25, 0.55, 1.55)} {...thin} />
          <polygon points={frontWindow(b, 1.75, 2.65, 0.55, 1.55)} {...thin} />
        </g>
      )}
      {"annex" in room.cell || room.cell.column === 1 || (room.cell.floor === 2 && room.cell.column === 0) ? (
        <g>
          <polygon points={rightWindow(b, 0.5, 1.4, 0.55, 1.4)} {...thin} />
          {"annex" in room.cell ? null : <polygon points={rightWindow(b, 1.9, 2.8, 0.55, 1.4)} {...thin} />}
        </g>
      ) : null}
    </g>
  );
}

/**
 * La maison : un objet graphique, pas une scène. Survol (souris) : seule la pièce ciblée se
 * colore et son étiquette révèle un aperçu ; clic : entrer. Toucher : 1er tap = aperçu,
 * 2e tap ou « Entrer » = entrer. Clavier : Tab sur les étiquettes, Entrée pour entrer.
 */
/**
 * Mode « rendu » (lot G8) : quand une image du bâtiment est fournie, elle remplace le dessin.
 * Chaque pièce y est une zone en pourcentage de l'image (x0, y0, x1, y1) ; au survol, la zone
 * se colore en jaune par-dessus la photo. À ajuster si l'image change.
 */
export type BuildingPhoto = { src: string; width: number; height: number };
export const PHOTO_ZONES: Record<RoomKey, [number, number, number, number]> = {
  appartement: [24, 14, 74, 33],
  bureau: [22, 35, 47, 55],
  recettes: [47, 35, 74, 55],
  salle: [22, 57, 47, 80],
  cuisine: [47, 57, 74, 80],
  client: [74, 62, 88, 84],
};

export function BuildingMap({
  previews,
  photo,
}: {
  previews: Record<string, string>;
  photo?: BuildingPhoto | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<RoomKey | null>(null);
  const pointer = useRef("mouse");
  const current = selected ? ROOMS.find((r) => r.key === selected)! : null;
  const order: RoomKey[] = ["salle", "cuisine", "client", "bureau", "recettes", "appartement"];
  const drawn = order.map((k) => ROOMS.find((r) => r.key === k)!);

  const open = (r: Room) => {
    setSelected(r.key);
    if (r.href) router.push(r.href);
  };
  const handlers = (r: Room) => ({
    onPointerDown: (e: React.PointerEvent) => (pointer.current = e.pointerType),
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") setSelected(r.key);
    },
    onClick: () => {
      if (pointer.current === "mouse" || selected === r.key) open(r);
      else setSelected(r.key);
    },
  });

  // Terrasse au-dessus du carnet de recettes (garde-corps), simple trait.
  const terrace = [
    [3, D, 4],
    [6, D, 4],
    [6, 0, 4],
  ] as P3[];
  const rail = terrace.map(([x, y, z]) => [x, y, z + 0.35] as P3);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        {photo ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- image locale, dimensions connues */}
            <img
              src={photo.src}
              width={photo.width}
              height={photo.height}
              alt="La maison Every1.ate : six espaces sur trois niveaux et une annexe"
              className="h-auto w-full select-none"
              draggable={false}
            />
            {ROOMS.map((r) => {
              const [x0, y0, x1, y1] = PHOTO_ZONES[r.key];
              return (
                <div
                  key={r.key}
                  aria-hidden="true"
                  data-room={r.key}
                  {...handlers(r)}
                  className={cn(
                    "absolute touch-manipulation rounded-sm transition-colors duration-200",
                    r.href ? "cursor-pointer" : "cursor-not-allowed",
                    selected === r.key && "bg-highlight/55 mix-blend-multiply",
                  )}
                  style={{ left: `${x0}%`, top: `${y0}%`, width: `${x1 - x0}%`, height: `${y1 - y0}%` }}
                />
              );
            })}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="h-auto w-full touch-manipulation select-none"
            role="img"
            aria-label="La maison Every1.ate : six espaces sur trois niveaux et une annexe"
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
                <path d="M0 0 L0 6" stroke="var(--input)" strokeWidth="1.5" />
              </pattern>
            </defs>
            {/* Sol */}
            <polygon
              points={poly([
                [-0.8, -0.8, 0],
                [9.8, -0.8, 0],
                [9.8, D + 1.2, 0],
                [-0.8, D + 1.2, 0],
              ])}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
            />
            {drawn.map((r) => (
              <g
                key={r.key}
                aria-hidden="true"
                data-room={r.key}
                className={cn("cursor-pointer", !r.href && "cursor-not-allowed")}
                {...handlers(r)}
              >
                <RoomShape room={r} selected={selected === r.key} />
              </g>
            ))}
            <polyline
              points={rail.map((p) => iso(p).join(",")).join(" ")}
              fill="none"
              stroke={ink}
              strokeWidth="1"
            />
            {rail.map((p, i) => (
              <line
                key={i}
                x1={iso(p)[0]}
                y1={iso(p)[1]}
                x2={iso(terrace[i])[0]}
                y2={iso(terrace[i])[1]}
                stroke={ink}
                strokeWidth="1"
              />
            ))}
            {/* Repères jaunes et filets vers les étiquettes (ordinateur) */}
            {ROOMS.map((r) => {
              const [mx, my] = marker(boxOf(r));
              const s = side(r);
              return (
                <g key={r.key} aria-hidden="true">
                  <line
                    x1={mx}
                    y1={my}
                    x2={ANCHOR_X[s]}
                    y2={my}
                    stroke={ink}
                    strokeWidth="0.8"
                    strokeDasharray={selected === r.key ? undefined : "2 3"}
                    className="max-md:hidden"
                  />
                  <circle
                    cx={mx}
                    cy={my}
                    r="11"
                    fill={r.href ? "var(--highlight)" : "var(--muted)"}
                    stroke={ink}
                    strokeWidth="1.4"
                  />
                  <text x={mx} y={my + 4} textAnchor="middle" className="fill-ink text-[11px] font-bold">
                    {r.number}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Étiquettes flottantes (ordinateur et tablette) */}
        <div className="pointer-events-none absolute inset-0 max-md:hidden">
          {ROOMS.map((r) => {
            const s = side(r);
            const z = PHOTO_ZONES[r.key];
            const topPct = photo ? (z[1] + z[3]) / 2 : (marker(boxOf(r))[1] / VB_H) * 100;
            const anchorPct = photo ? (s === "left" ? z[0] - 2 : z[2] + 2) : (ANCHOR_X[s] / VB_W) * 100;
            const Icon = ROOM_ICONS[r.key];
            const isSel = selected === r.key;
            return (
              <div
                key={r.key}
                className={cn(
                  "pointer-events-auto absolute w-56 rounded-xl border bg-paper shadow-[0_10px_30px_-12px_rgba(10,10,10,0.25)] transition-[border-color,transform] duration-200",
                  isSel ? "z-10 -translate-y-0.5 border-ink" : "border-transparent",
                )}
                style={{
                  // Bornée pour que l'étiquette reste dans le cadre du plan (largeur w-56 = 14rem).
                  left: s === "left" ? `max(${anchorPct}%, 14rem)` : `min(${anchorPct}%, calc(100% - 14rem))`,
                  top: `${topPct}%`,
                  transform: s === "left" ? "translate(-100%, -50%)" : "translate(0, -50%)",
                }}
              >
                <button
                  type="button"
                  aria-label={`${r.name} — ${r.purpose}${r.href ? "" : ` (${r.comingSoon})`}`}
                  aria-pressed={isSel}
                  {...handlers(r)}
                  onFocus={(e) => {
                    if (e.currentTarget.matches(":focus-visible")) setSelected(r.key);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3.5 py-3 text-left",
                    r.href ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isSel && "bg-highlight",
                    )}
                  >
                    <Icon aria-hidden="true" strokeWidth={1.5} className="size-6" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[13.5px] font-bold">{r.name}</span>
                    <span className="truncate text-[12px] text-muted-foreground">{r.subtitle}</span>
                  </span>
                  <ArrowRight aria-hidden="true" strokeWidth={1.6} className="size-4 shrink-0" />
                </button>
                {isSel ? (
                  <div className="flex flex-col gap-2 border-t px-3.5 py-2.5">
                    <p className="text-[12px]">
                      <span className="font-annotation text-pen-strong">à l&apos;intérieur : </span>
                      {previews[r.key]}
                    </p>
                    {r.href ? (
                      <Link
                        href={r.href}
                        className="inline-flex min-h-9 items-center gap-1 text-[13px] font-bold underline"
                      >
                        Entrer <ArrowRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    ) : (
                      <span className="text-[12px] font-bold text-muted-foreground">{r.comingSoon}</span>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Aperçu sous la carte (mobile) */}
      <div aria-live="polite" className="md:hidden">
        {current ? (
          <div className="flex flex-col gap-2 rounded-xl border border-ink bg-paper p-4">
            <p className="font-bold">
              {current.number}. {current.name}
            </p>
            <p className="text-sm">{current.purpose}</p>
            <p className="text-sm">
              <span className="font-annotation text-pen-strong">à l&apos;intérieur : </span>
              {previews[current.key]}
            </p>
            {current.href ? (
              <Link
                href={current.href}
                className="inline-flex min-h-tap items-center justify-center gap-2 rounded-full border border-ink bg-highlight px-4 text-sm font-bold"
              >
                Entrer · {current.name} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            ) : (
              <p className="text-sm font-bold text-muted-foreground">{current.comingSoon}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Touchez une pièce pour la découvrir, une seconde fois pour entrer.
          </p>
        )}
      </div>
    </div>
  );
}
