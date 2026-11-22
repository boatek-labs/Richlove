import express from "express";
import pg from "pg";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3000);
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000
    })
  : null;

app.disable("x-powered-by");
app.use(express.json({ limit: "12kb" }));
app.use(express.static(path.join(root, "public"), {
  extensions: ["html"],
  maxAge: isProduction ? "1h" : 0
}));

const cleanText = (value, max) =>
  typeof value === "string" ? value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max) : "";

function secureEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sign(value) {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET || "missing-secret")
    .update(value).digest("base64url");
}

function setAdminCookie(res) {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `${expires}:${crypto.randomBytes(18).toString("base64url")}`;
  const value = `${payload}.${sign(payload)}`;
  res.cookie("proposer_admin", value, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function isAdmin(req) {
  const raw = req.headers.cookie || "";
  const match = raw.match(/(?:^|;\s*)proposer_admin=([^;]+)/);
  if (!match) return false;
  try {
    const value = decodeURIComponent(match[1]);
    const splitAt = value.lastIndexOf(".");
    if (splitAt < 0) return false;
    const payload = value.slice(0, splitAt);
    const signature = value.slice(splitAt + 1);
    const [expires] = payload.split(":");
    return Number(expires) > Date.now() && secureEqual(signature, sign(payload));
  } catch {
    return false;
  }
}

function requireDatabase(_req, res, next) {
  if (!pool) return res.status(503).json({ error: "The database is not configured yet. Please try again later." });
  next();
}

function requireInvite(req, res, next) {
  const expected = process.env.INVITE_TOKEN;
  const supplied = req.get("x-invite-token") || "";
  if (!expected || !secureEqual(supplied, expected)) {
    return res.status(403).json({ error: "This private invitation link is missing or invalid. Please open the link Foster sent you." });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: "Please sign in to Foster's control room." });
  next();
}

app.get("/api/health", async (_req, res) => {
  if (!pool) return res.status(503).json({ ok: false, database: "not_configured" });
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch {
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.post("/api/response", requireDatabase, requireInvite, async (req, res) => {
  const choice = cleanText(req.body?.choice, 12);
  const message = cleanText(req.body?.message, 1200);
  if (!["yes", "time", "no"].includes(choice)) {
    return res.status(400).json({ error: "Choose one of the available responses." });
  }
  try {
    const result = await pool.query(
      "INSERT INTO proposal_responses (choice, message) VALUES ($1, $2) RETURNING id, choice, created_at",
      [choice, message || null]
    );
    res.status(201).json({ saved: true, response: result.rows[0] });
  } catch (error) {
    console.error("Could not save proposal response:", error.message);
    res.status(500).json({ error: "Your response could not be saved. Please try again." });
  }
});

app.post("/api/nickname", requireDatabase, requireInvite, async (req, res) => {
  const nickname = cleanText(req.body?.nickname, 48);
  if (!nickname) return res.status(400).json({ error: "Enter the name you'd like Foster to call you." });
  try {
    const result = await pool.query(
      "INSERT INTO chosen_nicknames (nickname) VALUES ($1) RETURNING id, nickname, created_at",
      [nickname]
    );
    res.status(201).json({ saved: true, nickname: result.rows[0] });
  } catch (error) {
    console.error("Could not save nickname:", error.message);
    res.status(500).json({ error: "That name could not be saved. Please try again." });
  }
});

app.post("/api/questions", requireDatabase, requireInvite, async (req, res) => {
  const question = cleanText(req.body?.question, 1000);
  if (!question) return res.status(400).json({ error: "Write a question first." });
  try {
    const result = await pool.query(
      "INSERT INTO questions (question) VALUES ($1) RETURNING id, created_at",
      [question]
    );
    res.status(201).json({ saved: true, questionId: result.rows[0].id });
  } catch (error) {
    console.error("Could not save question:", error.message);
    res.status(500).json({ error: "Your question could not be saved. Please try again." });
  }
});

const loginAttempts = new Map();
app.post("/api/admin/login", (req, res) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const recent = (loginAttempts.get(ip) || []).filter((time) => now - time < 10 * 60 * 1000);
  if (recent.length >= 8) return res.status(429).json({ error: "Too many attempts. Wait a little and try again." });
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured || !process.env.SESSION_SECRET) {
    return res.status(503).json({ error: "Admin access has not been configured." });
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!secureEqual(password, configured)) {
    recent.push(now);
    loginAttempts.set(ip, recent);
    return res.status(401).json({ error: "That password wasn't correct." });
  }
  loginAttempts.delete(ip);
  setAdminCookie(res);
  res.json({ authenticated: true });
});

app.post("/api/admin/logout", (_req, res) => {
  res.clearCookie("proposer_admin", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/"
  });
  res.json({ loggedOut: true });
});

app.get("/api/admin/overview", requireDatabase, requireAdmin, async (_req, res) => {
  try {
    const [responses, nicknames, questions] = await Promise.all([
      pool.query("SELECT id, choice, message, created_at FROM proposal_responses ORDER BY created_at DESC LIMIT 50"),
      pool.query("SELECT id, nickname, created_at FROM chosen_nicknames ORDER BY created_at DESC LIMIT 20"),
      pool.query("SELECT id, question, created_at FROM questions ORDER BY created_at DESC LIMIT 50")
    ]);
    res.json({
      responses: responses.rows,
      nicknames: nicknames.rows,
      questions: questions.rows
    });
  } catch (error) {
    console.error("Could not load admin overview:", error.message);
    res.status(500).json({ error: "The control room could not load its data." });
  }
});

app.get("/admin", (_req, res) => res.sendFile(path.join(root, "public", "admin.html")));

app.use((err, _req, res, _next) => {
  console.error("Request error:", err.message);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`PROPOSER running at http://localhost:${PORT}`));
}

export default app;
