import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import sharp from "sharp";
import { existsSync as fsExists } from "fs";
import { createHash } from "crypto";

const SIZE = 1080;
const FONT_DIR = "/home/ubuntu/webdev-static-assets/fonts";
const LOGO_PATH = "/home/ubuntu/webdev-static-assets/easysignals_logo_white.png";
const GOLD = [212, 175, 55];
const WHITE = [255, 255, 255];

// Register fonts
const fonts = [
  { file: "Cinzel.ttf", family: "Cinzel" },
  { file: "PlayfairDisplay.ttf", family: "PlayfairDisplay" },
  { file: "PlayfairDisplay-Italic.ttf", family: "PlayfairDisplayItalic" },
];
for (const { file, family } of fonts) {
  const p = `${FONT_DIR}/${file}`;
  if (fsExists(p)) GlobalFonts.registerFromPath(p, family);
}

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext("2d");

// Dark background
ctx.fillStyle = "rgb(5,18,12)";
ctx.fillRect(0, 0, SIZE, SIZE);

// Badge
ctx.font = "bold 30px Cinzel, serif";
ctx.fillStyle = `rgb(${GOLD.join(",")})`;
ctx.fillText("QUOTE OF THE DAY", 340, 190);

// Quote text
ctx.font = "bold 74px PlayfairDisplay, serif";
ctx.fillStyle = `rgb(${WHITE.join(",")})`;
ctx.fillText("THE MOST DANGEROUS", 60, 380);
ctx.fillStyle = `rgb(${GOLD.join(",")})`;
ctx.fillText("WORDS IN INVESTING", 60, 470);

// Author
ctx.font = "bold 34px Cinzel, serif";
ctx.fillStyle = `rgb(${WHITE.join(",")})`;
ctx.fillText("— SIR JOHN TEMPLETON", 280, 600);

const buf = canvas.toBuffer("image/png");
await sharp(buf).toFile("/tmp/quote_nodejs_test.png");
console.log("✅ Node.js image generated: /tmp/quote_nodejs_test.png");
