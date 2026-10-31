import { AppNav } from "@/components/nav/app-nav";
import { unreadCount } from "@/features/notifications/service";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

/** Rail alimenté côté serveur : tâches ouvertes et courrier non lu de l'associé connecté. */
export async function NavWithData({ footer }: { footer?: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <AppNav footer={footer} />;
  const [open, unread] = await Promise.all([
    getDb().task.count({
      where: { ownerId: user.id, archivedAt: null, status: { notIn: ["TERMINE", "ANNULE"] } },
    }),
    unreadCount(user.id),
  ]);
  return <AppNav footer={footer} badges={{ "/taches": open, "/notifications": unread }} />;
}
