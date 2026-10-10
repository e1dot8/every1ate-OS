import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  danger: { icon: OctagonAlert, className: "border-danger/40 bg-danger-soft text-danger" },
  warning: { icon: AlertTriangle, className: "border-warning/40 bg-warning-soft text-warning" },
  success: { icon: CheckCircle2, className: "border-success/40 bg-success-soft text-success" },
  info: { icon: Info, className: "border-info/40 bg-info-soft text-info" },
};

/** Message de formulaire : pictogramme + titre + détail, annoncé aux lecteurs d'écran. */
export function FormAlert({
  tone,
  title,
  children,
}: {
  tone: keyof typeof tones;
  title: string;
  children?: React.ReactNode;
}) {
  const { icon: Icon, className } = tones[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border p-3", className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-bold">{title}</p>
        {children ? <div className="text-sm text-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
