/**
 * Composite Ad Renderer
 * Erstellt professionelle Meta Ads:
 * - Livio-Foto als Hauptelement
 * - Textelemente mit freien Positionen (x/y in %, fontSize)
 * - 4 Templates: fredtrading, news, split, luxury
 */

import { createCanvas, loadImage } from "@napi-rs/canvas";
import sharp from "sharp";

export type AdTemplate = "fredtrading" | "news" | "split" | "luxury";

export type TextElementType = "headline" | "subheadline" | "bullet" | "cta" | "branding" | "custom";

export interface TextElement {
  id: string;
  type: TextElementType;
  text: string;
  // Position in Prozent (0–100) relativ zur Canvas-Größe
  xPct: number;
  yPct: number;
  fontSize: number;        // in px (auf 1080px Canvas)
  color: string;           // hex oder rgba
  bold: boolean;
  align: "left" | "center" | "right";
  bgColor?: string;        // optionaler Hintergrund (z.B. für CTA-Button)
  bgPadding?: number;      // Padding für Hintergrund-Rechteck
  bgRadius?: number;       // Border-Radius für Hintergrund
  bulletIcon?: boolean;    // Bullet-Punkt davor zeichnen
  accentLine?: boolean;    // Vertikale Accent-Linie links
  maxWidthPct?: number;    // Maximale Breite in % (für Zeilenumbruch)
}

export interface CompositeAdInput {
  photoUrl: string;
  template: AdTemplate;
  accentColor?: string;
  // Freie Textelemente (überschreiben Template-Defaults wenn angegeben)
  textElements?: TextElement[];
  // Legacy-Felder (werden zu textElements konvertiert wenn keine textElements angegeben)
  headline?: string;
  subheadline?: string;
  bullets?: string[];
  cta?: string;
}

const CANVAS_SIZE = 1080;

// Default TextElements pro Template
export function getDefaultTextElements(
  template: AdTemplate,
  headline: string,
  subheadline?: string,
  bullets?: string[],
  cta?: string,
  accentColor?: string
): TextElement[] {
  const accent = accentColor ?? "#22c55e";
  const elements: TextElement[] = [];

  if (template === "fredtrading") {
    elements.push({
      id: "headline",
      type: "headline",
      text: headline.toUpperCase(),
      xPct: 7.4,
      yPct: 10,
      fontSize: 72,
      color: "#ffffff",
      bold: true,
      align: "left",
      accentLine: true,
      maxWidthPct: 60,
    });
    if (subheadline) {
      elements.push({
        id: "subheadline",
        type: "subheadline",
        text: subheadline,
        xPct: 7.4,
        yPct: 38,
        fontSize: 34,
        color: "rgba(255,255,255,0.75)",
        bold: false,
        align: "left",
        maxWidthPct: 58,
      });
    }
    if (bullets) {
      bullets.slice(0, 3).forEach((b, i) => {
        elements.push({
          id: `bullet_${i}`,
          type: "bullet",
          text: b,
          xPct: 7.4,
          yPct: 55 + i * 8,
          fontSize: 28,
          color: "#ffffff",
          bold: false,
          align: "left",
          bulletIcon: true,
          bgColor: `${accent}1a`,
          bgPadding: 12,
          bgRadius: 8,
          maxWidthPct: 50,
        });
      });
    }
    if (cta) {
      elements.push({
        id: "cta",
        type: "cta",
        text: cta,
        xPct: 7.4,
        yPct: 81,
        fontSize: 28,
        color: "#000000",
        bold: true,
        align: "center",
        bgColor: accent,
        bgPadding: 18,
        bgRadius: 12,
        maxWidthPct: 40,
      });
    }
    elements.push({
      id: "branding",
      type: "branding",
      text: "EasySignals",
      xPct: 7.4,
      yPct: 95,
      fontSize: 26,
      color: accent,
      bold: true,
      align: "left",
    });
    elements.push({
      id: "name",
      type: "custom",
      text: "Livio Swiss",
      xPct: 92.6,
      yPct: 95,
      fontSize: 24,
      color: "#ffffff",
      bold: true,
      align: "right",
    });
  } else if (template === "news") {
    elements.push({
      id: "news_badge",
      type: "custom",
      text: "NEWS",
      xPct: 5.5,
      yPct: 8.5,
      fontSize: 30,
      color: "#000000",
      bold: true,
      align: "center",
      bgColor: accent,
      bgPadding: 16,
      bgRadius: 8,
    });
    elements.push({
      id: "headline",
      type: "headline",
      text: headline,
      xPct: 5.5,
      yPct: 63,
      fontSize: 56,
      color: "#ffffff",
      bold: true,
      align: "left",
      maxWidthPct: 88,
    });
    if (subheadline) {
      elements.push({
        id: "subheadline",
        type: "subheadline",
        text: subheadline,
        xPct: 5.5,
        yPct: 80,
        fontSize: 30,
        color: "rgba(255,255,255,0.8)",
        bold: false,
        align: "left",
        maxWidthPct: 88,
      });
    }
    elements.push({
      id: "branding",
      type: "branding",
      text: "EasySignals",
      xPct: 5.5,
      yPct: 96,
      fontSize: 24,
      color: accent,
      bold: true,
      align: "left",
    });
  } else if (template === "split") {
    elements.push({
      id: "headline",
      type: "headline",
      text: headline.toUpperCase(),
      xPct: 4.6,
      yPct: 16,
      fontSize: 60,
      color: "#ffffff",
      bold: true,
      align: "left",
      maxWidthPct: 44,
    });
    if (subheadline) {
      elements.push({
        id: "subheadline",
        type: "subheadline",
        text: subheadline,
        xPct: 4.6,
        yPct: 44,
        fontSize: 28,
        color: "rgba(255,255,255,0.7)",
        bold: false,
        align: "left",
        maxWidthPct: 44,
      });
    }
    if (bullets) {
      bullets.slice(0, 3).forEach((b, i) => {
        elements.push({
          id: `bullet_${i}`,
          type: "bullet",
          text: b,
          xPct: 4.6,
          yPct: 58 + i * 8,
          fontSize: 24,
          color: "#ffffff",
          bold: false,
          align: "left",
          bulletIcon: true,
          maxWidthPct: 44,
        });
      });
    }
    if (cta) {
      elements.push({
        id: "cta",
        type: "cta",
        text: cta,
        xPct: 4.6,
        yPct: 84,
        fontSize: 24,
        color: "#000000",
        bold: true,
        align: "center",
        bgColor: accent,
        bgPadding: 16,
        bgRadius: 10,
        maxWidthPct: 40,
      });
    }
    elements.push({
      id: "branding",
      type: "branding",
      text: "EasySignals",
      xPct: 4.6,
      yPct: 96,
      fontSize: 22,
      color: accent,
      bold: true,
      align: "left",
    });
  } else if (template === "luxury") {
    elements.push({
      id: "headline",
      type: "headline",
      text: headline.toUpperCase(),
      xPct: 50,
      yPct: 13,
      fontSize: 54,
      color: "#ffffff",
      bold: true,
      align: "center",
      maxWidthPct: 80,
    });
    if (subheadline) {
      elements.push({
        id: "subheadline",
        type: "subheadline",
        text: subheadline,
        xPct: 50,
        yPct: 76,
        fontSize: 28,
        color: "rgba(255,255,255,0.8)",
        bold: false,
        align: "center",
        maxWidthPct: 80,
      });
    }
    elements.push({
      id: "branding",
      type: "branding",
      text: "EasySignals",
      xPct: 50,
      yPct: 93,
      fontSize: 26,
      color: "#c9a227",
      bold: true,
      align: "center",
    });
  }

  return elements;
}

