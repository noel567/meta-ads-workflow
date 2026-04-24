/**
 * Vollständiger Test: createQuoteImage.ts + DALL-E 3 Hintergrund + Telegram
 */
import { readFileSync } from "fs";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import sharp from "sharp";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";

// Load env
const envPath = "/home/ubuntu/meta-ads-workflow/.env";
const env = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
const FORGE_URL = env.BUILT_IN_FORGE_API_URL || process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY = env.BUILT_IN_FORGE_API_KEY || process.env.BUILT_IN_FORGE_API_KEY;
const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

const SIZE = 1080;
const FONT_DIR = "/home/ubuntu/webdev-static-assets/fonts";
const LOGO_PATH = "/home/ubuntu/webdev-static-assets/easysignals_logo_white.png";
const GOLD = [212, 175, 55];
const GOLD_LIGHT = [255, 215, 80];
const WHITE = [255, 255, 255];

function rgba(r, g, b, a = 1) { return `rgba(${r},${g},${b},${a})`; }
function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }

function registerFonts() {
  const fonts = [
    { file: "Cinzel.ttf", family: "Cinzel" },
    { file: "PlayfairDisplay.ttf", family: "PlayfairDisplay" },
    { file: "PlayfairDisplay-Italic.ttf", family: "PlayfairDisplayItalic" },
  ];
  for (const { file, family } of fonts) {
    const p = `${FONT_DIR}/${file}`;
    if (existsSync(p)) GlobalFonts.registerFromPath(p, family);
  }
}

function fontSpec(family, size, italic = false) {
  const hasCinzel = existsSync(`${FONT_DIR}/Cinzel.ttf`);
  const hasPlayfair = existsSync(`${FONT_DIR}/PlayfairDisplay.ttf`);
  if (family === "Cinzel") return `bold ${size}px ${hasCinzel ? "Cinzel" : "serif"}`;
  if (italic) return `italic ${size}px ${hasPlayfair ? "PlayfairDisplayItalic, PlayfairDisplay" : "serif"}`;
  return `bold ${size}px ${hasPlayfair ? "PlayfairDisplay" : "serif"}`;
}

