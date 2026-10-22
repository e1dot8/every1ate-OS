import { useId } from "react";
import type { AvatarLook } from "@/features/maison/cosmetics";
import { cn } from "@/lib/utils";

/**
 * Avatar de brigade : buste en trait noir, aplats de la marque (crème, jaune surligneur,
 * rouge stylo). Dessin original, purement cosmétique.
 */
const SKIN: Record<string, string> = {
  s1: "#f6dcc8",
  s2: "#eac2a0",
  s3: "#c98f66",
  s4: "#a8714c",
  s5: "#7a4e33",
  s6: "#4e3122",
};
const BACKDROP: Record<string, string> = {
  creme: "var(--cream)",
  blanc: "var(--paper)",
  jaune: "var(--highlight)",
  noir: "var(--ink)",
};
const APRON: Record<string, string> = {
  noir: "var(--ink)",
  blanc: "var(--paper)",
  jaune: "var(--highlight)",
  rouge: "var(--pen)",
};

const ink = "var(--ink)";

function Hat({ kind }: { kind: string }) {
  switch (kind) {
    case "toque":
      return (
        <g>
          <path
            d="M33 34 Q30 18 42 18 Q46 8 56 13 Q66 8 70 18 Q82 18 75 34 Z"
            fill="var(--paper)"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <rect x="34" y="30" width="40" height="9" rx="2" fill="var(--paper)" stroke={ink} strokeWidth="3" />
        </g>
      );
    case "toque-haute":
      return (
        <g>
          <path
            d="M34 34 L32 4 Q44 -2 54 4 Q64 -2 76 4 L74 34 Z"
            fill="var(--paper)"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M44 6 L44 30 M54 4 L54 30 M64 6 L64 30" stroke={ink} strokeWidth="1.5" />
          <rect x="33" y="30" width="42" height="9" rx="2" fill="var(--paper)" stroke={ink} strokeWidth="3" />
        </g>
      );
    case "bonnet":
      return (
        <g>
          <path d="M33 38 Q32 14 54 14 Q76 14 75 38 Z" fill="var(--pen)" stroke={ink} strokeWidth="3" />
          <rect x="31" y="33" width="46" height="8" rx="3" fill="var(--paper)" stroke={ink} strokeWidth="3" />
          <circle cx="54" cy="12" r="5" fill="var(--paper)" stroke={ink} strokeWidth="3" />
        </g>
      );
    case "casquette":
      return (
        <g>
          <path d="M34 36 Q34 18 54 18 Q74 18 74 36 Z" fill="var(--ink)" stroke={ink} strokeWidth="3" />
          <path
            d="M70 34 Q86 33 90 38 L70 39 Z"
            fill="var(--ink)"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="54" cy="19" r="2" fill="var(--paper)" />
        </g>
      );
    case "bandana":
      return (
        <g>
          <path d="M34 36 Q34 20 54 20 Q74 20 74 36 Z" fill="var(--highlight)" stroke={ink} strokeWidth="3" />
          <path
            d="M34 34 L24 40 L30 30"
            fill="var(--highlight)"
            stroke={ink}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="46" cy="28" r="1.5" fill={ink} />
          <circle cx="58" cy="26" r="1.5" fill={ink} />
          <circle cx="66" cy="31" r="1.5" fill={ink} />
        </g>
      );
    default:
      return (
        <path
          d="M36 34 Q38 22 54 22 Q70 22 72 34"
          fill="none"
          stroke={ink}
          strokeWidth="3"
          strokeLinecap="round"
        />
      );
  }
}

function Accessory({ kind }: { kind: string }) {
  if (kind === "lunettes")
    return (
      <g fill="none" stroke={ink} strokeWidth="2.5">
        <circle cx="46" cy="49" r="6" />
        <circle cx="62" cy="49" r="6" />
        <path d="M52 49 L56 49" />
      </g>
    );
  if (kind === "moustache")
    return <path d="M44 60 Q50 55 54 59 Q58 55 64 60 Q58 63 54 61 Q50 63 44 60 Z" fill={ink} />;
  if (kind === "casque")
    return (
      <g>
        <path d="M33 50 Q33 26 54 26 Q75 26 75 50" fill="none" stroke={ink} strokeWidth="3.5" />
        <rect x="28" y="45" width="9" height="14" rx="3" fill="var(--pen)" stroke={ink} strokeWidth="2.5" />
        <rect x="71" y="45" width="9" height="14" rx="3" fill="var(--pen)" stroke={ink} strokeWidth="2.5" />
      </g>
    );
  return null;
}

export function BrigadeAvatar({
  look,
  size = 96,
  className,
  label,
}: {
  look: AvatarLook;
  size?: number;
  className?: string;
  /** Texte alternatif ; sans libellé, l'avatar est décoratif. */
  label?: string;
}) {
  const clip = `avatar-${useId().replace(/:/g, "")}`;
  const skin = SKIN[look.skin] ?? SKIN.s3;
  const dark = look.backdrop === "noir";
  return (
    <svg
      viewBox="0 0 108 108"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle
        cx="54"
        cy="54"
        r="52"
        fill={BACKDROP[look.backdrop] ?? BACKDROP.creme}
        stroke={ink}
        strokeWidth="3"
      />
      <clipPath id={clip}>
        <circle cx="54" cy="54" r="50.5" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        {/* Épaules et veste */}
        <path
          d="M14 112 Q16 80 40 76 L68 76 Q92 80 94 112 Z"
          fill="var(--paper)"
          stroke={dark ? "var(--paper)" : ink}
          strokeWidth="3"
        />
        {/* Tablier */}
        <path
          d="M38 80 L70 80 L74 112 L34 112 Z"
          fill={APRON[look.apron] ?? APRON.noir}
          stroke={ink}
          strokeWidth="3"
        />
        <path d="M40 80 L46 70 M68 80 L62 70" stroke={ink} strokeWidth="3" />
        {/* Cou */}
        <rect x="47" y="64" width="14" height="14" fill={skin} stroke={ink} strokeWidth="3" />
        {/* Tête */}
        <ellipse cx="54" cy="50" rx="19" ry="21" fill={skin} stroke={ink} strokeWidth="3" />
        <circle cx="47" cy="49" r="2.2" fill={ink} />
        <circle cx="61" cy="49" r="2.2" fill={ink} />
        <path d="M48 60 Q54 64 60 60" fill="none" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
        <Accessory kind={look.accessory} />
        <Hat kind={look.hat} />
      </g>
    </svg>
  );
}
