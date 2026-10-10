/**
 * Règles pures du calendrier (§11) et des références Drive (§12) : fuseau horaire,
 * conflits, visibilité occupé/libre, génération ICS. Testées unitairement.
 */
export const TZ = "Europe/Paris";

function offsetMinutes(date: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/**
 * « 2026-10-25T02:30 » (heure de Paris) → instant UTC.
 * Heure inexistante (passage à l'heure d'été) : décalée après le saut ; heure ambiguë
 * (passage à l'heure d'hiver) : première occurrence.
 */
export function zonedToUtc(local: string, tz = TZ): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(naive);
  if (check.getUTCDate() !== d || check.getUTCMonth() !== mo - 1) return null;
  const candidates = [
    offsetMinutes(new Date(naive - 3 * 3600_000), tz),
    offsetMinutes(new Date(naive + 3 * 3600_000), tz),
  ];
  for (const off of [Math.max(...candidates), Math.min(...candidates)]) {
    const t = new Date(naive - off * 60_000);
    if (offsetMinutes(t, tz) === off) return t;
  }
  // Heure inexistante : on applique le décalage d'avant le saut (02:30 → 03:30).
  return new Date(naive - Math.min(...candidates) * 60_000);
}

/** Instant → valeur d'un champ datetime-local en heure de Paris. */
export function utcToLocalInput(date: Date, tz = TZ): string {
  const shifted = new Date(date.getTime() + offsetMinutes(date, tz) * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/** Jour calendaire (Paris) d'un instant, à minuit UTC. */
export function localDay(date: Date, tz = TZ): string {
  return utcToLocalInput(date, tz).slice(0, 10);
}

export type Slot = { id: string; startsAt: Date; endsAt: Date; people: string[] };

export const overlaps = (a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) =>
  a.startsAt < b.endsAt && b.startsAt < a.endsAt;

/** Conflits : créneaux qui se chevauchent et partagent au moins une personne. */
export function findConflicts(event: Slot, others: Slot[]) {
  return others.filter(
    (o) => o.id !== event.id && overlaps(event, o) && o.people.some((p) => event.people.includes(p)),
  );
}

export type EventForViewer = {
  ownerId: string;
  attendeeIds: string[];
  visibility: "OCCUPE" | "PARTAGE";
  title: string;
  description: string | null;
  location: string | null;
};

/** Ce qu'un associé voit d'un événement : détails seulement s'il y participe ou s'ils sont partagés. */
export function viewFor<T extends EventForViewer>(event: T, viewerId: string) {
  const involved = event.ownerId === viewerId || event.attendeeIds.includes(viewerId);
  if (involved || event.visibility === "PARTAGE") return { ...event, busyOnly: false as const };
  return { ...event, title: "Occupé", description: null, location: null, busyOnly: true as const };
}

// ─── ICS (RFC 5545) ─────────────────────────────────────────────────────────

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  summary: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  updated: Date;
};

const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const dayStamp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

/** Replie les lignes à 75 octets (UTF-8) comme l'exige la norme. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    const limit = out.length ? 74 : 75;
    if (bytes.encode(current + ch).length > limit) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(name: string, events: IcsEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Every1.ate//OS//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    `X-WR-TIMEZONE:${TZ}`,
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utcStamp(e.updated)}`);
    if (e.allDay)
      lines.push(`DTSTART;VALUE=DATE:${dayStamp(e.start)}`, `DTEND;VALUE=DATE:${dayStamp(e.end)}`);
    else lines.push(`DTSTART:${utcStamp(e.start)}`, `DTEND:${utcStamp(e.end)}`);
    lines.push(`SUMMARY:${esc(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ─── Google Drive ───────────────────────────────────────────────────────────

/** Reconnaît un lien Google Drive/Docs et en extrait l'identifiant et le type. */
export function parseDriveUrl(raw: string): { externalId: string; kind: "DOCUMENT" | "DOSSIER" } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !/(^|\.)google\.com$/.test(u.hostname)) return null;
  const folder = /\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,})/.exec(u.pathname);
  if (folder) return { externalId: folder[1], kind: "DOSSIER" };
  const file =
    /\/(?:file|document|spreadsheets|presentation|forms|drawings)\/(?:u\/\d+\/)?d\/([\w-]{10,})/.exec(
      u.pathname,
    );
  if (file) return { externalId: file[1], kind: "DOCUMENT" };
  const id = u.searchParams.get("id");
  if (id && /^[\w-]{10,}$/.test(id)) return { externalId: id, kind: "DOCUMENT" };
  return null;
}
