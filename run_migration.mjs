import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const conn = await createConnection(url);

const sql1 = `CREATE TABLE IF NOT EXISTS \`meta_ad_insights\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`campaignId\` varchar(64) NOT NULL,
  \`campaignName\` varchar(255) NOT NULL,
  \`adsetId\` varchar(64),
  \`adsetName\` varchar(255),
  \`adId\` varchar(64),
  \`adName\` varchar(255),
  \`level\` enum('account','campaign','adset','ad') NOT NULL DEFAULT 'campaign',
  \`spend\` float DEFAULT 0,
  \`impressions\` bigint DEFAULT 0,
  \`clicks\` bigint DEFAULT 0,
  \`reach\` bigint DEFAULT 0,
  \`ctr\` float DEFAULT 0,
  \`cpc\` float DEFAULT 0,
  \`cpm\` float DEFAULT 0,
  \`roas\` float DEFAULT 0,
  \`purchases\` float DEFAULT 0,
  \`leads\` float DEFAULT 0,
  \`costPerPurchase\` float DEFAULT 0,
  \`costPerLead\` float DEFAULT 0,
  \`frequency\` float DEFAULT 0,
  \`status\` varchar(32),
  \`objective\` varchar(64),
  \`dailyBudget\` float,
  \`dateStart\` varchar(16) NOT NULL,
  \`dateStop\` varchar(16) NOT NULL,
  \`datePreset\` varchar(32),
  \`rawData\` json,
  \`syncedAt\` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT \`meta_ad_insights_id\` PRIMARY KEY(\`id\`)
)`;

const sql2 = `CREATE TABLE IF NOT EXISTS \`meta_ai_analyses\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int NOT NULL,
  \`analysisDate\` varchar(16) NOT NULL,
  \`datePreset\` varchar(32) DEFAULT 'last_7d',
  \`summary\` text,
  \`topPerformers\` json,
  \`underperformers\` json,
  \`budgetRecommendations\` json,
  \`actionItems\` json,
  \`insights\` json,
  \`overallScore\` float,
  \`totalSpend\` float,
  \`totalRevenue\` float,
  \`avgRoas\` float,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT \`meta_ai_analyses_id\` PRIMARY KEY(\`id\`)
)`;

try {
  await conn.execute(sql1);
  console.log("✓ meta_ad_insights table created");
  await conn.execute(sql2);
  console.log("✓ meta_ai_analyses table created");
} catch (e) {
  console.error("Error:", e.message);
} finally {
  await conn.end();
}
