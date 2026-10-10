// Vérifie qu'aucun secret ni URL de base de données ne fuit dans le code envoyé au navigateur.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = ".next/static";
const forbidden = [
  /postgres(ql)?:\/\/[^"'\s]+/i,
  /DATABASE_URL/,
  /DIRECT_DATABASE_URL/,
  /RESEND_API_KEY/,
  /BETTER_AUTH_SECRET/,
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(js|css|html|json|txt)$/.test(entry.name)) yield path;
  }
}

let files = 0;
const leaks = [];
try {
  for await (const file of walk(root)) {
    files += 1;
    const content = await readFile(file, "utf8");
    for (const pattern of forbidden) if (pattern.test(content)) leaks.push(`${file} → ${pattern}`);
  }
} catch {
  console.error(`Dossier ${root} introuvable : lancer « pnpm build » d'abord.`);
  process.exit(1);
}

if (leaks.length) {
  console.error("Fuite potentielle de secret dans le bundle client :\n" + leaks.join("\n"));
  process.exit(1);
}
console.log(`Bundle client vérifié : ${files} fichiers, aucun secret détecté.`);
