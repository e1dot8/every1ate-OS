import type { NextConfig } from "next";

// En-têtes de sécurité appliqués à toutes les réponses.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

// CSP (production) : aucune ressource externe ; polices auto-hébergées (next/font).
// 'unsafe-inline' reste nécessaire aux scripts d'hydratation de Next.js sans nonce ;
// les scripts externes, objets, cadres et envois de formulaires vers d'autres origines sont bloqués.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");
if (process.env.NODE_ENV === "production")
  securityHeaders.push({ key: "Content-Security-Policy", value: contentSecurityPolicy });

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // Imports CSV/Excel jusqu'à 5 Mo (contrôlés côté serveur) ; marge pour l'encodage multipart.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Lot G7 : les espaces ont été renommés ; les anciennes adresses restent valides.
  async redirects() {
    return [
      { source: "/atelier", destination: "/cuisine", permanent: false },
      { source: "/crm/cuisine", destination: "/crm/salle", permanent: false },
      { source: "/menu-semaine", destination: "/service", permanent: false },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Après déconnexion : le navigateur efface caches et stockage local de l'origine.
      {
        source: "/connexion",
        has: [{ type: "query", key: "deconnecte" }],
        headers: [{ key: "Clear-Site-Data", value: '"cache", "storage"' }],
      },
    ];
  },
};

export default nextConfig;
