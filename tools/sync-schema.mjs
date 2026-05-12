import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "001_initial_schema.sql");
const target = path.join(root, "supabase", "migrations", "0001_initial_schema.sql");

if (!fs.existsSync(source)) {
  throw new Error(`Missing schema source: ${source}`);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`Synced schema to ${target}`);

