/**
 * Platform-agnostic database handler for 9router-sync.
 * Supports Windows (JSON) and Unix (SQLite) database formats.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HOME = homedir();
const HERE = dirname(fileURLToPath(import.meta.url));

// Platform-specific paths
const WINDOWS_DB_PATH = join(
  process.env.USERPROFILE || HOME,
  'AppData',
  'Roaming',
  '9router',
  'db.json'
);
const UNIX_DB_PATH = join(HOME, '.9router', 'db', 'data.sqlite');

// SQLite columns (normalized schema)
const SQLITE_COLUMNS = [
  'id', 'provider', 'authType', 'name', 'email',
  'priority', 'isActive', 'data', 'createdAt', 'updatedAt'
];

/**
 * Detect the current platform.
 * @returns {'windows' | 'unix'}
 */
export function detectPlatform() {
  return platform() === 'win32' ? 'windows' : 'unix';
}

/**
 * Load better-sqlite3 from multiple candidate locations.
 * @returns {import('better-sqlite3')}
 */
function loadBetterSqlite() {
  const require = createRequire(import.meta.url);
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
  
  let lastErr;
  for (const p of candidates) {
    try {
      return require(p);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `better-sqlite3 not found. tried:\n  ${candidates.join('\n  ')}\n\n` +
    `install it against node ${process.versions.node}, e.g.\n` +
    `  npm i -g better-sqlite3\n\nlast error: ${lastErr?.message}`
  );
}

/**
 * Transform a Windows JSON row to normalized SQLite format.
 * Packs extra fields (apiKey, providerSpecificData, etc.) into `data` JSON string.
 * @param {object} winRow - Row from Windows db.json
 * @returns {object} Normalized row with `data` field
 */
function windowsRowToNormalized(winRow) {
  // Fields that go into the `data` JSON column
  const dataFields = {};
  const sqliteFields = {};
  
  for (const [key, value] of Object.entries(winRow)) {
    if (SQLITE_COLUMNS.includes(key)) {
      sqliteFields[key] = value;
    } else {
      dataFields[key] = value;
    }
  }
  
  return {
    id: sqliteFields.id,
    provider: sqliteFields.provider,
    authType: sqliteFields.authType,
    name: sqliteFields.name ?? null,
    email: sqliteFields.email ?? null,
    priority: sqliteFields.priority ?? null,
    isActive: sqliteFields.isActive ?? 1,
    data: JSON.stringify(dataFields),
    createdAt: sqliteFields.createdAt,
    updatedAt: sqliteFields.updatedAt,
  };
}

/**
 * Transform a normalized SQLite row to Windows JSON format.
 * Unpacks `data` JSON string into top-level fields.
 * @param {object} normRow - Normalized row from SQLite
 * @returns {object} Windows JSON row with flat structure
 */
function normalizedToWindowsRow(normRow) {
  const dataFields = typeof normRow.data === 'string' 
    ? JSON.parse(normRow.data) 
    : (normRow.data || {});
  
  return {
    id: normRow.id,
    provider: normRow.provider,
    authType: normRow.authType,
    name: normRow.name,
    email: normRow.email,
    priority: normRow.priority,
    isActive: normRow.isActive,
    createdAt: normRow.createdAt,
    updatedAt: normRow.updatedAt,
    ...dataFields,
  };
}

/**
 * Read provider connections from database.
 * @returns {Array<object>} Array of normalized provider connection rows
 * @throws {Error} If database not found or corrupted
 */
export function readProviderConnections() {
  const platformType = detectPlatform();
  
  if (platformType === 'windows') {
    return readWindowsJson();
  } else {
    return readUnixite();
  }
}

/**
 * Read from Windows JSON database.
 * @returns {Array<object>} Normalized rows
 */
function readWindowsJson() {
  if (!existsSync(WINDOWS_DB_PATH)) {
    throw new Error(`Windows database not found: ${WINDOWS_DB_PATH}`);
  }
  
  let data;
  try {
    data = JSON.parse(readFileSync(WINDOWS_DB_PATH, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to parse Windows database: ${e.message}`);
  }
  
  if (!data.providerConnections || !Array.isArray(data.providerConnections)) {
    throw new Error('Invalid Windows database: missing or invalid providerConnections array');
  }
  
  return data.providerConnections.map(windowsRowToNormalized);
}

/**
 * Read from Unix SQLite database.
 * @returns {Array<object>} Normalized rows
 */
function readUnixite() {
  if (!existsSync(UNIX_DB_PATH)) {
    throw new Error(`Unix database not found: ${UNIX_DB_PATH}`);
  }
  
  const Database = loadBetterSqlite();
  const db = new Database(UNIX_DB_PATH, { readonly: true, fileMustExist: true });
  
  try {
    const rows = db.prepare('SELECT * FROM providerConnections').all();
    return rows;
  } finally {
    db.close();
  }
}

/**
 * Write provider connections to database.
 * @param {Array<object>} rows - Array of normalized provider connection rows
 * @throws {Error} If write fails
 */
export function writeProviderConnections(rows) {
  const platformType = detectPlatform();
  
  if (platformType === 'windows') {
    writeWindowsJson(rows);
  } else {
    writeUnixite(rows);
  }
}

/**
 * Write to Windows JSON database.
 * @param {Array<object>} rows - Normalized rows
 */
function writeWindowsJson(rows) {
  // Read existing DB to preserve other data
  let existingData = {};
  if (existsSync(WINDOWS_DB_PATH)) {
    try {
      existingData = JSON.parse(readFileSync(WINDOWS_DB_PATH, 'utf8'));
    } catch {
      // Start fresh if corrupted
    }
  }
  
  const windowsRows = rows.map(normalizedToWindowsRow);
  
  const newData = {
    ...existingData,
    providerConnections: windowsRows,
  };
  
  try {
    writeFileSync(WINDOWS_DB_PATH, JSON.stringify(newData, null, 2), 'utf8');
  } catch (e) {
    throw new Error(`Failed to write Windows database: ${e.message}`);
  }
}

/**
 * Write to Unix SQLite database.
 * @param {Array<object>} rows - Normalized rows
 */
function writeUnixite(rows) {
  if (!existsSync(UNIX_DB_PATH)) {
    throw new Error(`Unix database not found: ${UNIX_DB_PATH}`);
  }
  
  const Database = loadBetterSqlite();
  const db = new Database(UNIX_DB_PATH, { readonly: false, fileMustExist: true });
  
  try {
    const upsert = db.prepare(`
      INSERT INTO providerConnections
        (id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt)
      VALUES
        (@id, @provider, @authType, @name, @email, @priority, @isActive, @data, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        provider  = excluded.provider,
        authType  = excluded.authType,
        name      = excluded.name,
        email     = excluded.email,
        priority  = excluded.priority,
        isActive  = excluded.isActive,
        data      = excluded.data,
        createdAt = excluded.createdAt,
        updatedAt = excluded.updatedAt
    `);
    
    const tx = db.transaction(() => {
      for (const r of rows) upsert.run(r);
    });
    
    tx();
  } finally {
    db.close();
  }
}

// Export paths for testing
export const DB_PATHS = {
  windows: WINDOWS_DB_PATH,
  unix: UNIX_DB_PATH,
};