// Hilfsfunktion: Text umbrechen
function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
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

async function resizeImage(buffer: Buffer, width: number, height: number, fit: "cover" | "contain" = "cover"): Promise<Buffer> {
  return sharp(buffer).resize(width, height, { fit, position: "top" }).jpeg({ quality: 90 }).toBuffer();
}

// Zeichnet ein einzelnes TextElement auf den Canvas
function drawTextElement(ctx: any, el: TextElement, canvasSize: number, accentColor: string) {
  const x = (el.xPct / 100) * canvasSize;
  const y = (el.yPct / 100) * canvasSize;
  const maxWidth = el.maxWidthPct ? (el.maxWidthPct / 100) * canvasSize : canvasSize - x - 40;
  const weight = el.bold ? "bold" : "400";
  ctx.font = `${weight} ${el.fontSize}px sans-serif`;

  // Text-Zeilen berechnen
  const rawLines = el.text.split("\n");
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const wrapped = wrapText(ctx, rawLine, maxWidth);
    lines.push(...wrapped);
  }

  const lineHeight = el.fontSize * 1.25;
  const totalTextHeight = lines.length * lineHeight;

  // Hintergrund-Rechteck (für CTA-Button oder Bullet-BG)
  if (el.bgColor) {
    const pad = el.bgPadding ?? 10;
    const radius = el.bgRadius ?? 6;
    let bgX = x - pad;
    let bgY = y - el.fontSize - pad;
    let bgW: number;
    let bgH = totalTextHeight + pad * 2;

    if (el.align === "center") {
      // Breite = längste Zeile
      let maxLineW = 0;
      for (const line of lines) {
        const w = ctx.measureText(line).width;
        if (w > maxLineW) maxLineW = w;
      }
      bgW = maxLineW + pad * 2;
      bgX = x - bgW / 2;
    } else {
      let maxLineW = 0;
      for (const line of lines) {
        const w = ctx.measureText(line).width;
        if (w > maxLineW) maxLineW = w;
      }
      bgW = maxLineW + pad * 2 + (el.bulletIcon ? 30 : 0);
    }

    ctx.fillStyle = el.bgColor;
    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgW, bgH, radius);
    ctx.fill();
  }

  // Vertikale Accent-Linie links
  if (el.accentLine) {
    ctx.fillStyle = accentColor;
    ctx.fillRect(x - 20, y - el.fontSize - 10, 8, totalTextHeight + 20);
  }

  // Text zeichnen
  ctx.textAlign = el.align;
  let currentY = y;
  for (const line of lines) {
    let drawX = x;
    if (el.bulletIcon) {
      // Bullet-Icon
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(drawX + 6, currentY - el.fontSize * 0.25, el.fontSize * 0.2, 0, Math.PI * 2);
      ctx.fill();
      drawX += el.fontSize * 0.7;
      ctx.textAlign = "left";
    }
    ctx.fillStyle = el.color;
    ctx.fillText(line, drawX, currentY);
    currentY += lineHeight;
  }
  ctx.textAlign = "left"; // Reset
}

