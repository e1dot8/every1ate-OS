import "server-only";

/**
 * À IMPLÉMENTER (module Discussions) : publie un message du QG (sans auteur) dans le salon du
 * projet, ou dans #général quand l'événement n'a pas de projet.
 */
export async function postSystemMessage(input: {
  projectId: string | null;
  text: string;
  href?: string;
}): Promise<void> {
  void input;
}
