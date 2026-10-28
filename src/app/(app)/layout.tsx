import { Suspense } from "react";
import { AppNavShell } from "@/components/nav/app-nav";
import { NavWithData } from "@/components/nav/nav-with-data";
import { TopBar } from "@/components/app/top-bar";
import { RailProfile } from "@/components/nav/rail-profile";

/**
 * Zone protégée : chaque page vérifie la session côté serveur (requireUser).
 * Sur ordinateur, le rail et le contenu sont des panneaux posés sur un fond gris chaud (lot G8).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:flex md:gap-3 md:p-3">
      <Suspense fallback={<AppNavShell pathname="" />}>
        <NavWithData
          footer={
            <Suspense>
              <RailProfile />
            </Suspense>
          }
        />
      </Suspense>
      <main
        id="contenu"
        className="mx-auto w-full max-w-6xl min-w-0 px-4 pt-5 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+1.5rem)] md:px-6 md:pt-4 md:pb-8"
      >
        <Suspense fallback={<div className="mb-4 h-tap" />}>
          <TopBar />
        </Suspense>
        {children}
      </main>
    </div>
  );
}
