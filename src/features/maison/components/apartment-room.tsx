import type { Slot } from "@/features/maison/cosmetics";

/**
 * La pièce de l'appartement : un mur, un sol, six emplacements prédéfinis.
 * Dessin original en trait noir sur crème, accents jaune et rouge de la marque.
 */
const ink = "var(--ink)";
const line = {
  stroke: ink,
  strokeWidth: 2.5,
  strokeLinejoin: "round" as const,
  strokeLinecap: "round" as const,
};

function Poster({ item }: { item: string }) {
  const text: Record<string, [string, string]> = {
    "affiche-cuisine": ["ON CUISINE", "DES EXPÉRIENCES"],
    "affiche-methode": ["NOTRE", "MÉTHODE"],
    "affiche-sonnez": ["UNE IDÉE ?", "SONNEZ"],
  };
  if (item === "cadre-souvenir")
    return (
      <g>
        <rect x="52" y="34" width="104" height="80" fill="var(--paper)" {...line} strokeWidth={4} />
        <rect x="62" y="44" width="84" height="48" fill="var(--highlight)" {...line} />
        <path d="M66 88 L88 64 L104 80 L116 70 L142 88 Z" fill={ink} />
        <text x="104" y="106" textAnchor="middle" className="fill-ink text-[8px] font-bold">
          SOUVENIR DE PROJET
        </text>
      </g>
    );
  const [a, b] = text[item] ?? text["affiche-cuisine"];
  return (
    <g>
      <rect
        x="58"
        y="28"
        width="92"
        height="118"
        fill={item === "affiche-sonnez" ? ink : "var(--paper)"}
        {...line}
      />
      <text
        x="104"
        y="70"
        textAnchor="middle"
        className={
          item === "affiche-sonnez" ? "fill-paper text-[11px] font-bold" : "fill-ink text-[11px] font-bold"
        }
      >
        {a}
      </text>
      <text
        x="104"
        y="86"
        textAnchor="middle"
        className={
          item === "affiche-sonnez"
            ? "fill-highlight text-[11px] font-bold"
            : "fill-ink text-[11px] font-bold"
        }
      >
        {b}
      </text>
      <path d="M78 112 L130 112" stroke="var(--pen)" strokeWidth="3" />
    </g>
  );
}

function Shelf({ item }: { item: string }) {
  return (
    <g>
      <path d="M300 96 L450 96" {...line} strokeWidth={4} />
      <path d="M312 96 L318 108 M438 96 L432 108" {...line} />
      {item === "livres" &&
        [0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={316 + i * 16}
            y={56 - (i % 2) * 6}
            width="13"
            height={40 + (i % 2) * 6}
            fill={i === 2 ? "var(--highlight)" : i === 4 ? "var(--pen)" : "var(--paper)"}
            {...line}
          />
        ))}
      {item === "carnets" &&
        [0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={330 - i * 2}
            y={84 - i * 10}
            width="60"
            height="10"
            fill={i % 2 ? "var(--paper)" : "var(--highlight)"}
            {...line}
          />
        ))}
      {item === "bocaux" &&
        [0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={322 + i * 36} y="62" width="26" height="34" rx="5" fill="var(--paper)" {...line} />
            <rect x={322 + i * 36} y="56" width="26" height="8" fill={i === 1 ? "var(--pen)" : ink} />
            <rect
              x={326 + i * 36}
              y={76 - i * 4}
              width="18"
              height={16 + i * 4}
              fill={i === 0 ? "var(--highlight)" : i === 1 ? "var(--pen)" : "var(--cream)"}
            />
          </g>
        ))}
    </g>
  );
}

function Desk({ item }: { item: string }) {
  return (
    <g>
      <rect x="210" y="190" width="170" height="12" fill="var(--paper)" {...line} />
      <path d="M222 202 L222 262 M368 202 L368 262" {...line} strokeWidth={4} />
      {item === "ordinateur" && (
        <g>
          <path d="M262 186 L328 186 L320 150 L270 150 Z" fill={ink} />
          <path d="M252 190 L338 190" {...line} />
        </g>
      )}
      {item === "double-ecran" && (
        <g>
          <rect x="232" y="140" width="58" height="38" fill={ink} />
          <rect x="298" y="140" width="58" height="38" fill={ink} />
          <rect x="238" y="146" width="46" height="26" fill="var(--highlight)" />
          <path d="M261 178 L261 190 M327 178 L327 190" {...line} />
        </g>
      )}
      {item === "clap" && (
        <g>
          <rect x="268" y="160" width="56" height="30" fill={ink} />
          <path d="M268 160 L276 144 L330 152 L324 160 Z" fill="var(--paper)" {...line} />
          <path d="M286 146 L282 158 M302 148 L298 160 M318 150 L314 160" stroke={ink} strokeWidth="4" />
        </g>
      )}
    </g>
  );
}

