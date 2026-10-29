import Database from "better-sqlite3";

const db = new Database("data/messages.db", { fileMustExist: true });
const { changes } = db.prepare("DELETE FROM messages").run();
console.log(`Deleted ${changes} message(s).`);