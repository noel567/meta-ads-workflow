import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { budgetRules, ruleExecutions } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

const TOKEN = process.env.META_ACCESS_TOKEN ?? "";
const AD_ACCOUNT = "act_1093241318940799";
const META_BASE = "https://graph.facebook.com/v19.0";

// ─── Metrik-Wert aus Meta API abrufen ────────────────────────────────────────
async function fetchCampaignMetric(
  campaignId: string,
  metric: string,
  lookbackDays: number
): Promise<{ value: number; campaignName: string; currentBudgetCents: number } | null> {
  try {
    const since = new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);

    // Insights abrufen
    const insightsRes = await fetch(
      `${META_BASE}/${campaignId}/insights?fields=spend,impressions,clicks,ctr,cpc,actions&time_range={"since":"${since}","until":"${until}"}&access_token=${TOKEN}`
    );
    const insightsData = await insightsRes.json();
    const ins = insightsData.data?.[0];
    if (!ins) return null;

    // Budget abrufen
    const campRes = await fetch(
      `${META_BASE}/${campaignId}?fields=name,daily_budget,lifetime_budget&access_token=${TOKEN}`
    );
    const campData = await campRes.json();

    const leads = ins.actions?.find((a: any) => a.action_type === "lead")?.value ?? 0;
    const spend = parseFloat(ins.spend ?? "0");
    const clicks = parseInt(ins.clicks ?? "0");
    const cpl = leads > 0 ? spend / leads : 999;
    const ctr = parseFloat(ins.ctr ?? "0");
    const cpc = parseFloat(ins.cpc ?? "0");

    const metricMap: Record<string, number> = {
      cpl, ctr, cpc, spend, roas: 0,
    };

    const currentBudgetCents = parseInt(campData.daily_budget ?? campData.lifetime_budget ?? "0");

    return {
      value: metricMap[metric] ?? 0,
      campaignName: campData.name ?? campaignId,
      currentBudgetCents,
    };
  } catch {
    return null;
  }
}

// ─── Bedingung prüfen ────────────────────────────────────────────────────────
function checkCondition(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case "gt":  return value > threshold;
    case "lt":  return value < threshold;
    case "gte": return value >= threshold;
    case "lte": return value <= threshold;
    default:    return false;
  }
}

