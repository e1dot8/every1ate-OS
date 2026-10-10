/**
 * Montants : manipulés en centimes entiers (jamais de flottant binaire pour les calculs),
 * stockés en Decimal(12,2) en base et échangés sous forme de chaîne « 1234.56 ».
 */

/** « 1 234,56 € », « 1234.5 », « 12 000 » → centimes. null si illisible ou négatif. */
export function parseMoney(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const v = raw.replace(/[\s  €]/g, "").replace(",", ".");
  if (!v) return null;
  const m = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(v);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** Decimal Prisma, chaîne ou nombre → centimes (lecture exacte de la représentation décimale). */
export function toCents(value: { toString(): string } | string | null | undefined): number {
  if (value == null) return 0;
  const s = value.toString();
  const negative = s.startsWith("-");
  const [int, frac = ""] = s.replace("-", "").split(".");
  const cents = Number(int) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
  return negative ? -cents : cents;
}

/** Centimes → chaîne décimale pour Prisma (« 1234.56 »). */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Centimes → « 1 234,56 € » (ou sans décimales si `round`). */
export function formatMoney(cents: number, opts: { round?: boolean } = {}): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: opts.round ? 0 : 2,
    maximumFractionDigits: opts.round ? 0 : 2,
  }).format(cents / 100);
}

/** Part d'un montant, arrondie au centime (ex. pondération par une probabilité en %). */
export function percentOf(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

/** Valeur Decimal → saisie de formulaire (« 1250,5 » → « 1250,50 »), vide si nulle. */
export function moneyInput(value: { toString(): string } | null | undefined): string {
  return value == null ? "" : centsToDecimal(toCents(value)).replace(".", ",");
}
