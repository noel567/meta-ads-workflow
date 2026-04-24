/**
 * Simuliert exakt was die testQuote tRPC-Procedure macht
 */
import { generateImage } from "./server/_core/imageGeneration";
import { invokeLLM } from "./server/_core/llm";
import { getDb } from "./server/db";
import { contentBotSettings } from "./drizzle/schema";
import { eq } from "drizzle-orm";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import { readFileSync, existsSync } from "fs";

const DALLE_STYLE_PROMPTS: Record<string, (author: string) => string> = {
  trading: (author) => `Premium financial trading background for a quote by ${author}. Dark atmosphere, candlestick charts, gold and green accents, bokeh lights, cinematic depth of field. No text, no people, ultra-detailed, 8K.`,
  dark_minimal: (author) => `Dark minimalist abstract background for a quote by ${author}. Deep black with subtle geometric lines, premium trading aesthetic, no text, 8K.`,
};

async function main() {
  console.log("=== Simulating testQuote procedure ===\n");

  // 1. Settings laden
  console.log("1. Loading settings...");
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  
  const settings = await db.select().from(contentBotSettings).where(eq(contentBotSettings.userId, 1)).limit(1);
  const style = (settings[0] as any)?.defaultBackgroundStyle ?? "trading";
  console.log("   Style:", style);

  // 2. LLM Quote generieren
  console.log("\n2. Generating quote via LLM...");
  const today = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  const userPrompt = `Erstelle einen „Quote of the Day"-Post für die EasySignals Telegram-Gruppe.
Wähle ein bekanntes, inspirierendes Zitat von einem berühmten Trader, Investor oder Unternehmer (z.B. Warren Buffett, Paul Tudor Jones, Jesse Livermore, George Soros, Ray Dalio).
Das Zitat soll auf Englisch bleiben (Original), aber der umrahmende Text ist auf Hochdeutsch.

Format (EXAKT so):
„[Zitat auf Englisch]"
— [Name des Autors]

[2–3 Sätze Kommentar auf professionellem Hochdeutsch]

🚀 EasySignals – Wir spielen das langfristige Spiel.`;

  const llmResp = await invokeLLM({
    messages: [
      { role: "system", content: "Du bist Livio Swiss, Gründer von EasySignals." },
      { role: "user", content: userPrompt }
    ]
  }) as any;
  const text = llmResp?.choices?.[0]?.message?.content?.trim() ?? "";
  console.log("   Quote generated:", text.slice(0, 80) + "...");

  // 3. Autor extrahieren
  const authorMatch = text.match(/—\s*(.+)/);
  const author = authorMatch ? authorMatch[1].trim() : "Unknown";
  const quoteMatch = text.match(/„(.+?)"/s);
  const quote = quoteMatch ? quoteMatch[1].trim() : text.split("\n")[0];
  console.log("   Author:", author);

  // 4. DALL-E 3 Hintergrund generieren
  console.log("\n3. Generating background image (Forge/DALL-E 3)...");
  const promptFn = DALLE_STYLE_PROMPTS[style] ?? DALLE_STYLE_PROMPTS.trading;
  const prompt = promptFn(author);
  const bgResult = await generateImage({ prompt });
  console.log("   Background URL:", bgResult.url ? bgResult.url.slice(0, 80) + "..." : "NONE");

  // 5. Python-Script ausführen
  console.log("\n4. Creating quote image with Pillow...");
  const imgPath = join(tmpdir(), `quote_testproc_${Date.now()}.png`);
  const scriptPath = join(process.cwd(), "server/createQuoteImage.py");
  if (!existsSync(scriptPath)) throw new Error(`Script not found: ${scriptPath}`);
  
  const quoteSafe = quote.replace(/"/g, '\\"');
  const authorSafe = author.replace(/"/g, '\\"');
  const bgArg = bgResult.url ? ` --background_url "${bgResult.url}"` : "";
  
  try {
    execSync(`python3 "${scriptPath}" "${quoteSafe}" "${authorSafe}" "${imgPath}"${bgArg}`, { timeout: 30000 });
    console.log("   Image created:", imgPath);
  } catch (e: any) {
    console.error("   Python error:", e.stderr?.toString() ?? e.message);
    throw e;
  }

  // 6. Telegram senden
  console.log("\n5. Sending to Telegram...");
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) throw new Error("Missing Telegram credentials");

  const imgBuffer = readFileSync(imgPath);
  const blob = new Blob([imgBuffer], { type: "image/png" });
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("photo", blob, "quote.png");

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { method: "POST", body: form });
  const data = await resp.json() as any;
  
  if (data.ok) {
    console.log("\n✅ SUCCESS! Message ID:", data.result.message_id);
  } else {
    console.error("\n❌ Telegram error:", JSON.stringify(data));
  }
}

main().catch((e) => {
  console.error("\n❌ FATAL ERROR:", e.message);
  console.error(e.stack);
  process.exit(1);
});
