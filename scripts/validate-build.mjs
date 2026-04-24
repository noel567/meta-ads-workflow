/**
 * Build-Validierung: Prüft ob alle erforderlichen Assets nach dem Build vorhanden sind.
 * Wird automatisch nach `pnpm build` ausgeführt.
 */

import { existsSync, statSync } from "fs";
import { join } from "path";

const DIST_DIR = join(process.cwd(), "dist");

// Alle erforderlichen Dateien und Verzeichnisse
const REQUIRED_ASSETS = [
  // Server-Bundle
  { path: "dist/index.js", description: "Server-Bundle (esbuild output)" },

  // Frontend-Bundle
  { path: "dist/public/index.html", description: "Frontend HTML (Vite output)" },

  // Fonts (für createQuoteImage)
  { path: "dist/fonts/Cinzel.ttf", description: "Cinzel Font (Quote-Badge)" },
  { path: "dist/fonts/PlayfairDisplay.ttf", description: "PlayfairDisplay Font (Quote-Text)" },
  { path: "dist/fonts/PlayfairDisplay-Italic.ttf", description: "PlayfairDisplay Italic Font (Quote-Text kursiv)" },

  // Assets (für createQuoteImage)
  { path: "dist/assets/logo_white.png", description: "EasySignals Logo (Quote-Bild)" },
];

// Mindestgrössen in Bytes (verhindert leere/korrupte Dateien)
const MIN_SIZES = {
  "dist/fonts/Cinzel.ttf": 50_000,
  "dist/fonts/PlayfairDisplay.ttf": 100_000,
  "dist/fonts/PlayfairDisplay-Italic.ttf": 100_000,
  "dist/assets/logo_white.png": 1_000,
  "dist/index.js": 10_000,
  "dist/public/index.html": 100,
};

let hasErrors = false;
let hasWarnings = false;

console.log("\n🔍 Build-Validierung wird gestartet...\n");

for (const { path: relPath, description } of REQUIRED_ASSETS) {
  const fullPath = join(process.cwd(), relPath);

  if (!existsSync(fullPath)) {
    console.error(`  ❌ FEHLT:   ${relPath}`);
    console.error(`              → ${description}`);
    hasErrors = true;
    continue;
  }

  const size = statSync(fullPath).size;
  const minSize = MIN_SIZES[relPath];

  if (minSize && size < minSize) {
    console.warn(`  ⚠️  ZU KLEIN: ${relPath} (${size} Bytes, erwartet ≥ ${minSize} Bytes)`);
    console.warn(`              → ${description}`);
    hasWarnings = true;
    continue;
  }

  const sizeStr = size > 1_000_000
    ? `${(size / 1_000_000).toFixed(1)} MB`
    : size > 1_000
    ? `${(size / 1_000).toFixed(0)} KB`
    : `${size} B`;

  console.log(`  ✅ OK:       ${relPath} (${sizeStr})`);
}

console.log("");

if (hasErrors) {
  console.error("❌ Build-Validierung FEHLGESCHLAGEN – fehlende Assets wurden gefunden.");
  console.error("   Stelle sicher dass server/fonts/ und server/assets/ vorhanden sind.");
  console.error("   Führe 'pnpm build' erneut aus oder prüfe das Build-Script in package.json.\n");
  process.exit(1);
} else if (hasWarnings) {
  console.warn("⚠️  Build-Validierung mit WARNUNGEN abgeschlossen.");
  console.warn("   Einige Dateien sind kleiner als erwartet – bitte prüfen.\n");
  process.exit(0);
} else {
  console.log("✅ Build-Validierung erfolgreich – alle Assets vorhanden.\n");
  process.exit(0);
}
