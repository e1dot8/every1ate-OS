"use client";

import { useEffect } from "react";

/**
 * À l'ouverture d'un salon : affiche le message ciblé (#m-…) s'il y en a un,
 * sinon les derniers messages (bas de page). Se rejoue quand un message arrive.
 */
export function ScrollToEnd({ marker }: { marker: string }) {
  useEffect(() => {
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.classList.add("bg-highlight/30");
      const timer = setTimeout(() => target.classList.remove("bg-highlight/30"), 2500);
      return () => clearTimeout(timer);
    }
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [marker]);
  return null;
}
