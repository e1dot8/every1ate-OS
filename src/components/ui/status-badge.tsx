import { AlertTriangle, CheckCircle2, Info, OctagonAlert, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Statut toujours exprimé par trois signaux : couleur, pictogramme et texte.
 * Règle d'accessibilité : un état n'est jamais distingué par la couleur seule.
 */
const tones = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  danger: OctagonAlert,
} satisfies Record<string, LucideIcon>;

export type StatusTone = keyof typeof tones;

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  const Icon = tones[tone];
  return (
    <Badge variant={tone}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  );
}
