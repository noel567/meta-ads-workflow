import { createConnection } from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const conn = await createConnection(url);
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`ad_comments\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`adId\` varchar(64) NOT NULL,
    \`adName\` text,
    \`campaignName\` text,
    \`text\` text NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`ad_comments_id\` PRIMARY KEY(\`id\`)
  )
`);
console.log("✓ ad_comments table created");
await conn.end();
