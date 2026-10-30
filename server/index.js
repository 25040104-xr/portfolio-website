import express from "express";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";

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
    console.error("Telegram notification FAILED:", err.message);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = express();
// Online, the server sits behind other servers: the visitor's address is in a header
app.set("trust proxy", true);
app.use(express.json({ limit: "10kb" }));

// One line in the logs for every request to the API: it shows that a request really arrived
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) console.log(req.method, req.path);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
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