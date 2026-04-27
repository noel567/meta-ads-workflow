/**
 * Composite Ad Renderer
 * Erstellt professionelle Meta Ads im FredTrading-Stil:
 * - Livio-Foto als Hauptelement (rechts oder Hintergrund)
 * - Headline + Subtext + Bullet Points als Text-Overlay
 * - EasySignals Branding (Logo + Name)
 * - 4 Templates: fredtrading, news, split, luxury
 */

import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import sharp from "sharp";

export type AdTemplate = "fredtrading" | "news" | "split" | "luxury";

export interface CompositeAdInput {
  photoUrl: string;           // Livio-Foto URL
  headline: string;           // Haupt-Headline (z.B. "KOSTENLOSER TRADING KURS")
  subheadline?: string;       // Unter-Headline (z.B. "Lerne in nur einem Abend...")
  bullets?: string[];         // Bullet Points (max 3)
  cta?: string;               // Call to Action (z.B. "Jetzt kostenlos anmelden")
  template: AdTemplate;
  accentColor?: string;       // Akzentfarbe (hex, default: #22c55e = EasySignals Grün)
  logoUrl?: string;           // Logo URL
}

const CANVAS_SIZE = 1080; // 1:1 Format für Instagram/Facebook

// Hilfsfunktion: Text umbrechen
function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Hilfsfunktion: Bild von URL laden
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image: ${url}`);
  return Buffer.from(await resp.arrayBuffer());
}

// Hilfsfunktion: Bild auf Größe bringen
async function resizeImage(buffer: Buffer, width: number, height: number, fit: "cover" | "contain" = "cover"): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, { fit, position: "top" })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Template 1: FredTrading-Stil
 * - Obere Hälfte: Dunkler Hintergrund mit großer Headline + Subtext + Bullets
 * - Untere Hälfte: Livio-Foto rechts, Bullets links
 * - Branding unten links
 */
async function renderFredtradingTemplate(input: CompositeAdInput): Promise<Buffer> {
  const size = CANVAS_SIZE;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const accent = input.accentColor ?? "#22c55e";

  // --- Hintergrund: Dunkel mit Gradient ---
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "#0a0a0a");
  grad.addColorStop(0.5, "#111111");
  grad.addColorStop(1, "#0d0d0d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // --- Livio-Foto rechts (untere 60%) ---
  try {
    const photoBuffer = await fetchImageBuffer(input.photoUrl);
    const photoResized = await resizeImage(photoBuffer, 580, 680, "cover");
    const photoImg = await loadImage(photoResized);
    // Foto rechts positionieren
    ctx.save();
    ctx.drawImage(photoImg, size - 580, size - 680, 580, 680);
    // Gradient über das Foto (links und oben abdunkeln)
    const photoGradLeft = ctx.createLinearGradient(size - 580, 0, size - 100, 0);
    photoGradLeft.addColorStop(0, "rgba(10,10,10,1)");
    photoGradLeft.addColorStop(0.4, "rgba(10,10,10,0.7)");
    photoGradLeft.addColorStop(1, "rgba(10,10,10,0)");
    ctx.fillStyle = photoGradLeft;
    ctx.fillRect(size - 580, size - 680, 580, 680);

    const photoGradTop = ctx.createLinearGradient(0, size - 680, 0, size - 480);
    photoGradTop.addColorStop(0, "rgba(10,10,10,1)");
    photoGradTop.addColorStop(1, "rgba(10,10,10,0)");
    ctx.fillStyle = photoGradTop;
    ctx.fillRect(size - 580, size - 680, 580, 200);
    ctx.restore();
  } catch (e) {
    console.error("[CompositeAd] Photo load failed:", e);
  }

  // --- Accent-Bar oben ---
  ctx.fillStyle = accent;
  ctx.fillRect(60, 60, 8, 120);

  // --- Headline ---
  const headlineLines = input.headline.toUpperCase().split("\n");
  let yPos = 80;
  ctx.font = "bold 72px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  for (const line of headlineLines) {
    const wrapped = wrapText(ctx, line, 640);
    for (const wl of wrapped) {
      ctx.fillText(wl, 80, yPos);
      yPos += 80;
    }
  }

  // --- Subheadline ---
  if (input.subheadline) {
    yPos += 10;
    ctx.font = "400 36px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    const subLines = wrapText(ctx, input.subheadline, 600);
    for (const line of subLines) {
      ctx.fillText(line, 80, yPos);
      yPos += 46;
    }
  }

  // --- Trennlinie ---
  yPos += 20;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, yPos);
  ctx.lineTo(500, yPos);
  ctx.stroke();
  yPos += 30;

  // --- Bullet Points ---
  if (input.bullets && input.bullets.length > 0) {
    ctx.font = "500 30px sans-serif";
    for (const bullet of input.bullets.slice(0, 3)) {
      // Bullet-Hintergrund
      ctx.fillStyle = "rgba(34,197,94,0.12)";
      ctx.beginPath();
      ctx.roundRect(80, yPos - 24, 480, 46, 8);
      ctx.fill();
      // Bullet-Icon
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(104, yPos - 2, 6, 0, Math.PI * 2);
      ctx.fill();
      // Bullet-Text
      ctx.fillStyle = "#ffffff";
      ctx.fillText(bullet, 124, yPos + 8);
      yPos += 58;
    }
  }

  // --- CTA Button ---
  if (input.cta) {
    yPos += 20;
    const ctaWidth = 400;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(80, yPos, ctaWidth, 60, 12);
    ctx.fill();
    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.fillText(input.cta, 80 + ctaWidth / 2, yPos + 38);
    ctx.textAlign = "left";
  }

  // --- Branding unten links ---
  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText("EasySignals", 80, size - 50);
  ctx.font = "300 22px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("Automatisiertes Trading", 80, size - 22);

  // --- Livio-Name unten rechts (über Foto) ---
  ctx.font = "bold 26px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.fillText("Livio Swiss", size - 40, size - 50);
  ctx.font = "300 20px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("Gründer EasySignals", size - 40, size - 24);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/jpeg", 90);
}

/**
 * Template 2: News-Stil (wie FredTrading Bild 2)
 * - Livio-Foto als Vollbild-Hintergrund
 * - "NEWS" Badge oben links
 * - Großer Text-Block unten (weißer Hintergrund-Streifen)
 */
async function renderNewsTemplate(input: CompositeAdInput): Promise<Buffer> {
  const size = CANVAS_SIZE;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const accent = input.accentColor ?? "#22c55e";

  // --- Livio-Foto als Vollbild ---
  try {
    const photoBuffer = await fetchImageBuffer(input.photoUrl);
    const photoResized = await resizeImage(photoBuffer, size, size, "cover");
    const photoImg = await loadImage(photoResized);
    ctx.drawImage(photoImg, 0, 0, size, size);
  } catch (e) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, size, size);
  }

  // --- Dunkler Gradient unten ---
  const bottomGrad = ctx.createLinearGradient(0, size * 0.45, 0, size);
  bottomGrad.addColorStop(0, "rgba(0,0,0,0)");
  bottomGrad.addColorStop(0.3, "rgba(0,0,0,0.85)");
  bottomGrad.addColorStop(1, "rgba(0,0,0,0.97)");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, 0, size, size);

  // --- NEWS Badge ---
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(60, 60, 160, 56, 8);
  ctx.fill();
  ctx.font = "bold 32px sans-serif";
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.fillText("NEWS", 140, 96);
  ctx.textAlign = "left";

  // --- Headline unten ---
  const textStartY = size * 0.62;
  ctx.font = "bold 58px sans-serif";
  ctx.fillStyle = "#ffffff";
  const headlineLines = wrapText(ctx, input.headline, size - 120);
  let yPos = textStartY;
  for (const line of headlineLines) {
    ctx.fillText(line, 60, yPos);
    yPos += 68;
  }

  // --- Subheadline ---
  if (input.subheadline) {
    yPos += 8;
    ctx.font = "400 32px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    const subLines = wrapText(ctx, input.subheadline, size - 120);
    for (const line of subLines.slice(0, 2)) {
      ctx.fillText(line, 60, yPos);
      yPos += 42;
    }
  }

  // --- Branding ---
  ctx.font = "bold 26px sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText("EasySignals", 60, size - 30);

  return canvas.toBuffer("image/jpeg", 90);
}

/**
 * Template 3: Split-Stil
 * - Linke Hälfte: Dunkler Hintergrund mit Text
 * - Rechte Hälfte: Livio-Foto
 * - Scharfe Trennlinie mit Accent-Farbe
 */
async function renderSplitTemplate(input: CompositeAdInput): Promise<Buffer> {
  const size = CANVAS_SIZE;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const accent = input.accentColor ?? "#22c55e";
  const half = size / 2;

  // --- Linke Hälfte: Dunkler Hintergrund ---
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, half + 20, size);

  // --- Rechte Hälfte: Livio-Foto ---
  try {
    const photoBuffer = await fetchImageBuffer(input.photoUrl);
    const photoResized = await resizeImage(photoBuffer, half + 20, size, "cover");
    const photoImg = await loadImage(photoResized);
    ctx.drawImage(photoImg, half - 20, 0, half + 20, size);
    // Gradient über Foto-Kante
    const edgeGrad = ctx.createLinearGradient(half - 20, 0, half + 60, 0);
    edgeGrad.addColorStop(0, "rgba(10,10,10,1)");
    edgeGrad.addColorStop(1, "rgba(10,10,10,0)");
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(half - 20, 0, 80, size);
  } catch (e) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(half, 0, half, size);
  }

  // --- Accent-Linie ---
  ctx.fillStyle = accent;
  ctx.fillRect(half - 3, 0, 6, size);

  // --- Text links ---
  let yPos = 100;
  ctx.font = "bold 64px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  const headlineLines = wrapText(ctx, input.headline.toUpperCase(), half - 80);
  for (const line of headlineLines) {
    ctx.fillText(line, 50, yPos);
    yPos += 74;
  }

  if (input.subheadline) {
    yPos += 20;
    ctx.font = "400 30px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    const subLines = wrapText(ctx, input.subheadline, half - 80);
    for (const line of subLines) {
      ctx.fillText(line, 50, yPos);
      yPos += 40;
    }
  }

  // Bullets
  if (input.bullets) {
    yPos += 30;
    ctx.font = "500 26px sans-serif";
    for (const b of input.bullets.slice(0, 3)) {
      ctx.fillStyle = accent;
      ctx.fillText("▶", 50, yPos);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(b, 80, yPos);
      yPos += 46;
    }
  }

  // CTA
  if (input.cta) {
    yPos += 20;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(50, yPos, 380, 56, 10);
    ctx.fill();
    ctx.font = "bold 26px sans-serif";
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.fillText(input.cta, 240, yPos + 36);
    ctx.textAlign = "left";
  }

  // Branding
  ctx.font = "bold 24px sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText("EasySignals", 50, size - 30);

  return canvas.toBuffer("image/jpeg", 90);
}

/**
 * Template 4: Luxury-Stil
 * - Gold/Schwarz Farbschema
 * - Livio-Foto zentriert mit Vignette
 * - Elegante Typografie
 */
async function renderLuxuryTemplate(input: CompositeAdInput): Promise<Buffer> {
  const size = CANVAS_SIZE;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const accent = "#c9a227"; // Gold

  // Hintergrund
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, size, size);

  // Livio-Foto zentriert
  try {
    const photoBuffer = await fetchImageBuffer(input.photoUrl);
    const photoResized = await resizeImage(photoBuffer, 700, 700, "cover");
    const photoImg = await loadImage(photoResized);
    ctx.drawImage(photoImg, (size - 700) / 2, (size - 700) / 2 + 50, 700, 700);

    // Radiale Vignette
    const vignette = ctx.createRadialGradient(size / 2, size / 2, 200, size / 2, size / 2, size * 0.7);
    vignette.addColorStop(0, "rgba(5,5,5,0)");
    vignette.addColorStop(0.6, "rgba(5,5,5,0.3)");
    vignette.addColorStop(1, "rgba(5,5,5,0.95)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);
  } catch (e) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, size, size);
  }

  // Goldene Rahmen-Linien
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, size - 60, size - 60);
  ctx.strokeRect(38, 38, size - 76, size - 76);

  // Headline oben
  ctx.font = "bold 56px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  const headlineLines = wrapText(ctx, input.headline.toUpperCase(), size - 160);
  let yPos = 120;
  for (const line of headlineLines) {
    ctx.fillText(line, size / 2, yPos);
    yPos += 66;
  }

  // Gold-Trennlinie
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size / 2 - 150, yPos + 10);
  ctx.lineTo(size / 2 + 150, yPos + 10);
  ctx.stroke();

  // Text unten
  yPos = size - 280;
  if (input.subheadline) {
    ctx.font = "300 30px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    const subLines = wrapText(ctx, input.subheadline, size - 160);
    for (const line of subLines.slice(0, 2)) {
      ctx.fillText(line, size / 2, yPos);
      yPos += 40;
    }
  }

  // Branding
  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText("EasySignals", size / 2, size - 50);
  ctx.font = "300 20px sans-serif";
  ctx.fillStyle = "rgba(201,162,39,0.6)";
  ctx.fillText("Automatisiertes Trading", size / 2, size - 22);

  return canvas.toBuffer("image/jpeg", 90);
}

/**
 * Haupt-Funktion: Rendert eine Composite Ad
 */
export async function renderCompositeAd(input: CompositeAdInput): Promise<Buffer> {
  switch (input.template) {
    case "fredtrading":
      return renderFredtradingTemplate(input);
    case "news":
      return renderNewsTemplate(input);
    case "split":
      return renderSplitTemplate(input);
    case "luxury":
      return renderLuxuryTemplate(input);
    default:
      return renderFredtradingTemplate(input);
  }
}
