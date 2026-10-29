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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = express();
// Online, the server sits behind other servers: the visitor's address is in a header
app.set("trust proxy", true);
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/contact", (req, res) => {
  const { name, email, message, extra_note } = req.body || {};

  // Honeypot: people never see this field, bots fill it in.
  // Answer "ok" anyway so a bot does not learn it was caught.
  if (extra_note) return res.status(200).json({ ok: true });

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
  res.status(201).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});