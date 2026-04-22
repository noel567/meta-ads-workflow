/**
 * Email OTP Authentication
 * Replaces Manus OAuth with a self-hosted email-based OTP flow.
 *
 * Flow:
 *  1. POST /api/auth/request-otp  { email }  → sends 6-digit code via email
 *  2. POST /api/auth/verify-otp   { email, code } → sets session cookie
 *  3. POST /api/auth/logout       → clears session cookie
 *  4. GET  /api/auth/me           → returns current user or 401
 */

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import * as db from "../db";
import { ENV } from "./env";

// ─── File-persisted OTP store (survives service restarts) ────────────────────
interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const OTP_STORE_PATH = process.env.OTP_STORE_PATH ?? "/tmp/otp-store.json";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function loadOtpStore(): Map<string, OtpEntry> {
  try {
    if (fs.existsSync(OTP_STORE_PATH)) {
      const raw = fs.readFileSync(OTP_STORE_PATH, "utf-8");
      const obj = JSON.parse(raw) as Record<string, OtpEntry>;
      return new Map(Object.entries(obj));
    }
  } catch {
    // ignore corrupt file
  }
  return new Map();
}

function saveOtpStore(store: Map<string, OtpEntry>) {
  try {
    const obj = Object.fromEntries(store.entries());
    fs.writeFileSync(OTP_STORE_PATH, JSON.stringify(obj), "utf-8");
  } catch {
    // ignore write errors
  }
}

function cleanupExpiredOtps(store: Map<string, OtpEntry>) {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt < now) store.delete(key);
  }
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Nodemailer transporter ───────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host: ENV.smtpHost,
    port: ENV.smtpPort,
    secure: ENV.smtpPort === 465,
    auth: {
      user: ENV.smtpUser,
      pass: ENV.smtpPass,
    },
  });
}

async function sendOtpEmail(email: string, code: string): Promise<void> {
  // If no SMTP configured, log to console (dev mode)
  if (!ENV.smtpUser || !ENV.smtpPass) {
    console.log(`[Auth] OTP for ${email}: ${code} (SMTP not configured — check console)`);
    return;
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"EasySignals" <${ENV.smtpFrom}>`,
    to: email,
    subject: "Dein Login-Code für EasySignals",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Dein Login-Code</h2>
        <p style="color: #666; margin-bottom: 24px;">
          Gib diesen Code ein um dich bei EasySignals anzumelden:
        </p>
        <div style="background: #f4f4f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a; font-family: monospace;">
            ${code}
          </span>
        </div>
        <p style="color: #999; font-size: 14px;">
          Dieser Code ist 10 Minuten gültig. Falls du dich nicht angemeldet hast, ignoriere diese E-Mail.
        </p>
      </div>
    `,
    text: `Dein EasySignals Login-Code: ${code}\n\nGültig für 10 Minuten.`,
  });
}

// ─── JWT Session helpers ──────────────────────────────────────────────────────
const jwtSecret = new TextEncoder().encode(
  ENV.cookieSecret || "fallback-secret-change-in-production"
);

async function createSessionToken(openId: string): Promise<string> {
  return new SignJWT({ openId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(jwtSecret);
}

async function verifySessionToken(token: string): Promise<{ openId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    return { openId: payload.openId as string };
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader?: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) map.set(k.trim(), decodeURIComponent(v.join("=")));
  }
  return map;
}

// ─── Middleware: authenticate request ────────────────────────────────────────
export async function authenticateRequest(req: Request): Promise<import("../../drizzle/schema").User> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.get(COOKIE_NAME);
  if (!token) throw new Error("No session cookie");

  const session = await verifySessionToken(token);
  if (!session?.openId) throw new Error("Invalid session");

  const user = await db.getUserByOpenId(session.openId);
  if (!user) throw new Error("User not found");

  return user;
}

// ─── Express routes ───────────────────────────────────────────────────────────
export function registerAuthRoutes(app: Express) {
  // POST /api/auth/request-otp
  app.post("/api/auth/request-otp", async (req: Request, res: Response) => {
    const { email } = req.body as { email?: string };

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Gültige E-Mail-Adresse erforderlich" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check allowed emails whitelist
    if (ENV.allowedEmails) {
      const allowed = ENV.allowedEmails.split(",").map(e => e.trim().toLowerCase());
      if (!allowed.includes(normalizedEmail)) {
        res.status(403).json({ error: "Diese E-Mail-Adresse ist nicht berechtigt" });
        return;
      }
    }

    const store = loadOtpStore();
    cleanupExpiredOtps(store);

    const code = generateOtp();
    store.set(normalizedEmail, {
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });
    saveOtpStore(store);

    try {
      await sendOtpEmail(normalizedEmail, code);
      res.json({ success: true, message: "Code wurde gesendet" });
    } catch (error) {
      console.error("[Auth] Failed to send OTP email:", error);
      res.status(500).json({ error: "E-Mail konnte nicht gesendet werden" });
    }
  });

  // POST /api/auth/verify-otp
  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    const { email, code } = req.body as { email?: string; code?: string };

    if (!email || !code) {
      res.status(400).json({ error: "E-Mail und Code erforderlich" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const store = loadOtpStore();
    const entry = store.get(normalizedEmail);

    if (!entry) {
      res.status(400).json({ error: "Kein Code angefordert oder Code abgelaufen" });
      return;
    }

    if (Date.now() > entry.expiresAt) {
      store.delete(normalizedEmail);
      saveOtpStore(store);
      res.status(400).json({ error: "Code abgelaufen — bitte neuen Code anfordern" });
      return;
    }

    entry.attempts++;
    if (entry.attempts > MAX_ATTEMPTS) {
      store.delete(normalizedEmail);
      saveOtpStore(store);
      res.status(429).json({ error: "Zu viele Versuche — bitte neuen Code anfordern" });
      return;
    }

    if (entry.code !== code.trim()) {
      saveOtpStore(store);
      res.status(400).json({ error: `Falscher Code (${MAX_ATTEMPTS - entry.attempts + 1} Versuche verbleibend)` });
      return;
    }

    // Code correct — create/update user and set session
    store.delete(normalizedEmail);
    saveOtpStore(store);

    const openId = `email:${normalizedEmail}`;
    await db.upsertUser({
      openId,
      email: normalizedEmail,
      name: normalizedEmail.split("@")[0],
      loginMethod: "email-otp",
      lastSignedIn: new Date(),
    });

    const sessionToken = await createSessionToken(openId);

    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
    res.cookie(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: ONE_YEAR_MS,
      path: "/",
    });

    const user = await db.getUserByOpenId(openId);
    res.json({ success: true, user });
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ success: true });
  });

  // GET /api/auth/me
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      res.json(user);
    } catch {
      res.status(401).json({ error: "Nicht angemeldet" });
    }
  });
}