// ─── Budget anpassen via Meta API ────────────────────────────────────────────
async function updateCampaignBudget(campaignId: string, newBudgetCents: number): Promise<boolean> {
  try {
    const res = await fetch(`${META_BASE}/${campaignId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_budget: newBudgetCents, access_token: TOKEN }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// ─── Alle Kampagnen-IDs abrufen ───────────────────────────────────────────────
async function getAllCampaignIds(): Promise<Array<{ id: string; name: string }>> {
  try {
    const res = await fetch(
      `${META_BASE}/${AD_ACCOUNT}/campaigns?fields=id,name&limit=50&access_token=${TOKEN}`
    );
    const data = await res.json();
    return (data.data ?? []).map((c: any) => ({ id: c.id, name: c.name }));
  } catch {
    return [];
  }
}

// ─── Regel ausführen ─────────────────────────────────────────────────────────
export async function executeRule(rule: any): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const campaigns = rule.campaignId
    ? [{ id: rule.campaignId, name: rule.campaignName ?? rule.campaignId }]
    : await getAllCampaignIds();

  for (const campaign of campaigns) {
    const metricData = await fetchCampaignMetric(campaign.id, rule.metric, rule.lookbackDays);
    if (!metricData) continue;

    const { value, campaignName, currentBudgetCents } = metricData;
    const triggered = checkCondition(value, rule.condition, rule.threshold);

    let newBudgetCents: number | undefined = undefined;
    let reason = "";
    let success = true;
    let errorMessage: string | null = null;

    if (triggered) {
      const condLabels: Record<string, string> = { gt: ">", lt: "<", gte: "≥", lte: "≤" };
      const condLabel = condLabels[rule.condition] ?? rule.condition;
      const metricLabel = rule.metric.toUpperCase();

      if (rule.action === "pause") {
        reason = `${metricLabel} ${condLabel} ${rule.threshold}: Kampagne pausiert`;
        // Kampagne pausieren via Status-Update
        try {
          const res = await fetch(`${META_BASE}/${campaign.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "PAUSED", access_token: TOKEN }),
          });
          const data = await res.json();
          success = data.success === true;
        } catch (e: any) {
          success = false;
          errorMessage = e.message;
        }
      } else if (rule.action === "activate") {
        reason = `${metricLabel} ${condLabel} ${rule.threshold}: Kampagne aktiviert`;
        try {
          const res = await fetch(`${META_BASE}/${campaign.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ACTIVE", access_token: TOKEN }),
          });
          const data = await res.json();
          success = data.success === true;
        } catch (e: any) {
          success = false;
          errorMessage = e.message;
        }
      } else if (rule.action === "increase" || rule.action === "decrease") {
        const factor = rule.action === "increase"
          ? 1 + (rule.changePercent ?? 20) / 100
          : 1 - (rule.changePercent ?? 20) / 100;
        let calcBudget = Math.round(currentBudgetCents * factor);
        if (rule.maxBudgetCents && calcBudget > rule.maxBudgetCents) calcBudget = rule.maxBudgetCents;
        if (rule.minBudgetCents && calcBudget < rule.minBudgetCents) calcBudget = rule.minBudgetCents;
        if (calcBudget < 100) calcBudget = 100;
        newBudgetCents = calcBudget;

        const oldChf = (currentBudgetCents / 100).toFixed(2);
        const newChf = (calcBudget / 100).toFixed(2);
        reason = `${metricLabel} ${condLabel} ${rule.threshold} (Wert: ${value.toFixed(2)}): Budget von CHF ${oldChf} auf CHF ${newChf} ${rule.action === "increase" ? "erhöht" : "gesenkt"}`;

        success = await updateCampaignBudget(campaign.id, calcBudget);
        if (!success) errorMessage = "Meta API Budget-Update fehlgeschlagen";
      }
    } else {
      reason = `Bedingung nicht erfüllt: ${rule.metric.toUpperCase()} = ${value.toFixed(2)} (Schwellenwert: ${rule.threshold})`;
    }

    // Ausführung protokollieren
    await db.insert(ruleExecutions).values({
      ruleId: rule.id,
      ruleName: rule.name,
      triggered,
      campaignId: campaign.id,
      campaignName,
      metricValue: value,
      oldBudgetCents: currentBudgetCents,
      newBudgetCents: newBudgetCents,
      reason,
      success,
      errorMessage,
    });
  }

  // lastExecutedAt aktualisieren
  await db.update(budgetRules)
    .set({ lastExecutedAt: new Date() })
    .where(eq(budgetRules.id, rule.id));
}

// ─── Alle aktiven Regeln ausführen ────────────────────────────────────────────
export async function runAllBudgetRules(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const rules = await db.select().from(budgetRules).where(eq(budgetRules.active, true));
  const now = Date.now();

  for (const rule of rules) {
    // Cooldown prüfen
    if (rule.lastExecutedAt) {
      const cooldownMs = rule.cooldownDays * 86400000;
      if (now - rule.lastExecutedAt.getTime() < cooldownMs) continue;
    }
    await executeRule(rule);
  }
}

// ─── tRPC Router ─────────────────────────────────────────────────────────────
export const budgetRulesRouter = router({
  // Alle Regeln des Users
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(budgetRules)
      .where(eq(budgetRules.userId, ctx.user.id))
      .orderBy(desc(budgetRules.createdAt));
  }),

  // Neue Regel erstellen
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      metric: z.enum(["cpl", "ctr", "cpc", "spend", "roas"]),
      condition: z.enum(["gt", "lt", "gte", "lte"]),
      threshold: z.number(),
      action: z.enum(["increase", "decrease", "pause", "activate"]),
      changePercent: z.number().optional(),
      maxBudgetCents: z.number().optional(),
      minBudgetCents: z.number().optional(),
      campaignId: z.string().optional(),
      campaignName: z.string().optional(),
      lookbackDays: z.number().default(7),
      cooldownDays: z.number().default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const [result] = await db.insert(budgetRules).values({
        userId: ctx.user.id,
        ...input,
      });
      return { id: (result as any).insertId };
    }),

  // Regel aktualisieren
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(128).optional(),
      metric: z.enum(["cpl", "ctr", "cpc", "spend", "roas"]).optional(),
      condition: z.enum(["gt", "lt", "gte", "lte"]).optional(),
      threshold: z.number().optional(),
      action: z.enum(["increase", "decrease", "pause", "activate"]).optional(),
      changePercent: z.number().optional(),
      maxBudgetCents: z.number().optional(),
      minBudgetCents: z.number().optional(),
      campaignId: z.string().optional(),
      campaignName: z.string().optional(),
      lookbackDays: z.number().optional(),
      cooldownDays: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const { id, ...data } = input;
      await db.update(budgetRules)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(budgetRules.id, id), eq(budgetRules.userId, ctx.user.id)));
      return { success: true };
    }),

  // Regel löschen
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      await db.delete(budgetRules)
        .where(and(eq(budgetRules.id, input.id), eq(budgetRules.userId, ctx.user.id)));
      return { success: true };
    }),

  // Regel aktivieren/deaktivieren
  toggle: protectedProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      await db.update(budgetRules)
        .set({ active: input.active, updatedAt: new Date() })
        .where(and(eq(budgetRules.id, input.id), eq(budgetRules.userId, ctx.user.id)));
      return { success: true };
    }),

  // Alle Regeln jetzt ausführen (manueller Trigger)
  // forceRun: true = Cooldown ignorieren
  runNow: protectedProcedure
    .input(z.object({ forceRun: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const rules = await db.select().from(budgetRules)
        .where(and(eq(budgetRules.active, true), eq(budgetRules.userId, ctx.user.id)));
      for (const rule of rules) {
        if (!input.forceRun && rule.lastExecutedAt) {
          const cooldownMs = rule.cooldownDays * 86400000;
          if (Date.now() - rule.lastExecutedAt.getTime() < cooldownMs) continue;
        }
        await executeRule(rule);
      }
      return { success: true };
    }),

  // Einzelne Regel jetzt ausführen
  runSingle: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB nicht verfügbar");
      const [rule] = await db.select().from(budgetRules)
        .where(and(eq(budgetRules.id, input.id), eq(budgetRules.userId, ctx.user.id)));
      if (!rule) throw new Error("Regel nicht gefunden");
      await executeRule(rule);
      return { success: true };
    }),

  // Ausführungsprotokoll (korrekt auf User-Regeln gefiltert)
  getExecutions: protectedProcedure
    .input(z.object({ ruleId: z.number().optional(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      // Alle Regeln des Users holen um zu filtern
      const userRules = await db.select({ id: budgetRules.id })
        .from(budgetRules)
        .where(eq(budgetRules.userId, ctx.user.id));
      const userRuleIds = userRules.map(r => r.id);
      if (userRuleIds.length === 0) return [];

      // Spezifische Regel: prüfen ob sie dem User gehört
      if (input.ruleId) {
        if (!userRuleIds.includes(input.ruleId)) return [];
        return db.select().from(ruleExecutions)
          .where(eq(ruleExecutions.ruleId, input.ruleId))
          .orderBy(desc(ruleExecutions.executedAt))
          .limit(input.limit);
      }

      // Alle Regeln des Users: IN-Filter
      const { inArray } = await import("drizzle-orm");
      return db.select().from(ruleExecutions)
        .where(inArray(ruleExecutions.ruleId, userRuleIds))
        .orderBy(desc(ruleExecutions.executedAt))
        .limit(input.limit);
    }),

  // Kampagnen-Liste für Regel-Ersteller
  getCampaigns: protectedProcedure.query(async () => {
    try {
      const res = await fetch(
        `${META_BASE}/${AD_ACCOUNT}/campaigns?fields=id,name,status,daily_budget&limit=50&access_token=${TOKEN}`
      );
      const data = await res.json();
      return (data.data ?? []) as Array<{ id: string; name: string; status: string; daily_budget?: string }>;
    } catch {
      return [];
    }
  }),
});
