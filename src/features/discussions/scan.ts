import "server-only";

/** À IMPLÉMENTER (module Discussions) : envoie les rappels et les messages programmés arrivés à échéance. */
export async function runDiscussionsScan(now: Date): Promise<{ reminders: number; scheduled: number }> {
  void now;
  return { reminders: 0, scheduled: 0 };
}
