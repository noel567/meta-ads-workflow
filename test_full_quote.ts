import { generateImage } from "./server/_core/imageGeneration";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import { readFileSync } from "fs";

async function main() {
  console.log("1. Generating background image...");
  const result = await generateImage({
    prompt: "Dark minimalist trading background, deep black with subtle gold candlestick patterns, premium finance aesthetic, no text, cinematic",
  });
  console.log("Background URL:", result.url?.slice(0, 80));

  console.log("2. Creating quote image with Pillow...");
  const quote = "The four most dangerous words in investing are: 'This time it's different.'";
  const author = "Sir John Templeton";
  const imgPath = join(tmpdir(), `quote_test_full_${Date.now()}.png`);
  const scriptPath = join(process.cwd(), "server/createQuoteImage.py");
  const quoteSafe = quote.replace(/"/g, '\\"');
  const authorSafe = author.replace(/"/g, '\\"');
  const bgArg = result.url ? ` --background_url "${result.url}"` : "";
  execSync(`python3 "${scriptPath}" "${quoteSafe}" "${authorSafe}" "${imgPath}"${bgArg}`, { timeout: 30000 });
  console.log("Image created:", imgPath);

  console.log("3. Sending to Telegram...");
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) { console.error("Missing Telegram credentials"); return; }

  const imgBuffer = readFileSync(imgPath);
  const blob = new Blob([imgBuffer], { type: "image/png" });
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("photo", blob, "quote.png");

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { method: "POST", body: form });
  const data = await resp.json() as any;
  if (data.ok) {
    console.log("✅ Sent to Telegram! Message ID:", data.result.message_id);
  } else {
    console.error("Telegram error:", data);
  }
}

main().catch(console.error);
