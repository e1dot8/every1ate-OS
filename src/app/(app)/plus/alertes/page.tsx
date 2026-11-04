import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { X } from "lucide-react";
import { PageLoading } from "@/components/layout/page-header";
import { Callout, EmptyLine, NotionPage, Section } from "@/components/notion/blocks";
import { Badge } from "@/components/ui/badge";
import { getAlertSettings } from "@/features/notifications/alerts-service";
import {
  CALLMEBOT_ACTIVATION_MESSAGE,
  CALLMEBOT_ACTIVATION_URL,
  WHATSAPP_HOURLY_LIMIT,
  channelLabels,
  deliveryStatusLabel,
} from "@/features/notifications/external-rules";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, formatDay } from "@/lib/dates";
import { removeDeviceAction } from "./actions";
import { PrefsForm, RemoveWhatsappForm, TestSendForm, WhatsappForm } from "./forms";
import { PushDevice } from "./push-device";

export const metadata: Metadata = { title: "Alertes" };

const statusVariant: Record<string, "success" | "danger" | "warning" | "info" | "outline"> = {
  envoye: "success",
  echec: "danger",
  limite: "warning",
  ignore_focus: "outline",
  outbox: "info",
};

async function Alerts() {
  const user = await requireUser();
  const settings = await getAlertSettings(user.id);
  const { push, whatsapp, prefs, deliveries } = settings;
  const whatsappReady = Boolean(whatsapp.phone && whatsapp.hasKey);
  return (
    <>
      <Section id="appareil" title="Notifications sur cet appareil">
        <PushDevice publicKey={push.publicKey} />
        <Callout icon="📱" tone="info">
          <b>iPhone et iPad (iOS 16.4 ou plus)</b> :{" "}
          <Link href="/plus/installer" className="underline decoration-pen underline-offset-4">
            installez d&apos;abord l&apos;application
          </Link>{" "}
          sur l&apos;écran d&apos;accueil, ouvrez-la depuis son icône, puis activez ici. Android et ordinateur
          : directement depuis le navigateur. Se déconnecter désactive les notifications de l&apos;appareil.
        </Callout>
        {push.testMode ? (
          <p className="text-xs text-muted-foreground">
            Mode test : les envois push sont journalisés sans rien envoyer.
          </p>
        ) : null}
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold">Mes appareils ({push.devices.length})</h3>
          {push.devices.length ? (
            <ul aria-label="Mes appareils" className="flex flex-col">
              {push.devices.map((device) => (
                <li
                  key={device.id}
                  className="flex min-h-tap items-center gap-2 border-b px-1 last:border-b-0 hover:bg-muted/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">{device.label}</span>{" "}
                    <span className="text-sm text-muted-foreground">
                      · ajouté le {formatDay(device.createdAt)}
                    </span>
                  </span>
                  <form action={removeDeviceAction}>
                    <input type="hidden" name="deviceId" value={device.id} />
                    <button
                      type="submit"
                      aria-label={`Retirer l'appareil ${device.label}`}
                      className="inline-flex size-tap cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine>Aucun appareil ne reçoit encore vos notifications.</EmptyLine>
          )}
        </div>
        {push.devices.length && (push.publicKey || push.testMode) ? <TestSendForm channel="push" /> : null}
      </Section>

      <Section id="whatsapp" title="WhatsApp (gratuit, via CallMeBot)">
        <Callout icon="ℹ️">
          CallMeBot est un service tiers gratuit, réservé à un usage personnel, sans garantie de délai ni de
          disponibilité. Chaque associé active son propre numéro. Au plus {WHATSAPP_HOURLY_LIMIT} messages par
          heure. Votre clé est chiffrée sur le serveur et n&apos;est jamais réaffichée.
        </Callout>
        <ol className="flex list-decimal flex-col gap-2 pl-6 text-sm">
          <li>
            Ajoutez à vos contacts le numéro de CallMeBot indiqué sur{" "}
            <a
              href={CALLMEBOT_ACTIVATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline decoration-pen underline-offset-4"
            >
              leur page d&apos;activation
            </a>
            .
          </li>
          <li>
            Envoyez-lui sur WhatsApp ce message exact :{" "}
            <code className="rounded bg-muted px-1 py-0.5 break-words">{CALLMEBOT_ACTIVATION_MESSAGE}</code>
          </li>
          <li>
            Vous recevez en réponse votre clé API (« apikey ») : saisissez-la ci-dessous avec votre numéro au
            format international.
          </li>
        </ol>
        <WhatsappForm phone={whatsapp.phone} hasKey={whatsapp.hasKey} />
        {whatsapp.testMode ? (
          <p className="text-xs text-muted-foreground">
            Mode test : les messages WhatsApp sont journalisés sans rien envoyer.
          </p>
        ) : null}
        <div className="flex flex-wrap items-start gap-2">
          {whatsappReady ? <TestSendForm channel="whatsapp" /> : null}
          <RemoveWhatsappForm configured={Boolean(whatsapp.phone || whatsapp.hasKey)} />
        </div>
      </Section>

      <Section id="preferences" title="Que recevoir ?">
        <Callout icon="🌙">
          En <b>focus</b> ou <b>absent</b>, rien n&apos;est envoyé hors de l&apos;app, sauf urgence. Tout
          reste visible dans les{" "}
          <Link href="/notifications" className="underline decoration-pen underline-offset-4">
            notifications
          </Link>{" "}
          de l&apos;app.
        </Callout>
        <PrefsForm prefs={prefs} pushReady={push.devices.length > 0} whatsappReady={whatsappReady} />
      </Section>

      <Section id="envois" title="Derniers envois" count={deliveries.length}>
        {deliveries.length ? (
          <ul aria-label="Derniers envois" className="flex flex-col">
            {deliveries.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-1 border-b px-1 py-2 last:border-b-0 hover:bg-muted/60 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-bold break-words">{d.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(d.createdAt)} · {channelLabels[d.channel] ?? d.channel}
                    {d.status === "echec" && d.error ? ` · ${d.error}` : ""}
                  </span>
                </span>
                <Badge variant={statusVariant[d.status] ?? "outline"}>{deliveryStatusLabel(d.status)}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine>Aucun envoi pour l&apos;instant.</EmptyLine>
        )}
      </Section>
    </>
  );
}

export default function AlertsPage() {
  return (
    <NotionPage
      icon="🔔"
      title="Alertes"
      crumbs={[{ label: "Plus", href: "/plus" }, { label: "Alertes" }]}
      description="Être prévenu sur son téléphone quand quelque chose vient d'être fait : notifications push et WhatsApp, sans frais."
    >
      <Suspense fallback={<PageLoading />}>
        <Alerts />
      </Suspense>
    </NotionPage>
  );
}