function Lamp({ item }: { item: string }) {
  if (item === "guirlande")
    return (
      <g>
        <path d="M10 18 Q120 48 240 22 Q360 48 470 18" fill="none" {...line} strokeWidth={1.5} />
        {[40, 90, 140, 190, 290, 340, 390, 440].map((x, i) => (
          <circle
            key={x}
            cx={x}
            cy={i % 2 ? 34 : 30}
            r="5"
            fill={i % 3 ? "var(--highlight)" : "var(--pen)"}
            stroke={ink}
            strokeWidth="1.5"
          />
        ))}
      </g>
    );
  if (item === "lampe-arc")
    return (
      <g>
        <path d="M430 262 L430 120 Q430 70 380 74" fill="none" {...line} strokeWidth={4} />
        <path d="M362 70 L400 70 L392 88 L370 88 Z" fill="var(--highlight)" {...line} />
        <ellipse cx="430" cy="264" rx="18" ry="5" fill={ink} />
      </g>
    );
  return (
    <g>
      <path d="M362 190 L362 176 L346 150" {...line} strokeWidth={3} />
      <path d="M334 140 L356 132 L360 152 Z" fill="var(--highlight)" {...line} />
      <path d="M354 190 L370 190" {...line} strokeWidth={4} />
    </g>
  );
}

function Floor({ item }: { item: string }) {
  if (item === "tapis")
    return (
      <g>
        <ellipse cx="200" cy="272" rx="110" ry="18" fill="var(--paper)" {...line} />
        {[-80, -40, 0, 40, 80].map((dx) => (
          <path key={dx} d={`M${200 + dx} 256 L${200 + dx} 288`} stroke="var(--pen)" strokeWidth="5" />
        ))}
      </g>
    );
  const big = item === "monstera";
  return (
    <g>
      <path d="M40 286 L46 248 L84 248 L90 286 Z" fill="var(--paper)" {...line} />
      <path
        d={
          big
            ? "M64 248 Q30 200 40 150 Q70 170 64 248 Q80 180 110 160 Q118 210 64 248 Q60 190 70 130"
            : "M64 248 Q44 220 48 200 Q66 212 64 248 Q76 214 92 206 Q92 230 64 248"
        }
        fill="var(--success-soft)"
        {...line}
      />
    </g>
  );
}

function Showcase({ item }: { item: string | undefined }) {
  return (
    <g>
      <rect x="176" y="40" width="74" height="84" fill="var(--paper)" {...line} />
      <path d="M176 82 L250 82" {...line} strokeWidth={1.5} />
      {item === "medaille" && (
        <g>
          <path d="M206 48 L212 64 M220 48 L214 64" stroke="var(--pen)" strokeWidth="4" />
          <circle cx="213" cy="70" r="9" fill="var(--highlight)" {...line} />
        </g>
      )}
      {item === "toque-or" && (
        <path d="M198 78 Q194 56 206 56 Q213 46 220 56 Q232 56 228 78 Z" fill="var(--highlight)" {...line} />
      )}
      {item === "wok-dore" && (
        <g>
          <path d="M192 104 Q213 124 234 104 Z" fill="var(--highlight)" {...line} />
          <path d="M234 106 L246 100" {...line} strokeWidth={4} />
        </g>
      )}
      {!item ? (
        <text x="213" y="108" textAnchor="middle" className="fill-muted-foreground text-[8px]">
          vitrine vide
        </text>
      ) : null}
    </g>
  );
}

export function ApartmentRoom({ layout, name }: { layout: Partial<Record<Slot, string>>; name: string }) {
  return (
    <svg viewBox="0 0 480 300" className="h-auto w-full" role="img" aria-label={`L'appartement de ${name}`}>
      <rect x="0" y="0" width="480" height="210" fill="var(--cream)" />
      <path d="M0 210 L480 210 L480 300 L0 300 Z" fill="var(--paper)" />
      {[0, 60, 120, 180, 240, 300, 360, 420].map((x) => (
        <path key={x} d={`M${x} 210 L${x - 20} 300`} stroke="var(--border)" strokeWidth="1.5" />
      ))}
      <path d="M0 210 L480 210" {...line} />
      {layout.lampe === "guirlande" ? <Lamp item="guirlande" /> : null}
      {layout.mur ? <Poster item={layout.mur} /> : null}
      <Showcase item={layout.vitrine} />
      {layout.etagere ? <Shelf item={layout.etagere} /> : null}
      {layout.sol === "tapis" ? <Floor item="tapis" /> : null}
      {layout.bureau ? <Desk item={layout.bureau} /> : null}
      {layout.lampe && layout.lampe !== "guirlande" ? <Lamp item={layout.lampe} /> : null}
      {layout.sol && layout.sol !== "tapis" ? <Floor item={layout.sol} /> : null}
      <rect x="1.5" y="1.5" width="477" height="297" fill="none" {...line} />
    </svg>
  );
}
