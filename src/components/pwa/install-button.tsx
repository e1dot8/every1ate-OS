"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Bouton d'installation (Chrome/Edge/Android). Sur iPhone, l'installation passe par « Partager ». */
export function InstallButton() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const installed = useSyncExternalStore(
    () => () => undefined,
    () => window.matchMedia("(display-mode: standalone)").matches,
    () => false,
  );
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  if (installed)
    return (
      <p className="text-sm font-bold text-success">
        L&apos;application est déjà installée sur cet appareil.
      </p>
    );
  if (!prompt) return null;
  return (
    <Button
      type="button"
      onClick={async () => {
        await prompt.prompt();
        setPrompt(null);
      }}
    >
      <Download aria-hidden="true" /> Installer l&apos;application
    </Button>
  );
}
