"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw } from "lucide-react";

/**
 * - Enregistre le service worker (production uniquement).
 * - Affiche l'état hors ligne / reconnexion (§16.2).
 * - Bloque tout envoi de formulaire hors ligne : rien n'est enregistré silencieusement.
 */
export function PwaManager() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [back, setBack] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
    const update = () => setOnline(navigator.onLine);
    update();
    const goOnline = () => {
      setOnline(true);
      setBlocked(false);
      setBack(true);
      router.refresh();
      setTimeout(() => setBack(false), 4000);
    };
    const goOffline = () => setOnline(false);
    const guard = (event: Event) => {
      if (!navigator.onLine) {
        event.preventDefault();
        event.stopPropagation();
        setBlocked(true);
      }
    };
    // Clic sur une notification push quand l'onglet n'est pas piloté par le service worker.
    const onWorkerMessage = (event: MessageEvent) => {
      const href = (event.data as { type?: string; href?: unknown } | null)?.href;
      if (event.data?.type === "navigate" && typeof href === "string" && /^\/(?!\/)/.test(href))
        router.push(href as Parameters<typeof router.push>[0]);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("submit", guard, true);
    navigator.serviceWorker?.addEventListener("message", onWorkerMessage);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("submit", guard, true);
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage);
    };
  }, [router]);

  if (online && !back) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-sm font-bold ${online ? "bg-success-soft text-success" : "bg-warning-soft text-ink"}`}
    >
      {online ? (
        <>
          <RefreshCw aria-hidden="true" className="size-4" /> Connexion rétablie : données actualisées.
        </>
      ) : (
        <>
          <CloudOff aria-hidden="true" className="size-4" />
          {blocked
            ? "Hors ligne : rien n'a été enregistré. Réessayez une fois reconnecté."
            : "Hors ligne : les données affichées peuvent être obsolètes."}
        </>
      )}
    </div>
  );
}

/**
 * Après déconnexion : vide les caches du navigateur et du service worker (§16.2, §20.8)
 * et désabonne l'appareil des notifications push (plus rien n'arrive sur un appareil déconnecté).
 */
export function PurgeOnSignOut() {
  useEffect(() => {
    const purge = async () => {
      try {
        const registration = await navigator.serviceWorker?.getRegistration("/");
        await (await registration?.pushManager?.getSubscription())?.unsubscribe();
      } catch {
        // Navigateur sans notifications push : rien à désabonner.
      }
      try {
        if ("caches" in window) for (const key of await caches.keys()) await caches.delete(key);
        navigator.serviceWorker?.controller?.postMessage({ type: "purge" });
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // Navigateur sans stockage accessible : rien à purger.
      }
    };
    void purge();
  }, []);
  return null;
}
