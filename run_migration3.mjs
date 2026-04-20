import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

const sql = readFileSync("./drizzle/0009_needy_trauma.sql", "utf-8");
const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);

const conn = await createConnection(process.env.DATABASE_URL);
for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log("✓", stmt.slice(0, 60));
  } catch (e) {
    if (e.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("⚠ Already exists, skipping:", stmt.slice(0, 60));
    } else {
      throw e;
    }
  }
}
await conn.end();
console.log("✅ Migration complete");
