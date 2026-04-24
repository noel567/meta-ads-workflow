import { generateImage } from "./server/_core/imageGeneration";

async function main() {
  console.log("Testing Forge image generation...");
  try {
    const result = await generateImage({
      prompt: "Dark minimalist trading background, deep black with gold accents, no text, abstract premium",
    });
    console.log("SUCCESS - URL:", result.url ? result.url.slice(0, 100) + "..." : "NO URL");
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}

main();
