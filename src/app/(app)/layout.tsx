import { AppNav } from "@/components/nav/app-nav";

/** Zone protégée : chaque page vérifie la session côté serveur (requireUser). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:flex">
      <AppNav />
      <main
        id="contenu"
        className="mx-auto w-full max-w-5xl px-4 pt-6 pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+1.5rem)] md:px-8 md:pb-10"
      >
        {children}
      </main>
    </div>
  );
}
