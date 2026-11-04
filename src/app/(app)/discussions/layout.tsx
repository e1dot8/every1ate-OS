import { LiveRefresh } from "@/features/discussions/components/live-refresh";

/** Zone Discussions : rafraîchissement économe partagé par toutes ses pages. */
export default function DiscussionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <LiveRefresh />
    </>
  );
}
