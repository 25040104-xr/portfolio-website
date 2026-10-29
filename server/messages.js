import Database from "better-sqlite3";

const db = new Database("data/messages.db", { readonly: true, fileMustExist: true });
const rows = db
  .prepare("SELECT id, created_at, name, email, message FROM messages ORDER BY id DESC LIMIT 20")
  .all();

console.table(rows);