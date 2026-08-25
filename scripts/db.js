// Applies a SQL file (or inline query) directly to the project's Supabase
// Postgres database. Reads the connection string from .env (SUPABASE_DB_URL)
// so migrations under supabase/*.sql can be run without pasting them into
// the Supabase SQL Editor by hand.
//
// Usage: node scripts/db.js supabase/01_schema.sql
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(root, '.env');
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnv();
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('SUPABASE_DB_URL is not set in .env');
    process.exit(1);
  }

  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/db.js <path-to-sql-file>');
    process.exit(1);
  }

  const sql = fs.readFileSync(path.resolve(root, filePath), 'utf-8');

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const result = await client.query(sql);
    const results = Array.isArray(result) ? result : [result];
    for (const r of results) {
      if (r.rows && r.rows.length > 0) {
        console.log(JSON.stringify(r.rows, null, 2));
      } else {
        console.log(`OK (${r.command ?? 'statement'}, ${r.rowCount ?? 0} rows affected)`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('SQL execution failed:', err.message);
  process.exit(1);
});
