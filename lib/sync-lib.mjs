// Shared helpers for 9router-sync.
// Uses db-handler.mjs for cross-platform database access (Windows JSON / Unix SQLite).

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  readProviderConnections,
  writeProviderConnections,
  detectPlatform,
  DB_PATHS,
} from './db-handler.mjs';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

const HOME = homedir();
export const CONFIG_PATH = join(HOME, '.9router', 'sync.json');

// Export DB_PATH for backward compatibility (points to platform-specific path)
export const DB_PATH = detectPlatform() === 'windows' ? DB_PATHS.windows : DB_PATHS.unix;

export const CONFIG_TEMPLATE = `{
  "supabaseUrl": "https://YOUR-PROJECT.supabase.co",
  "supabaseKey": "SERVICE_ROLE_OR_ANON_KEY",
  "table": "router9_provider_connections"
}`;

export const SETUP_SQL = `-- Run once in the Supabase SQL editor.
create table if not exists public.router9_provider_connections (
  id           text primary key,
  provider     text not null,
  auth_type    text not null,
  name         text,
  email        text,
  priority     integer,
  is_active    integer default 1,
  data         jsonb not null,
  created_at   timestamptz not null,
  updated_at   timestamptz not null,
  device_id    text,
  synced_at    timestamptz not null default now()
);

-- Using the service_role key bypasses RLS and is fine for a personal setup.
-- With the anon key, add a policy matching auth.uid() or a shared secret.
`;

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `missing config: ${CONFIG_PATH}\n\n` +
        `create it:\n${CONFIG_TEMPLATE}\n\n` +
        `and run this SQL in Supabase:\n${SETUP_SQL}`,
    );
  }
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    throw new Error('sync.json must set supabaseUrl and supabaseKey');
  }
  cfg.table = cfg.table || 'router9_provider_connections';
  cfg.supabaseUrl = cfg.supabaseUrl.replace(/\/+$/, '');
  return cfg;
}

/**
 * Get device ID from database.
 * On Windows: reads from JSON apiKeys array.
 * On Unix: reads from JSON apiKeys array first, falls back to SQLite.
 * @returns {string} Device ID or 'unknown'
 */
export function getDeviceId() {
  const platform = detectPlatform();
  
  if (platform === 'windows') {
    const dbPath = DB_PATHS.windows;
    if (!existsSync(dbPath)) return 'unknown';
    
    try {
      const data = JSON.parse(readFileSync(dbPath, 'utf8'));
      if (data.apiKeys && Array.isArray(data.apiKeys) && data.apiKeys.length > 0) {
        const key = data.apiKeys.find(k => k.machineId && k.machineId !== '');
        return key?.machineId || 'unknown';
      }
    } catch {
      return 'unknown';
    }
    return 'unknown';
  } else {
    // Unix: check JSON first, then fallback to SQLite
    const jsonPath = DB_PATHS.unixJson;
    
    // Try JSON first
    if (existsSync(jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
        if (data.apiKeys && Array.isArray(data.apiKeys) && data.apiKeys.length > 0) {
          const key = data.apiKeys.find(k => k.machineId && k.machineId !== '');
          if (key?.machineId) return key.machineId;
        }
      } catch {
        // JSON parsing failed, fall through to SQLite
      }
    }
    
    // Fallback to SQLite
    const dbPath = DB_PATHS.unix;
    if (!existsSync(dbPath)) return 'unknown';
    
    try {
      // We need to read apiKeys table, but db-handler only exposes providerConnections
      // So we'll use the same loadBetterSqlite approach from db-handler
      // Use top-level require and HERE constants already defined at module level
      
      const candidates = [
        join(HERE, '..', 'node_modules', 'better-sqlite3'),
        join(HOME, '.9router', 'runtime', 'node_modules', 'better-sqlite3'),
        join(
          HOME,
          '.nvm',
          'versions',
          'node',
          `v${process.versions.node}`,
          'lib',
          'node_modules',
          'better-sqlite3'
        ),
        'better-sqlite3',
      ];
      
      let Database;
      for (const p of candidates) {
        try {
          Database = require(p);
          break;
        } catch {}
      }
      
      if (!Database) return 'unknown';
      
      const db = new Database(dbPath, { readonly: true, fileMustExist: true });
      try {
        const row = db
          .prepare(
            "SELECT machineId FROM apiKeys WHERE machineId IS NOT NULL AND machineId <> '' LIMIT 1"
          )
          .get();
        return row?.machineId || 'unknown';
      } finally {
        db.close();
      }
    } catch {
      return 'unknown';
    }
  }
}

export async function supaRequest(cfg, method, path, body) {
  const url = `${cfg.supabaseUrl}/rest/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: cfg.supabaseKey,
      authorization: `Bearer ${cfg.supabaseKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let hint = '';
    if (res.status === 404 || /relation .* does not exist/i.test(text)) {
      hint = `\n\ntable '${cfg.table}' is missing. run:\n${SETUP_SQL}`;
    }
    throw new Error(
      `supabase ${method} ${path} -> ${res.status} ${res.statusText}: ${text}${hint}`,
    );
  }
  return text ? JSON.parse(text) : null;
}

// SQLite row -> Supabase row (camelCase -> snake_case; data column -> jsonb).
export function rowToRemote(row, deviceId) {
  let data;
  try {
    data = JSON.parse(row.data);
  } catch {
    data = row.data;
  }
  return {
    id: row.id,
    provider: row.provider,
    auth_type: row.authType,
    name: row.name,
    email: row.email,
    priority: row.priority,
    is_active: row.isActive ? 1 : 0,
    data,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    device_id: deviceId,
  };
}

// Supabase row -> SQLite row.
export function remoteToRow(r) {
  return {
    id: r.id,
    provider: r.provider,
    authType: r.auth_type,
    name: r.name ?? null,
    email: r.email ?? null,
    priority: r.priority ?? null,
    isActive: r.is_active === 1 || r.is_active === true,
    data: typeof r.data === 'string' ? r.data : JSON.stringify(r.data),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function ts(s) {
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

export function label(provider, name, id) {
  const tag = name || provider || id.slice(0, 8);
  return `${provider || '?'}/${tag} (${id.slice(0, 8)}\u2026)`;
}

export function parseArgs(argv) {
  const out = { dryRun: false, pullOnly: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run' || a === '-n') out.dryRun = true;
    else if (a === '--pull-only') out.pullOnly = true;
    else if (a === '--init') out.init = true;
    else if (a === '-h' || a === '--help') out.help = true;
    else throw new Error(`unknown arg: ${a}`);
  }
  return out;
}
