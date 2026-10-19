import { Suspense } from "react";
import { AppNav, AppNavShell } from "@/components/nav/app-nav";
import { TopBar } from "@/components/app/top-bar";

/** Zone protégée : chaque page vérifie la session côté serveur (requireUser). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:flex">
      <Suspense fallback={<AppNavShell pathname="" />}>
        <AppNav />
      </Suspense>
      <main
        id="contenu"
        className="mx-auto w-full max-w-5xl min-w-0 px-4 pt-6 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+1.5rem)] md:px-8 md:pb-10"
      >
        <Suspense fallback={<div className="mb-4 h-tap" />}>
          <TopBar />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
