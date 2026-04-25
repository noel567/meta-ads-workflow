/**
 * EasySignals Quote of the Day – Node.js Image Generator
 * Replaces the Python/Pillow version for production compatibility.
 * Uses @napi-rs/canvas for 2D drawing and sharp for image processing.
 */
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { createHash } from "crypto";

const SIZE = 1080;

// Colors
const GOLD: [number, number, number] = [212, 175, 55];
const GOLD_LIGHT: [number, number, number] = [255, 215, 80];
const WHITE: [number, number, number] = [255, 255, 255];
const BG_DARK: [number, number, number] = [5, 18, 12];

// Use paths relative to this file so they work in both dev and production
const _serverDir = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(_serverDir, "fonts");
const LOGO_PATH = join(_serverDir, "assets", "logo_white.png");

function rgba(r: number, g: number, b: number, a = 1): string {
  return `rgba(${r},${g},${b},${a})`;
}
function rgb(c: [number, number, number]): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function registerFonts() {
  const fonts = [
    { file: "Cinzel.ttf", family: "Cinzel" },
    { file: "PlayfairDisplay.ttf", family: "PlayfairDisplay" },
    { file: "PlayfairDisplay-Italic.ttf", family: "PlayfairDisplayItalic" },
  ];
  for (const { file, family } of fonts) {
    const path = join(FONT_DIR, file);
    if (existsSync(path)) {
      GlobalFonts.registerFromPath(path, family);
    }
  }
  // Fallback system fonts
  const fallbacks = [
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ];
  for (const f of fallbacks) {
    if (existsSync(f)) {
      GlobalFonts.registerFromPath(f, "FallbackSerif");
    }
  }
}

function fontSpec(family: string, size: number, italic = false): string {
  const hasCinzel = existsSync(join(FONT_DIR, "Cinzel.ttf"));
  const hasPlayfair = existsSync(join(FONT_DIR, "PlayfairDisplay.ttf"));

  if (family === "Cinzel") {
    return `bold ${size}px ${hasCinzel ? "Cinzel" : "FallbackSerif, serif"}`;
  }
  if (family === "PlayfairDisplay") {
    if (italic) {
      return `italic ${size}px ${hasPlayfair ? "PlayfairDisplayItalic, PlayfairDisplay" : "FallbackSerif, serif"}`;
    }
    return `bold ${size}px ${hasPlayfair ? "PlayfairDisplay" : "FallbackSerif, serif"}`;
  }
  return `bold ${size}px serif`;
}

function wrapTextLines(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  text: string,
  font: string,
  maxWidth: number
): string[] {
  ctx.font = font;
  const words = text.split(" ");
  const lines: string[] = [];
  let cur: string[] = [];

  for (const word of words) {
    const test = [...cur, word].join(" ");
    const w = ctx.measureText(test).width;
    if (w <= maxWidth && cur.length > 0) {
      cur.push(word);
    } else if (cur.length === 0) {
      cur.push(word);
    } else {
      lines.push(cur.join(" "));
      cur = [word];
    }
  }
  if (cur.length > 0) lines.push(cur.join(" "));
  return lines;
}

