import type { Metadata } from "next";
import { Share, SquarePlus } from "lucide-react";
import { BackLink } from "@/components/app/bits";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { InstallButton } from "@/components/pwa/install-button";

export const metadata: Metadata = { title: "Installer l'application" };

export default function InstallPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/plus">Plus</BackLink>
      <PageHeader
        title="Installer l'application"
        description="Every1.ate OS s'utilise comme une application, depuis l'écran d'accueil."
      />
      <Card className="max-w-2xl gap-3">
        <CardTitle>iPhone et iPad (Safari)</CardTitle>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>
            Ouvrez Every1.ate OS dans <b>Safari</b>.
          </li>
          <li>
            Touchez <Share aria-label="Partager" className="inline size-4" /> <b>Partager</b>.
          </li>
          <li>
            Choisissez <SquarePlus aria-hidden="true" className="inline size-4" />{" "}
            <b>Sur l&apos;écran d&apos;accueil</b>, puis <b>Ajouter</b>.
          </li>
          <li>
            Lancez l&apos;application depuis son icône : elle s&apos;ouvre en plein écran, sans barre Safari.
          </li>
        </ol>
      </Card>
      <Card className="max-w-2xl gap-3">
        <CardTitle>Android et ordinateur (Chrome, Edge)</CardTitle>
        <p className="text-sm">
          Utilisez le bouton ci-dessous, ou l&apos;icône d&apos;installation dans la barre d&apos;adresse.
        </p>
        <InstallButton />
      </Card>
      <Card className="max-w-2xl gap-2 text-sm">
        <CardTitle>Hors ligne</CardTitle>
        <p>
          Sans réseau, l&apos;application l&apos;indique clairement et n&apos;enregistre aucune modification.
          Par sécurité, aucune page contenant vos données n&apos;est conservée sur l&apos;appareil, et tout
          est effacé à la déconnexion.
        </p>
      </Card>
    </div>
  );
}
