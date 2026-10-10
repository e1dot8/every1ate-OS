import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Archive,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  FileText,
  LogOut,
  Palette,
  ShieldCheck,
  Smartphone,
  Timer,
  UserPlus,
  Wallet,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { signOutAction } from "./actions";

export const metadata: Metadata = { title: "Plus" };

const rowClass = "flex min-h-14 w-full items-center gap-3 border-b py-3 text-left last:border-b-0";

function Row({
  href,
  icon: Icon,
  title,
  detail,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <Link href={href} className={`${rowClass} hover:bg-muted/60`}>
      <Icon aria-hidden="true" className="size-5" />
      <span className="flex flex-1 flex-col">
        <span className="font-bold">{title}</span>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
    </Link>
  );
}

async function Menu() {
  await requireUser();
  return (
    <Card className="gap-0 py-1">
      <Row
        href="/calendrier"
        icon={CalendarDays}
        title="Calendrier"
        detail="Réunions, échéances, abonnement Google/Apple"
      />
      <Row href="/documents" icon={FileText} title="Documents" detail="Références Google Drive" />
      <Row href="/finance" icon={Wallet} title="Finance" detail="Budgets, coûts, échéancier, imports, MRR" />
      <Row href="/gouvernance" icon={Landmark} title="Gouvernance" detail="Seuils et décisions collectives" />
      <Row href="/crm/clients" icon={Building2} title="Clients" detail="Entreprises et contacts" />
      <Row href="/temps" icon={Timer} title="Temps" detail="Chronomètre, saisies et corrections" />
      <Row href="/notifications" icon={Bell} title="Notifications" detail="Alertes, retards et escalades" />
      <Row
        href="/plus/securite"
        icon={ShieldCheck}
        title="Sécurité"
        detail="Mot de passe, appareils connectés"
      />
      <Row href="/plus/associes" icon={UserPlus} title="Associés" detail="Comptes et invitations" />
      <Row href="/plus/archives" icon={Archive} title="Archives" detail="Projets, lots et tâches archivés" />
      <Row
        href="/plus/installer"
        icon={Smartphone}
        title="Installer l'application"
        detail="iPhone, Android, ordinateur"
      />
      <Row href="/design" icon={Palette} title="Design system" detail="Tokens et composants de l'interface" />
      <form action={signOutAction}>
        <button type="submit" className={`${rowClass} cursor-pointer font-bold hover:bg-muted/60`}>
          <LogOut aria-hidden="true" className="size-5" />
          Se déconnecter
        </button>
      </form>
    </Card>
  );
}

export default function MorePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plus" />
      <Suspense fallback={<PageLoading />}>
        <Menu />
      </Suspense>
    </div>
  );
}