// Hintergrund + Foto für jedes Template rendern
async function renderBackground(ctx: any, template: AdTemplate, photoUrl: string, accentColor: string, size: number) {
  if (template === "fredtrading") {
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, "#0a0a0a");
    grad.addColorStop(0.5, "#111111");
    grad.addColorStop(1, "#0d0d0d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    try {
      const photoBuffer = await fetchImageBuffer(photoUrl);
      const photoResized = await resizeImage(photoBuffer, 580, 680, "cover");
      const photoImg = await loadImage(photoResized);
      ctx.drawImage(photoImg, size - 580, size - 680, 580, 680);
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
    } catch (e) { console.error("[CompositeAd] Photo load failed:", e); }
  } else if (template === "news") {
    try {
      const photoBuffer = await fetchImageBuffer(photoUrl);
      const photoResized = await resizeImage(photoBuffer, size, size, "cover");
      const photoImg = await loadImage(photoResized);
      ctx.drawImage(photoImg, 0, 0, size, size);
    } catch (e) { ctx.fillStyle = "#111"; ctx.fillRect(0, 0, size, size); }
    const bottomGrad = ctx.createLinearGradient(0, size * 0.45, 0, size);
    bottomGrad.addColorStop(0, "rgba(0,0,0,0)");
    bottomGrad.addColorStop(0.3, "rgba(0,0,0,0.85)");
    bottomGrad.addColorStop(1, "rgba(0,0,0,0.97)");
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, 0, size, size);
  } else if (template === "split") {
    const half = size / 2;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, half + 20, size);
    try {
      const photoBuffer = await fetchImageBuffer(photoUrl);
      const photoResized = await resizeImage(photoBuffer, half + 20, size, "cover");
      const photoImg = await loadImage(photoResized);
      ctx.drawImage(photoImg, half - 20, 0, half + 20, size);
      const edgeGrad = ctx.createLinearGradient(half - 20, 0, half + 60, 0);
      edgeGrad.addColorStop(0, "rgba(10,10,10,1)");
      edgeGrad.addColorStop(1, "rgba(10,10,10,0)");
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(half - 20, 0, 80, size);
    } catch (e) { ctx.fillStyle = "#1a1a1a"; ctx.fillRect(half, 0, half, size); }
    ctx.fillStyle = accentColor;
    ctx.fillRect(half - 3, 0, 6, size);
  } else if (template === "luxury") {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, size, size);
    try {
      const photoBuffer = await fetchImageBuffer(photoUrl);
      const photoResized = await resizeImage(photoBuffer, 700, 700, "cover");
      const photoImg = await loadImage(photoResized);
      ctx.drawImage(photoImg, (size - 700) / 2, (size - 700) / 2 + 50, 700, 700);
      const vignette = ctx.createRadialGradient(size / 2, size / 2, 200, size / 2, size / 2, size * 0.7);
      vignette.addColorStop(0, "rgba(5,5,5,0)");
      vignette.addColorStop(0.6, "rgba(5,5,5,0.3)");
      vignette.addColorStop(1, "rgba(5,5,5,0.95)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, size, size);
    } catch (e) { ctx.fillStyle = "#111"; ctx.fillRect(0, 0, size, size); }
    // Goldene Rahmen
    const gold = "#c9a227";
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, size - 60, size - 60);
    ctx.strokeRect(38, 38, size - 76, size - 76);
  }
}

/**
 * Haupt-Funktion: Rendert eine Composite Ad mit freien Textpositionen
 */
export async function renderCompositeAd(input: CompositeAdInput): Promise<Buffer> {
  const size = CANVAS_SIZE;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const accent = input.accentColor ?? "#22c55e";

  // Hintergrund + Foto rendern
  await renderBackground(ctx, input.template, input.photoUrl, accent, size);

  // TextElements bestimmen: entweder aus input.textElements oder aus Legacy-Feldern generieren
  const elements = input.textElements && input.textElements.length > 0
    ? input.textElements
    : getDefaultTextElements(
        input.template,
        input.headline ?? "",
        input.subheadline,
        input.bullets,
        input.cta,
        accent
      );

  // Alle Textelemente zeichnen
  for (const el of elements) {
    drawTextElement(ctx, el, size, accent);
  }

  return canvas.toBuffer("image/jpeg", 90);
}