function drawGlowCurve(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>) {
  const points: [number, number][] = [];
  for (let i = 0; i < 300; i++) {
    const t = i / 299;
    const x = SIZE * 0.28 + SIZE * 0.72 * t;
    const y = SIZE * 0.98 - SIZE * 0.88 * Math.pow(t, 1.3);
    points.push([x, y]);
  }

  const layers: [number, number, [number, number, number]][] = [
    [22, 0.08, [0, 255, 100]],
    [14, 0.18, [0, 255, 120]],
    [6, 0.51, [80, 255, 150]],
    [2, 0.86, [200, 255, 220]],
  ];

  for (const [width, alpha, color] of layers) {
    ctx.save();
    ctx.strokeStyle = rgba(color[0], color[1], color[2], alpha);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawCandlesticks(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>) {
  // Left side (smaller)
  const leftCandles: [number, number, number, number, boolean][] = [
    [55, 830, 790, 750, true], [100, 790, 750, 710, false],
    [145, 760, 715, 670, true], [190, 720, 670, 620, true],
    [235, 680, 625, 575, false], [280, 640, 580, 530, true],
  ];
  for (const [x, top, bt, bb, green] of leftCandles) {
    const c = green ? rgba(0, 180, 80, 0.27) : rgba(200, 60, 60, 0.27);
    ctx.save();
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, Math.max(bt, bb) + 40);
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.fillRect(x - 7, Math.min(bt, bb), 14, Math.abs(bt - bb));
    ctx.restore();
  }

  // Right side (larger)
  const rightCandles: [number, number, number, number, boolean][] = [
    [820, 620, 420, 510, true], [870, 490, 300, 390, true],
    [920, 370, 190, 280, false], [965, 280, 110, 200, true],
    [1010, 200, 50, 130, true],
  ];
  for (const [x, top, bt, bb, green] of rightCandles) {
    const c = green ? rgba(0, 220, 100, 0.43) : rgba(220, 80, 80, 0.43);
    ctx.save();
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, Math.max(bt, bb) + 40);
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.fillRect(x - 13, Math.min(bt, bb), 26, Math.abs(bt - bb));
    ctx.restore();
  }
}

