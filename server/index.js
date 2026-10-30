import dns from "node:dns";
import express from "express";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";

// Some hosts have no working IPv6 route, and a request to a site that has both kinds of address
// then fails with "fetch failed". Asking for the IPv4 address first avoids that.
dns.setDefaultResultOrder("ipv4first");

// A host such as Render gives the port in PORT. On your computer it is 3002.
const PORT = process.env.PORT || 3002;

// The database is one file: server/data/messages.db
mkdirSync("data", { recursive: true });
const db = new Database("data/messages.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
const insert = db.prepare(
  "INSERT INTO messages (name, email, message, ip) VALUES (?, ?, ?, ?)"
);

// A very small rate limit kept in memory: 5 messages per IP per 10 minutes
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 5) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

// The real reason a request failed (the short message "fetch failed" hides it)
function why(err) {
  const c = err && err.cause;
  return [err && err.message, c && (c.code || c.name), c && c.message].filter(Boolean).join(" | ");
}

/* Every message is also sent to my phone through a Telegram bot, so it is never lost
   (a free host can wipe the database file when it restarts).
   It needs two settings on the host: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
   What happened is always written in the logs. */
async function notify(name, email, message, flagged) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chat = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chat) {
    const missing = [!token && "TELEGRAM_BOT_TOKEN", !chat && "TELEGRAM_CHAT_ID"].filter(Boolean).join(" and ");
    console.log(`Telegram is NOT set up on this server: ${missing} is missing.`);
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: `${flagged ? "[spam trap was filled] " : ""}New portfolio message\n\nName: ${name}\nEmail: ${email}\n\n${message}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) console.log("Telegram notification sent.");
    else console.error("Telegram notification FAILED:", res.status, await res.text());
  } catch (err) {
    console.error("Telegram notification FAILED:", why(err));
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = express();
// Online, the server sits behind other servers: the visitor's address is in a header
app.set("trust proxy", true);
app.use(express.json({ limit: "10kb" }));

// One line in the logs for every request to the API (except the health check, which is very frequent)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") && req.path !== "/api/health") console.log(req.method, req.path);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Open this address in a browser to see if this server can reach Telegram.
// It only asks Telegram who the bot is: no message is sent, and the token is never shown.
app.get("/api/telegram-check", async (req, res) => {
  if (tooMany("check:" + req.ip)) return res.status(429).json({ ok: false, error: "Try again in a few minutes." });
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) return res.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not set" });
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(8000) });
    const data = await r.json().catch(() => ({}));
    res.json({ ok: r.ok, status: r.status, bot: data.result && data.result.username });
  } catch (err) {
    res.json({ ok: false, error: why(err) });
  }
});

app.post("/api/contact", async (req, res) => {
  const { name, email, message, extra_note } = req.body || {};

  // A hidden field that people never see and bots fill in. A browser's autofill can fill it too,
  // and a real message must never be lost, so the message is still checked and saved.
  // It is only marked, so that I can see it.
  const flagged = typeof extra_note === "string" && extra_note.trim() !== "";
  if (flagged) console.log("The hidden spam-trap field was filled (a bot, or the browser's autofill). Saving the message anyway.");

  // Validate on the server too. The browser checks can be skipped.
  const n = typeof name === "string" ? name.trim() : "";
  const e = typeof email === "string" ? email.trim() : "";
  const m = typeof message === "string" ? message.trim() : "";

  if (!n || n.length > 100) {
    return res.status(400).json({ error: "Please enter your name." });
  }
  if (!EMAIL.test(e) || e.length > 254) {
    return res.status(400).json({ error: "Please enter a valid email." });
  }
  if (!m || m.length > 2000) {
    return res.status(400).json({ error: "Please write a message (up to 2000 characters)." });
  }

  if (tooMany(req.ip)) {
    return res.status(429).json({ error: "Too many messages. Please try again later." });
  }

  insert.run(n, e, m, req.ip);
  console.log("Message saved.");
  await notify(n, e, m, flagged);
  res.status(201).json({ ok: true });
});

app.listen(PORT, () => {
  const ready = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID;
  console.log(`API running on port ${PORT}. Telegram: ${ready ? "set up" : "NOT set up"}.`);
});