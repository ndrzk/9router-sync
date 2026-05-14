/**
 * Regression test suite for JSON merge behavior in db-handler.mjs
 * Uses Node's built-in test runner (node:test) - no external dependencies
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeRowsById, writeProviderConnections, readProviderConnections, DB_PATHS } from '../lib/db-handler.mjs';

// Test fixture helpers
let testDir;
let originalEnv;

beforeEach(() => {
  // Create isolated temp directory for each test
  testDir = join(tmpdir(), `9router-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(testDir, { recursive: true });
  
  // Save original env
  originalEnv = { ...process.env };
});

afterEach(() => {
  // Clean up temp directory
  if (testDir && existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
  
  // Restore env
  process.env = originalEnv;
});

describe('mergeRowsById', () => {
  test('1. Headline regression: disjoint merge preserves all rows', () => {
    const existing = [
      { id: 'a', provider: 'test', data: '{}' },
      { id: 'b', provider: 'test', data: '{}' },
      { id: 'c', provider: 'test', data: '{}' }
    ];
    const incoming = [
      { id: 'd', provider: 'test', data: '{}' },
      { id: 'e', provider: 'test', data: '{}' }
    ];
    
    const result = mergeRowsById(existing, incoming);
    
    assert.equal(result.length, 5, 'Should have 5 rows total (3 existing + 2 incoming)');
    assert.deepEqual(
      result.map(r => r.id).sort(),
      ['a', 'b', 'c', 'd', 'e'],
      'Should contain all IDs from both arrays'
    );
  });

  test('2. Conflict resolution: incoming wins on ID collision', () => {
    const existing = [
      { id: 'x', provider: 'old', data: '{"version":1}' },
      { id: 'y', provider: 'test', data: '{}' }
    ];
    const incoming = [
      { id: 'x', provider: 'new', data: '{"version":2}' }
    ];
    
    const result = mergeRowsById(existing, incoming);
    
    assert.equal(result.length, 2, 'Should have 2 rows (1 merged, 1 preserved)');
    const xRow = result.find(r => r.id === 'x');
    assert.equal(xRow.provider, 'new', 'Incoming row should win on conflict');
    assert.equal(xRow.data, '{"version":2}', 'Incoming data should replace existing');
  });

  test('3. Empty incoming preserves existing rows', () => {
    const existing = [
      { id: 'a', provider: 'test', data: '{}' },
      { id: 'b', provider: 'test', data: '{}' }
    ];
    const incoming = [];
    
    const result = mergeRowsById(existing, incoming);
    
    assert.equal(result.length, 2, 'Should preserve all existing rows');
    assert.deepEqual(result, existing, 'Result should match existing exactly');
  });
});

describe('JSON writer integration', () => {
  test('4. Fresh install: file absent creates new file with incoming rows', async () => {
    // Use actual platform DB path for this test
    const actualDbPath = process.platform === 'win32' ? DB_PATHS.windows : DB_PATHS.unixJson;
    const actualDbDir = join(actualDbPath, '..');
    
    // Backup existing DB if present
    let backup = null;
    if (existsSync(actualDbPath)) {
      backup = readFileSync(actualDbPath, 'utf8');
      unlinkSync(actualDbPath);
    }
    
    try {
      // Ensure directory exists
      mkdirSync(actualDbDir, { recursive: true });
      
      const incomingRows = [
        {
          id: 'fresh-1',
          provider: 'test',
          authType: 'oauth',
          data: '{}',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];
      
      // Write should create new file
      writeProviderConnections(incomingRows);
      
      // Verify file was created
      assert.ok(existsSync(actualDbPath), 'DB file should be created');
      
      const content = JSON.parse(readFileSync(actualDbPath, 'utf8'));
      assert.equal(content.providerConnections.length, 1, 'Should have 1 row');
      assert.equal(content.providerConnections[0].id, 'fresh-1', 'Should contain incoming row');
    } finally {
      // Restore backup or clean up
      if (backup) {
        writeFileSync(actualDbPath, backup, 'utf8');
      } else if (existsSync(actualDbPath)) {
        unlinkSync(actualDbPath);
      }
    }
  });

  test('5. Sibling keys preserved: apiKeys and settings unchanged', () => {
    const actualDbPath = process.platform === 'win32' ? DB_PATHS.windows : DB_PATHS.unixJson;
    const actualDbDir = join(actualDbPath, '..');
    
    // Backup existing DB
    let backup = null;
    if (existsSync(actualDbPath)) {
      backup = readFileSync(actualDbPath, 'utf8');
    }
    
    try {
      // Ensure directory exists
      mkdirSync(actualDbDir, { recursive: true });
      
      // Create existing DB with sibling keys
      const existingDb = {
        providerConnections: [
          { id: 'existing', provider: 'test', authType: 'oauth', data: '{}', createdAt: '2024-01-01', updatedAt: '2024-01-01' }
        ],
        apiKeys: [
          { machineId: 'device-a', key: 'secret-key' }
        ],
        settings: {
          theme: 'dark',
          autoSync: true
        }
      };
      
      writeFileSync(actualDbPath, JSON.stringify(existingDb, null, 2), 'utf8');
      
      const incomingRows = [
        {
          id: 'new-row',
          provider: 'test',
          authType: 'oauth',
          data: '{}',
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z'
        }
      ];
      
      writeProviderConnections(incomingRows);
      
      const result = JSON.parse(readFileSync(actualDbPath, 'utf8'));
      
      assert.equal(result.providerConnections.length, 2, 'Should have 2 rows (1 existing + 1 new)');
      assert.deepEqual(result.apiKeys, existingDb.apiKeys, 'apiKeys should be preserved');
      assert.deepEqual(result.settings, existingDb.settings, 'settings should be preserved');
    } finally {
      // Restore backup
      if (backup) {
        writeFileSync(actualDbPath, backup, 'utf8');
      } else if (existsSync(actualDbPath)) {
        unlinkSync(actualDbPath);
      }
    }
  });

  test('6. Corrupted JSON throws error (fail-loud)', () => {
    const actualDbPath = process.platform === 'win32' ? DB_PATHS.windows : DB_PATHS.unixJson;
    const actualDbDir = join(actualDbPath, '..');
    
    // Backup existing DB
    let backup = null;
    if (existsSync(actualDbPath)) {
      backup = readFileSync(actualDbPath, 'utf8');
    }
    
    try {
      // Ensure directory exists
      mkdirSync(actualDbDir, { recursive: true });
      
      // Write corrupted JSON
      writeFileSync(actualDbPath, '{invalid json here', 'utf8');
      
      const incomingRows = [
        {
          id: 'test',
          provider: 'test',
          authType: 'oauth',
          data: '{}',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];
      
      // Should throw error instead of silently creating new file
      assert.throws(
        () => writeProviderConnections(incomingRows),
        /unparseable/i,
        'Should throw error on corrupted JSON'
      );
    } finally {
      // Restore backup
      if (backup) {
        writeFileSync(actualDbPath, backup, 'utf8');
      } else if (existsSync(actualDbPath)) {
        unlinkSync(actualDbPath);
      }
    }
  });

  test('7. Round-trip: write empty array then verify existing rows preserved', () => {
    const actualDbPath = process.platform === 'win32' ? DB_PATHS.windows : DB_PATHS.unixJson;
    const actualDbDir = join(actualDbPath, '..');
    
    // Backup existing DB
    let backup = null;
    if (existsSync(actualDbPath)) {
      backup = readFileSync(actualDbPath, 'utf8');
    }
    
    try {
      // Ensure directory exists
      mkdirSync(actualDbDir, { recursive: true });
      
      // Create initial DB
      const initialDb = {
        providerConnections: [
          { id: 'keep-me', provider: 'test', authType: 'oauth', data: '{}', createdAt: '2024-01-01', updatedAt: '2024-01-01' }
        ]
      };
      writeFileSync(actualDbPath, JSON.stringify(initialDb, null, 2), 'utf8');
      
      // Write empty array (should preserve existing)
      writeProviderConnections([]);
      
      const result = JSON.parse(readFileSync(actualDbPath, 'utf8'));
      assert.equal(result.providerConnections.length, 1, 'Existing row should be preserved');
      assert.equal(result.providerConnections[0].id, 'keep-me', 'Original row should remain');
    } finally {
      // Restore backup
      if (backup) {
        writeFileSync(actualDbPath, backup, 'utf8');
      } else if (existsSync(actualDbPath)) {
        unlinkSync(actualDbPath);
      }
    }
  });

  test('8. Cross-platform path selection: test runs on current platform', () => {
    // Verify DB_PATHS export contains expected paths
    assert.ok(DB_PATHS.windows, 'Should export Windows path');
    assert.ok(DB_PATHS.unixJson, 'Should export Unix JSON path');
    
    // Verify current platform path is used
    const expectedPath = process.platform === 'win32' 
      ? DB_PATHS.windows 
      : DB_PATHS.unixJson;
    
    assert.ok(expectedPath.includes('9router'), 'Path should contain 9router directory');
    assert.ok(expectedPath.endsWith('db.json'), 'Path should end with db.json');
    
    // Verify path structure matches platform
    if (process.platform === 'win32') {
      assert.ok(expectedPath.includes('AppData'), 'Windows path should use AppData');
      assert.ok(expectedPath.includes('Roaming'), 'Windows path should use Roaming');
    } else {
      assert.ok(expectedPath.includes('.9router'), 'Unix path should use .9router');
    }
  });
});
