/**
 * Règles pures des alertes hors application (push, WhatsApp) : textes, adresses,
 * limite d'envoi, parallélisme. Aucun accès réseau ni base : testées unitairement.
 */

// ─── Statuts du journal `external_delivery` ────────────────────────────────────

export const DELIVERY_STATUSES = ["envoye", "echec", "outbox", "ignore_focus", "limite"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  envoye: "Envoyé",
  echec: "Échec",
  outbox: "Mode test (rien n'est parti)",
  ignore_focus: "Non envoyé : focus ou absence",
  limite: "Non envoyé : limite horaire atteinte",
};

export const channelLabels: Record<string, string> = { push: "Push", whatsapp: "WhatsApp" };

export function deliveryStatusLabel(status: string): string {
  return (deliveryStatusLabels as Record<string, string>)[status] ?? status;
}

// ─── Textes ────────────────────────────────────────────────────────────────────

const ELLIPSIS = "…";

/** Coupe proprement (sans casser un emoji, de préférence entre deux mots) à `max` caractères. */
export function truncateText(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  if (max <= 1) return max === 1 ? ELLIPSIS : "";
  const cut = chars.slice(0, max - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace >= Math.floor((max - 1) * 0.7) ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}${ELLIPSIS}`;
}

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();
const length = (value: string) => Array.from(value).length;

/** Lien absolu vers l'app (uniquement les chemins internes « /… »). */
export function appLink(appUrl: string, href: string | undefined): string | null {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null;
  return `${appUrl.replace(/\/$/, "")}${href}`;
}

export const WHATSAPP_MAX_CHARS = 900;

/**
 * Message WhatsApp : `titre\ncorps\nlien`, au plus `max` caractères. Le lien n'est jamais coupé ;
 * on raccourcit d'abord le corps, puis le titre.
 */
export function buildWhatsappText(
  input: { title: string; body?: string; href?: string },
  appUrl: string,
  max = WHATSAPP_MAX_CHARS,
): string {
  const link = appLink(appUrl, input.href);
  let title = oneLine(input.title);
  let body = input.body?.trim() ?? "";
  const fixed = link ? length(link) + 1 : 0;
  const titleRoom = Math.max(1, max - fixed);
  if (length(title) > titleRoom) title = truncateText(title, titleRoom);
  const bodyRoom = max - fixed - length(title) - 1;
  if (body && bodyRoom < 2) body = "";
  else if (body && length(body) > bodyRoom) body = truncateText(body, bodyRoom);
  return [title, body, link].filter(Boolean).join("\n");
}

// ─── WhatsApp (CallMeBot) ──────────────────────────────────────────────────────

export const CALLMEBOT_ENDPOINT = "https://api.callmebot.com/whatsapp.php";
export const CALLMEBOT_ACTIVATION_URL = "https://www.callmebot.com/blog/free-api-whatsapp-messages/";
export const CALLMEBOT_ACTIVATION_MESSAGE = "I allow callmebot to send me messages";

/** URL d'envoi CallMeBot. Elle contient la clé : ne jamais la journaliser ni l'afficher. */
export function buildCallMeBotUrl(input: { phone: string; text: string; apikey: string }): string {
  const query = [
    `phone=${encodeURIComponent(input.phone)}`,
    `text=${encodeURIComponent(input.text)}`,
    `apikey=${encodeURIComponent(input.apikey)}`,
  ].join("&");
  return `${CALLMEBOT_ENDPOINT}?${query}`;
}

/**
 * Numéro au format international (E.164) : « +33 6 12 34 56 78 », « 0033612345678 » → « +33612345678 ».
 * Renvoie null pour un numéro national (« 06… ») ou invalide.
 */
export function normalizePhone(input: string): string | null {
  const compact = input.trim().replace(/[\s.\-()/]/g, "");
  const withPlus = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  return /^\+[1-9]\d{7,14}$/.test(withPlus) ? withPlus : null;
}

/** Numéro partiellement masqué (journal, messages) : « +33 ••• 78 ». */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "•••";
  return `+${digits.slice(0, 2)} ••• ${digits.slice(-2)}`;
}

/** Clé CallMeBot : quelques caractères alphanumériques (souvent 6 à 7 chiffres). */
export function isPlausibleApiKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{4,64}$/.test(value.trim());
}

export const WHATSAPP_HOURLY_LIMIT = 20;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Limite d'envoi WhatsApp par associé sur une heure glissante (envois réussis seulement).
 * `retryAt` : moment où une place se libère, si la limite est atteinte.
 */
export function whatsappQuota(
  sentAt: Date[],
  now: Date,
  limit = WHATSAPP_HOURLY_LIMIT,
  windowMs = HOUR_MS,
): { allowed: boolean; remaining: number; retryAt: Date | null } {
  const from = now.getTime() - windowMs;
  const recent = sentAt
    .map((d) => d.getTime())
    .filter((t) => t > from && t <= now.getTime())
    .sort((a, b) => a - b);
  const remaining = Math.max(0, limit - recent.length);
  if (remaining > 0) return { allowed: true, remaining, retryAt: null };
  return { allowed: false, remaining: 0, retryAt: new Date(recent[recent.length - limit] + windowMs) };
}

// ─── Push ──────────────────────────────────────────────────────────────────────

export type PushMessage = { title: string; body: string; href: string; tag: string };

/** Contenu chiffré envoyé au service worker. */
export function buildPushMessage(input: {
  kind: string;
  title: string;
  body?: string;
  href?: string;
}): PushMessage {
  const href = appLink("", input.href) ?? "/";
  return {
    title: truncateText(oneLine(input.title), 120) || "Every1.ate OS",
    body: truncateText(input.body?.trim() ?? "", 300),
    href,
    // Une alerte remplace la précédente sur le même objet (même type, même lien).
    tag: `${input.kind}:${href}`.slice(0, 120),
  };
}

/**
 * Services push des navigateurs (Chrome/Android/Brave/Samsung, Firefox, Safari/iOS, Edge).
 * Le serveur n'envoie jamais de requête vers une autre adresse fournie par le navigateur.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return PUSH_HOSTS.some((host) => host.test(url.hostname));
}

/** Durée de conservation par le service push si l'appareil est éteint. */
export const PUSH_TTL_SECONDS = 24 * 60 * 60;

/** Libellé lisible d'un appareil à partir de son User-Agent (aucune empreinte détaillée). */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iPhone / iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux|CrOS/.test(ua)
            ? "Linux"
            : null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\/|CriOS\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : null;
  if (!os && !browser) return "Appareil";
  return [os, browser].filter(Boolean).join(" · ");
}

// ─── Parallélisme borné ────────────────────────────────────────────────────────

/** Exécute `fn` sur chaque élément, au plus `limit` à la fois ; conserve l'ordre des résultats. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

/** Message d'erreur court, sans URL ni secret. */
export function shortError(message: string): string {
  return truncateText(message.replace(/https?:\/\/\S+/g, "[url]"), 160);
}