function wrapTextLines(ctx, text, font, maxWidth) {
  ctx.font = font;
  const words = text.split(" ");
  const lines = [];
  let cur = [];
  for (const word of words) {
    const test = [...cur, word].join(" ");
    if (ctx.measureText(test).width <= maxWidth && cur.length > 0) {
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

function drawGlowCurve(ctx) {
  const points = [];
  for (let i = 0; i < 300; i++) {
    const t = i / 299;
    points.push([SIZE * 0.28 + SIZE * 0.72 * t, SIZE * 0.98 - SIZE * 0.88 * Math.pow(t, 1.3)]);
  }
  for (const [width, alpha, color] of [[22, 0.08, [0, 255, 100]], [14, 0.18, [0, 255, 120]], [6, 0.51, [80, 255, 150]], [2, 0.86, [200, 255, 220]]]) {
    ctx.save();
    ctx.strokeStyle = rgba(color[0], color[1], color[2], alpha);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCandlesticks(ctx) {
  const left = [[55,830,790,750,true],[100,790,750,710,false],[145,760,715,670,true],[190,720,670,620,true],[235,680,625,575,false],[280,640,580,530,true]];
  for (const [x,top,bt,bb,green] of left) {
    const c = green ? rgba(0,180,80,0.27) : rgba(200,60,60,0.27);
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x,Math.max(bt,bb)+40); ctx.stroke();
    ctx.fillStyle = c; ctx.fillRect(x-7,Math.min(bt,bb),14,Math.abs(bt-bb)); ctx.restore();
  }
  const right = [[820,620,420,510,true],[870,490,300,390,true],[920,370,190,280,false],[965,280,110,200,true],[1010,200,50,130,true]];
  for (const [x,top,bt,bb,green] of right) {
    const c = green ? rgba(0,220,100,0.43) : rgba(220,80,80,0.43);
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x,top); ctx.lineTo(x,Math.max(bt,bb)+40); ctx.stroke();
    ctx.fillStyle = c; ctx.fillRect(x-13,Math.min(bt,bb),26,Math.abs(bt-bb)); ctx.restore();
  }
}

async function generateBackground(quote, author) {
  const prompt = `Luxurious dark trading room interior, marble desk, city skyline at night through floor-to-ceiling windows, golden ambient lighting, ultra-realistic 8K photography, cinematic depth of field. No text, no people.`;
  console.log("[test] Generiere Forge/DALL-E 3 Hintergrund...");
  const resp = await fetch(`${FORGE_URL}/images.v1.ImageService/GenerateImage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${FORGE_KEY}` },
    body: JSON.stringify({ prompt, width: 1024, height: 1024 }),
    signal: AbortSignal.timeout(60000),
  });
  if (!resp.ok) throw new Error(`Forge API ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const url = data.url || data.image_url || data.data?.[0]?.url;
  if (!url) throw new Error(`Keine URL in Response: ${JSON.stringify(data)}`);
  console.log("[test] Hintergrund URL:", url.slice(0, 60));
  return url;
}

async function createImage(quote, author, bgUrl) {
  registerFonts();
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  // Background
  if (bgUrl) {
    const bgResp = await fetch(bgUrl, { signal: AbortSignal.timeout(30000) });
    const bgBuf = await sharp(Buffer.from(await bgResp.arrayBuffer())).resize(SIZE, SIZE, { fit: "cover" }).toBuffer();
    const bgImg = await loadImage(bgBuf);
    ctx.drawImage(bgImg, 0, 0, SIZE, SIZE);
  } else {
    ctx.fillStyle = "rgb(5,18,12)";
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  ctx.fillStyle = rgba(0, 0, 0, 0.39);
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawCandlesticks(ctx);
  drawGlowCurve(ctx);

  // Logo
  if (existsSync(LOGO_PATH)) {
    const logo = await loadImage(LOGO_PATH);
    const lw = 300, lh = Math.round(logo.height * 300 / logo.width);
    ctx.drawImage(logo, (SIZE - lw) / 2, 48, lw, lh);
  }

  // Badge
  const badgeText = "QUOTE OF THE DAY";
  const badgeFont = fontSpec("Cinzel", 30);
  ctx.font = badgeFont;
  const bw = ctx.measureText(badgeText).width;
  const px = 38, py = 14, bh = 36;
  const bx = (SIZE - bw) / 2 - px, by = 152;
  ctx.save();
  ctx.fillStyle = rgba(5, 15, 10, 0.82);
  ctx.strokeStyle = rgb(GOLD); ctx.lineWidth = 2;
  const r = 6;
  ctx.beginPath();
  ctx.moveTo(bx+r,by); ctx.lineTo(bx+bw+px*2-r,by); ctx.arcTo(bx+bw+px*2,by,bx+bw+px*2,by+r,r);
  ctx.lineTo(bx+bw+px*2,by+bh+py*2-r); ctx.arcTo(bx+bw+px*2,by+bh+py*2,bx+bw+px*2-r,by+bh+py*2,r);
  ctx.lineTo(bx+r,by+bh+py*2); ctx.arcTo(bx,by+bh+py*2,bx,by+bh+py*2-r,r);
  ctx.lineTo(bx,by+r); ctx.arcTo(bx,by,bx+r,by,r); ctx.closePath();
  ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.font = badgeFont; ctx.fillStyle = rgb(GOLD);
  ctx.fillText(badgeText, (SIZE - bw) / 2, by + py + bh * 0.78);

  // Opening quote mark
  ctx.font = fontSpec("PlayfairDisplay", 130);
  const qmW = ctx.measureText("\u201c").width;
  ctx.fillStyle = rgb(GOLD);
  ctx.fillText("\u201c", (SIZE - qmW) / 2, 330);

  // Quote text
  const words = quote.split(" ");
  const totalChars = quote.length;
  let mainFontSize, italicFontSize, lineH;
  if (totalChars <= 60) { mainFontSize = 90; italicFontSize = 78; lineH = 105; }
  else if (totalChars <= 100) { mainFontSize = 74; italicFontSize = 78; lineH = 88; }
  else { mainFontSize = 58; italicFontSize = 62; lineH = 72; }

  const mainFont = fontSpec("PlayfairDisplay", mainFontSize);
  const italicFont = fontSpec("PlayfairDisplay", italicFontSize, true);
  const margin = 72, maxW = SIZE - 2 * margin;
  const italicCount = Math.max(2, Math.floor(words.length / 3));
  const mainWords = words.length > italicCount + 2 ? words.slice(0, -italicCount) : words;
  const italicWords = words.length > italicCount + 2 ? words.slice(-italicCount) : [];
  const mainLines = wrapTextLines(ctx, mainWords.join(" ").toUpperCase(), mainFont, maxW);
  const italicLines = italicWords.length ? wrapTextLines(ctx, italicWords.join(" "), italicFont, maxW) : [];

  const totalLines = mainLines.length + italicLines.length;
  const textStartY = 360;
  const totalH = totalLines * lineH;
  let y = textStartY + Math.max(0, (840 - textStartY - totalH) / 2);

  ctx.font = mainFont;
  for (let i = 0; i < mainLines.length; i++) {
    const line = mainLines[i];
    const lw = ctx.measureText(line).width;
    const x = (SIZE - lw) / 2;
    ctx.fillStyle = rgba(0,0,0,1); ctx.fillText(line, x+3, y+3);
    ctx.fillStyle = i % 2 === 1 ? rgb(GOLD) : rgb(WHITE); ctx.fillText(line, x, y);
    y += lineH;
  }
  ctx.font = italicFont;
  for (const line of italicLines) {
    const lw = ctx.measureText(line).width;
    const x = (SIZE - lw) / 2;
    ctx.fillStyle = rgba(0,0,0,1); ctx.fillText(line, x+3, y+3);
    ctx.fillStyle = rgb(GOLD_LIGHT); ctx.fillText(line, x, y);
    y += lineH;
  }

  // Closing quote mark
  ctx.font = fontSpec("PlayfairDisplay", 130);
  const cqmW = ctx.measureText("\u201d").width;
  ctx.fillStyle = rgb(GOLD);
  ctx.fillText("\u201d", (SIZE - cqmW) / 2, y + 105);

  // Author
  const authorY = y + 75;
  ctx.save(); ctx.strokeStyle = rgba(GOLD[0],GOLD[1],GOLD[2],0.63); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(SIZE/2-130,authorY); ctx.lineTo(SIZE/2+130,authorY); ctx.stroke(); ctx.restore();
  const authorFont = fontSpec("Cinzel", 34);
  ctx.font = authorFont;
  const authorStr = `\u2013 ${author.toUpperCase()}`;
  const aw = ctx.measureText(authorStr).width;
  ctx.fillStyle = rgba(0,0,0,1); ctx.fillText(authorStr, (SIZE-aw)/2+2, authorY+20);
  ctx.fillStyle = rgb(WHITE); ctx.fillText(authorStr, (SIZE-aw)/2, authorY+18);

  const buf = canvas.toBuffer("image/png");
  const outPath = `/tmp/quote_full_test_${Date.now()}.png`;
  await sharp(buf).toFile(outPath);
  return outPath;
}

async function sendToTelegram(imgPath) {
  const imgBuffer = readFileSync(imgPath);
  const boundary = `----FormBoundary${Date.now()}`;
  const CRLF = "\r\n";
  const parts = [
    `--${boundary}${CRLF}Content-Disposition: form-data; name="chat_id"${CRLF}${CRLF}${CHAT_ID}${CRLF}`,
    `--${boundary}${CRLF}Content-Disposition: form-data; name="photo"; filename="quote.png"${CRLF}Content-Type: image/png${CRLF}${CRLF}`,
  ];
  const body = Buffer.concat([
    Buffer.from(parts.join("")),
    imgBuffer,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
  ]);
  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(`Telegram: ${JSON.stringify(data)}`);
  return data.result.message_id;
}

// Run
console.log("[test] Starte vollständigen Node.js Quote-Test...");
const bgUrl = await generateBackground("Test", "Test");
console.log("[test] Erstelle Bild...");
const imgPath = await createImage(
  "The four most dangerous words in investing are: This time it is different.",
  "Sir John Templeton",
  bgUrl
);
console.log("[test] Bild erstellt:", imgPath);
console.log("[test] Sende an Telegram...");
const msgId = await sendToTelegram(imgPath);
console.log("[test] ✅ Telegram Message ID:", msgId);
