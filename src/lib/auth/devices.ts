/** Libellé lisible d'un appareil à partir de son user-agent (ex. « iPhone · Safari »). */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return "Appareil inconnu";
  const ua = userAgent;
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Appareil";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /(Chrome|CriOS)\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Navigateur";
  return `${device} · ${browser}`;
}

export function isMobileDevice(userAgent: string | null | undefined): boolean {
  return /iPhone|iPad|Android|Mobile/.test(userAgent ?? "");
}

/** « actif maintenant », « il y a 2 heures », « il y a 5 jours ». */
export function formatLastActive(date: Date, now = new Date()): string {
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
  if (minutes < 5) return "actif maintenant";
  if (minutes < 60) return `il y a ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "il y a 1 heure" : `il y a ${hours} heures`;
  const days = Math.round(hours / 24);
  return days === 1 ? "il y a 1 jour" : `il y a ${days} jours`;
}
