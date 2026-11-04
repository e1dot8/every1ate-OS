"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const INTERVAL_MS = 20_000;

/**
 * Rafraîchissement économe : seulement quand l'onglet est visible, une petite requête toutes les
 * 20 s (GET /api/discussions/etat) ; la page n'est rechargée que si le marqueur d'activité change.
 * Aucun service payant ni connexion permanente.
 */
export function LiveRefresh() {
  const router = useRouter();
  const last = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let inFlight = false;

    const poll = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const res = await fetch("/api/discussions/etat", { cache: "no-store", credentials: "same-origin" });
        if (res.ok) {
          const { marker } = (await res.json()) as { marker?: string };
          if (marker) {
            if (last.current !== null && last.current !== marker) router.refresh();
            last.current = marker;
          }
        }
      } catch {
        // Hors ligne : on réessaiera au prochain passage.
      } finally {
        inFlight = false;
      }
    };
    const schedule = () => {
      if (stopped) return;
      timer = setTimeout(async () => {
        await poll();
        schedule();
      }, INTERVAL_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };

    void poll();
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