async function loadBackground(backgroundUrl?: string): Promise<Buffer> {
  // 1. DALL-E 3 URL
  if (backgroundUrl) {
    try {
      console.log(`[createQuoteImage] Lade Hintergrund: ${backgroundUrl.slice(0, 60)}...`);
      const resp = await fetch(backgroundUrl, { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      const buf = await sharp(Buffer.from(arrayBuf))
        .resize(SIZE, SIZE, { fit: "cover" })
        .toBuffer();
      console.log("[createQuoteImage] Hintergrund geladen ✅");
      return buf;
    } catch (e) {
      console.warn(`[createQuoteImage] Hintergrund fehlgeschlagen: ${e} – Fallback`);
    }
  }

  // 2. Static fallback backgrounds
  const scriptDir = join(process.cwd(), "server");
  const bgVariants = [
    join(scriptDir, "quote_bg.png"),
    join(scriptDir, "quote_bg_blue.png"),
    join(scriptDir, "quote_bg_darkgreen.png"),
  ];
  const today = new Date().toISOString().slice(0, 10);
  const idx = parseInt(createHash("md5").update(today).digest("hex"), 16) % bgVariants.length;
  const bgPath = bgVariants[idx];
  if (existsSync(bgPath)) {
    return await sharp(bgPath).resize(SIZE, SIZE, { fit: "cover" }).toBuffer();
  }

  // 3. Solid dark gradient fallback
  const gradCanvas = createCanvas(SIZE, SIZE);
  const gCtx = gradCanvas.getContext("2d");
  const grad = gCtx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, rgb(BG_DARK));
  grad.addColorStop(1, "rgb(13,38,22)");
  gCtx.fillStyle = grad;
  gCtx.fillRect(0, 0, SIZE, SIZE);
  return gradCanvas.toBuffer("image/png");
}

export async function createQuoteImage(
  quote: string,
  author: string,
  outputPath: string,
  backgroundUrl?: string
): Promise<void> {
  registerFonts();

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  // ── BACKGROUND ──────────────────────────────────────────────────────────────
  const bgBuf = await loadBackground(backgroundUrl);
  const bgImg = await loadImage(bgBuf);
  ctx.drawImage(bgImg, 0, 0, SIZE, SIZE);

  // Dark overlay for readability
  ctx.fillStyle = rgba(0, 0, 0, 0.39);
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── DECORATIVE ELEMENTS ─────────────────────────────────────────────────────
  drawCandlesticks(ctx);
  drawGlowCurve(ctx);

  // ── LOGO ────────────────────────────────────────────────────────────────────
  if (existsSync(LOGO_PATH)) {
    try {
      const logo = await loadImage(LOGO_PATH);
      const logoW = 300;
      const logoH = Math.round(logo.height * logoW / logo.width);
      const logoX = (SIZE - logoW) / 2;
      ctx.drawImage(logo, logoX, 48, logoW, logoH);
    } catch (e) {
      console.warn("[createQuoteImage] Logo konnte nicht geladen werden:", e);
    }
  }

  // ── BADGE ───────────────────────────────────────────────────────────────────
  const badgeText = "QUOTE OF THE DAY";
  const badgeFont = fontSpec("Cinzel", 30);
  ctx.font = badgeFont;
  const bm = ctx.measureText(badgeText);
  const bw = bm.width;
  const bh = 36;
  const px = 38, py = 14;
  const badgeX = (SIZE - bw) / 2 - px;
  const badgeY = 152;
  const badgeW = bw + px * 2;
  const badgeH = bh + py * 2;

  // Badge background
  ctx.save();
  ctx.fillStyle = rgba(5, 15, 10, 0.82);
  ctx.strokeStyle = rgb(GOLD);
  ctx.lineWidth = 2;
  const r = 6;
  ctx.beginPath();
  ctx.moveTo(badgeX + r, badgeY);
  ctx.lineTo(badgeX + badgeW - r, badgeY);
  ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + r, r);
  ctx.lineTo(badgeX + badgeW, badgeY + badgeH - r);
  ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - r, badgeY + badgeH, r);
  ctx.lineTo(badgeX + r, badgeY + badgeH);
  ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - r, r);
  ctx.lineTo(badgeX, badgeY + r);
  ctx.arcTo(badgeX, badgeY, badgeX + r, badgeY, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Corner diamonds
  const corners: [number, number][] = [
    [badgeX, badgeY], [badgeX + badgeW, badgeY],
    [badgeX, badgeY + badgeH], [badgeX + badgeW, badgeY + badgeH],
  ];
  for (const [cx, cy] of corners) {
    ctx.save();
    ctx.fillStyle = rgba(GOLD[0], GOLD[1], GOLD[2], 0.78);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx, cy + 6);
    ctx.lineTo(cx - 6, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Side lines
  const midY = badgeY + badgeH / 2;
  ctx.save();
  ctx.strokeStyle = rgba(GOLD[0], GOLD[1], GOLD[2], 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(badgeX - 70, midY);
  ctx.lineTo(badgeX - 8, midY);
  ctx.moveTo(badgeX + badgeW + 8, midY);
  ctx.lineTo(badgeX + badgeW + 70, midY);
  ctx.stroke();
  ctx.restore();

  // Badge text
  ctx.font = badgeFont;
  ctx.fillStyle = rgb(GOLD);
  ctx.fillText(badgeText, (SIZE - bw) / 2, badgeY + py + bh * 0.78);

  // ── OPENING QUOTE MARK ──────────────────────────────────────────────────────
  const qmFont = fontSpec("PlayfairDisplay", 130);
  ctx.font = qmFont;
  const qmW = ctx.measureText("\u201c").width;
  const qmY = 230;
  ctx.fillStyle = rgb(GOLD);
  ctx.fillText("\u201c", (SIZE - qmW) / 2, qmY + 100);

  // Decorative lines beside quote mark
  const lineY = qmY + 55;
  ctx.save();
  ctx.strokeStyle = rgba(GOLD[0], GOLD[1], GOLD[2], 0.39);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(70, lineY);
  ctx.lineTo(SIZE / 2 - 90, lineY);
  ctx.moveTo(SIZE / 2 + 90, lineY);
  ctx.lineTo(SIZE - 70, lineY);
  ctx.stroke();
  ctx.restore();

  // ── QUOTE TEXT ──────────────────────────────────────────────────────────────
  const margin = 72;
  const maxW = SIZE - 2 * margin;
  const words = quote.split(" ");
  const totalChars = quote.length;

  let mainFontSize: number, italicFontSize: number, lineH: number;
  if (totalChars <= 60) {
    mainFontSize = 90; italicFontSize = 78; lineH = 105;
  } else if (totalChars <= 100) {
    mainFontSize = 74; italicFontSize = 78; lineH = 88;
  } else {
    mainFontSize = 58; italicFontSize = 62; lineH = 72;
  }

  const mainFont = fontSpec("PlayfairDisplay", mainFontSize);
  const italicFont = fontSpec("PlayfairDisplay", italicFontSize, true);

  const italicCount = Math.max(2, Math.floor(words.length / 3));
  const mainWords = words.length > italicCount + 2 ? words.slice(0, -italicCount) : words;
  const italicWords = words.length > italicCount + 2 ? words.slice(-italicCount) : [];

  const mainText = mainWords.join(" ").toUpperCase();
  const italicText = italicWords.join(" ");

  const mainLines = wrapTextLines(ctx, mainText, mainFont, maxW);
  const italicLines = italicText ? wrapTextLines(ctx, italicText, italicFont, maxW) : [];

  const totalLines = mainLines.length + italicLines.length;
  const textStartY = 360;
  const available = 840 - textStartY;
  const totalH = totalLines * lineH;
  let y = textStartY + Math.max(0, (available - totalH) / 2);

  // Main lines – alternating white / gold
  ctx.font = mainFont;
  for (let i = 0; i < mainLines.length; i++) {
    const line = mainLines[i];
    const color = i % 2 === 1 ? rgb(GOLD) : rgb(WHITE);
    const lw = ctx.measureText(line).width;
    const x = (SIZE - lw) / 2;
    // Shadow
    ctx.fillStyle = rgba(0, 0, 0, 1);
    ctx.fillText(line, x + 3, y + 3);
    // Text
    ctx.fillStyle = color;
    ctx.fillText(line, x, y);
    y += lineH;
  }

  // Italic lines in gold
  ctx.font = italicFont;
  for (const line of italicLines) {
    const lw = ctx.measureText(line).width;
    const x = (SIZE - lw) / 2;
    ctx.fillStyle = rgba(0, 0, 0, 1);
    ctx.fillText(line, x + 3, y + 3);
    ctx.fillStyle = rgb(GOLD_LIGHT);
    ctx.fillText(line, x, y);
    y += lineH;
  }

  // ── CLOSING QUOTE MARK ──────────────────────────────────────────────────────
  ctx.font = qmFont;
  const cqmW = ctx.measureText("\u201d").width;
  ctx.fillStyle = rgb(GOLD);
  ctx.fillText("\u201d", (SIZE - cqmW) / 2, y + 105);

  // ── AUTHOR ──────────────────────────────────────────────────────────────────
  const authorY = y + 75;
  const cx2 = SIZE / 2;
  ctx.save();
  ctx.strokeStyle = rgba(GOLD[0], GOLD[1], GOLD[2], 0.63);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx2 - 130, authorY);
  ctx.lineTo(cx2 + 130, authorY);
  ctx.stroke();
  ctx.restore();

  const authorStr = `\u2013 ${author.toUpperCase()}`;
  // Dynamische Schriftgrösse: startet bei 34px, reduziert bis 18px damit der Name nicht überläuft
  const MAX_AUTHOR_WIDTH = SIZE - 120; // 960px bei 1080px Canvas
  let authorFontSize = 34;
  ctx.font = fontSpec("Cinzel", authorFontSize);
  while (ctx.measureText(authorStr).width > MAX_AUTHOR_WIDTH && authorFontSize > 18) {
    authorFontSize -= 1;
    ctx.font = fontSpec("Cinzel", authorFontSize);
  }
  const aw = ctx.measureText(authorStr).width;
  const ax = (SIZE - aw) / 2;
  const ay = authorY + 18;
  // Shadow
  ctx.fillStyle = rgba(0, 0, 0, 1);
  ctx.fillText(authorStr, ax + 2, ay + 2);
  // Text
  ctx.fillStyle = rgb(WHITE);
  ctx.fillText(authorStr, ax, ay);

  // ── SAVE ────────────────────────────────────────────────────────────────────
  const pngBuf = canvas.toBuffer("image/png");
  await sharp(pngBuf).toFile(outputPath);
  console.log(`✅ Quote image saved: ${outputPath}`);
}

// CLI usage
if (process.argv[1] && process.argv[1].endsWith("createQuoteImage.ts")) {
  const [, , quote = "Test quote", author = "Test Author", output = "/tmp/quote_test_ts.png", bgUrl] = process.argv;
  createQuoteImage(quote, author, output, bgUrl).catch(console.error);
}
