import { cn } from "@/lib/utils";

/**
 * Bannière de marque (lot G8) : la vidéo « WOK » en noir et blanc, en boucle et muette.
 * Purement décorative ; si l'utilisateur réduit les animations, seule l'image fixe s'affiche.
 */
export function WokBanner({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-ink", className)}>
      <video
        aria-hidden="true"
        className="absolute inset-0 size-full object-cover motion-reduce:hidden"
        src="/brand/wok/wok.mp4"
        poster="/brand/wok/wok-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- image fixe de repli */}
      <img
        aria-hidden="true"
        alt=""
        src="/brand/wok/wok-poster.jpg"
        className="absolute inset-0 hidden size-full object-cover motion-reduce:block"
      />
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
}
