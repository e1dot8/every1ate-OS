import "server-only";
import { getDb } from "@/lib/db/client";

/** Entreprises avec leurs contacts, pour les listes déroulantes. */
export async function clientOptions() {
  const clients = await getDb().client.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      contacts: {
        where: { archivedAt: null },
        orderBy: { lastName: "asc" },
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
  return clients.map((c) => ({
    value: c.id,
    label: c.name,
    contacts: c.contacts.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` })),
  }));
}
