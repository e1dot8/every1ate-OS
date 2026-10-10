/** Écrans publics (connexion, invitation, mot de passe) : carte centrée sur fond crème. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-background px-6 pt-16 pb-8 md:items-center md:bg-cream md:p-8">
      <main
        id="contenu"
        className="flex w-full max-w-md flex-col gap-6 md:rounded-xl md:border md:bg-card md:p-9"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- logotype vectoriel statique */}
        <img
          src="/brand/every1ate.svg"
          alt="EVERY1.ATE"
          width={140}
          height={21}
          className="h-auto w-[140px]"
        />
        {children}
      </main>
    </div>
  );
}
