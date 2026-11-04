"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { checkPushSubscriptionAction, subscribePushAction, unsubscribePushAction } from "./actions";

type DeviceState = "loading" | "unsupported" | "denied" | "off" | "on";
type Notice = { tone: "success" | "warning" | "danger"; text: string } | null;

const stateLabels: Record<DeviceState, { label: string; variant: "outline" | "success" | "warning" | "danger" }> = {
  loading: { label: "Vérification…", variant: "outline" },
  unsupported: { label: "Non prises en charge", variant: "warning" },
  denied: { label: "Refusées", variant: "danger" },
  off: { label: "Désactivées", variant: "outline" },
  on: { label: "Activées", variant: "success" },
};

function isSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Clé publique VAPID (base64url) → octets attendus par `pushManager.subscribe`. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url + "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(subscription: PushSubscription, publicKey: string): boolean {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  const b = keyBytes(publicKey);
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Service worker actif (enregistré à la demande s'il ne l'est pas encore, ex. en développement). */
async function activeRegistration(): Promise<ServiceWorkerRegistration> {
  if (!(await navigator.serviceWorker.getRegistration("/")))
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("service worker")), 15_000)),
  ]);
}

/**
 * Notifications push de CET appareil : état, activation (permission + abonnement + enregistrement
 * côté serveur) et désactivation. `publicKey` null : notifications push non configurées.
 */
export function PushDevice({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<DeviceState>("loading");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let cancelled = false;
    const read = async (): Promise<DeviceState> => {
      if (!isSupported()) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      const subscription = await currentSubscription();
      if (!subscription || Notification.permission !== "granted") return "off";
      return (await checkPushSubscriptionAction({ endpoint: subscription.endpoint })) ? "on" : "off";
    };
    read()
      .catch((): DeviceState => "off")
      .then((next) => {
        if (!cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function activate() {
    if (!publicKey) return;
    setBusy(true);
    setNotice(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        setNotice({ tone: "warning", text: "Autorisation non accordée : aucune notification ne sera affichée." });
        return;
      }
      const registration = await activeRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !sameKey(subscription, publicKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      });
      const json = subscription.toJSON();
      const result = await subscribePushAction({ endpoint: json.endpoint, keys: json.keys });
      if (!result.ok) await subscription.unsubscribe().catch(() => false);
      setState(result.ok ? "on" : "off");
      setNotice({ tone: result.ok ? "success" : "danger", text: result.message });
    } catch {
      setNotice({
        tone: "danger",
        text: "Activation impossible sur ce navigateur. Vérifiez les réglages de notification du téléphone ou de l'ordinateur, puis réessayez.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setNotice(null);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => false);
        const result = await unsubscribePushAction({ endpoint });
        setNotice({ tone: result.ok ? "success" : "danger", text: result.message });
      }
      setState("off");
    } catch {
      setNotice({ tone: "danger", text: "Désactivation impossible. Réessayez." });
    } finally {
      setBusy(false);
    }
  }

  const status = stateLabels[state];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Sur cet appareil :</span>
        <Badge variant={status.variant} role="status" aria-live="polite">
          {status.label}
        </Badge>
      </div>
      {state === "unsupported" ? (
        <p className="text-sm text-muted-foreground">
          Ce navigateur ne gère pas les notifications push. Sur iPhone, installez d&apos;abord l&apos;application
          sur l&apos;écran d&apos;accueil, puis ouvrez cette page depuis son icône.
        </p>
      ) : null}
      {state === "denied" ? (
        <p className="text-sm text-muted-foreground">
          Les notifications de ce site sont bloquées. Autorisez-les dans les réglages du navigateur (ou du
          téléphone), puis rechargez la page.
        </p>
      ) : null}
      {notice ? <FormAlert tone={notice.tone} title={notice.text} /> : null}
      {!publicKey ? (
        <div className="flex flex-col gap-1">
          <div>
            <Button type="button" disabled aria-disabled>
              <Bell aria-hidden="true" /> Activer sur cet appareil
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Bientôt disponible : clés à configurer (voir EXPLOITATION.md).
          </p>
        </div>
      ) : state === "on" ? (
        <div>
          <Button type="button" variant="outline" onClick={deactivate} disabled={busy}>
            <BellOff aria-hidden="true" /> {busy ? "Désactivation…" : "Désactiver"}
          </Button>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            onClick={activate}
            disabled={busy || state === "loading" || state === "unsupported" || state === "denied"}
          >
            <Bell aria-hidden="true" /> {busy ? "Activation…" : "Activer sur cet appareil"}
          </Button>
        </div>
      )}
    </div>
  );
}
