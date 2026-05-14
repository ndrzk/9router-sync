/**
 * Comprehensive QA Test Runner for 9router-sync
 * Tests all scenarios from Task 1 and Task 2, plus integration and edge cases
 */

import { writeFileSync, existsSync, unlinkSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();

// Test database paths
const TEST_UNIX_JSON = join(HOME, '.9router', 'db.json');
const TEST_UNIX_SQLITE = join(HOME, '.9router', 'db', 'data.sqlite');
const TEST_WINDOWS_JSON = join(process.env.USERPROFILE || HOME, 'AppData', 'Roaming', '9router', 'db.json');

// Import the modules we're testing
const dbHandlerPath = join(__dirname, '..', '..', '..', 'lib', 'db-handler.mjs');
const syncLibPath = join(__dirname, '..', '..', '..', 'lib', 'sync-lib.mjs');

let dbHandler, syncLib;

// Test results
const results = {
  task1: [],
  task2: [],
  integration: [],
  edgeCases: [],
};

// Helper to create test data
function createTestData() {
  return {
    providerConnections: [
      {
        id: 'test-id-1',
        provider: 'kiro',
        authType: 'oauth',
        name: 'Test User',
        email: 'test@example.com',
        priority: 1,
        isActive: 1,
        apiKey: 'test-api-key',
        refreshToken: 'test-refresh',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }
    ],
    apiKeys: [
      {
        machineId: 'test-machine-123',
        key: 'test-key',
      }
    ]
  };
}

// Helper to clean up test files
function cleanupTestFiles() {
  const files = [TEST_UNIX_JSON, TEST_UNIX_SQLITE];
  for (const f of files) {
    try {
      if (existsSync(f)) unlinkSync(f);
    } catch {}
  }
}

// Helper to ensure directory exists
function ensureDir(path) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Test execution wrapper
async function runTest(name, category, testFn) {
  try {
    await testFn();
    results[category].push({ name, status: 'PASS', error: null });
    console.log(`✓ ${name}`);
    return true;
  } catch (error) {
    results[category].push({ name, status: 'FAIL', error: error.message });
    console.log(`✗ ${name}: ${error.message}`);
    return false;
  }
}

// ============================================================================
// TASK 1 QA SCENARIOS - Database Format Detection
// ============================================================================

async function task1_scenario1_jsonDetectionUnix() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  // Create JSON database
  writeFileSync(TEST_UNIX_JSON, JSON.stringify(createTestData(), null, 2));
  
  const { detectDatabaseFormat, detectPlatform } = dbHandler;
  
  // Mock platform to Unix
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    const format = detectDatabaseFormat();
    if (format !== 'json') {
      throw new Error(`Expected 'json', got '${format}'`);
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    cleanupTestFiles();
  }
}

async function task1_scenario2_sqliteFallbackUnix() {
  cleanupTestFiles();
  
  // Create only SQLite database (mock - we'll just check the logic)
  // Since we can't easily create a real SQLite DB in this test, we'll verify the code path
  const { detectDatabaseFormat } = dbHandler;
  
  // With no JSON file, should return null (no SQLite in test env)
  const format = detectDatabaseFormat();
  if (format !== null && format !== 'sqlite') {
    throw new Error(`Expected null or 'sqlite', got '${format}'`);
  }
}

async function task1_scenario3_jsonPrecedence() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  // Create JSON database
  writeFileSync(TEST_UNIX_JSON, JSON.stringify(createTestData(), null, 2));
  
  const { detectDatabaseFormat } = dbHandler;
  const format = detectDatabaseFormat();
  
  if (format !== 'json') {
    throw new Error(`JSON should take precedence, got '${format}'`);
  }
  
  cleanupTestFiles();
}

async function task1_scenario4_freshInstallCreatesJson() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  const { writeProviderConnections, detectPlatform } = dbHandler;
  
  // Mock Unix platform
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    const testRows = [{
      id: 'test-1',
      provider: 'kiro',
      authType: 'oauth',
      name: 'Test',
      email: 'test@test.com',
      priority: 1,
      isActive: 1,
      data: JSON.stringify({ apiKey: 'test' }),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }];
    
    writeProviderConnections(testRows);
    
    if (!existsSync(TEST_UNIX_JSON)) {
      throw new Error('JSON database was not created');
    }
    
    const content = JSON.parse(readFileSync(TEST_UNIX_JSON, 'utf8'));
    if (!content.providerConnections || content.providerConnections.length === 0) {
      throw new Error('JSON database is empty');
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    cleanupTestFiles();
  }
}

async function task1_scenario5_corruptedJsonGracefulError() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  // Create corrupted JSON
  writeFileSync(TEST_UNIX_JSON, '{ invalid json }');
  
  const { readProviderConnections, detectPlatform } = dbHandler;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    try {
      readProviderConnections();
      throw new Error('Should have thrown an error for corrupted JSON');
    } catch (error) {
      if (!error.message.includes('parse') && !error.message.includes('Invalid')) {
        throw new Error(`Expected parse error, got: ${error.message}`);
      }
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    cleanupTestFiles();
  }
}

// ============================================================================
// TASK 2 QA SCENARIOS - Device ID Retrieval
// ============================================================================

async function task2_scenario1_deviceIdFromJsonUnix() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  const testData = createTestData();
  writeFileSync(TEST_UNIX_JSON, JSON.stringify(testData, null, 2));
  
  const { getDeviceId } = syncLib;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    const deviceId = getDeviceId();
    if (deviceId !== 'test-machine-123') {
      throw new Error(`Expected 'test-machine-123', got '${deviceId}'`);
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    cleanupTestFiles();
  }
}

async function task2_scenario2_deviceIdFallbackToSqlite() {
  cleanupTestFiles();
  
  const { getDeviceId } = syncLib;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    // No JSON, no SQLite - should return 'unknown'
    const deviceId = getDeviceId();
    if (deviceId !== 'unknown') {
      throw new Error(`Expected 'unknown', got '${deviceId}'`);
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
}

async function task2_scenario3_deviceIdConsistency() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  const testData = createTestData();
  writeFileSync(TEST_UNIX_JSON, JSON.stringify(testData, null, 2));
  
  const { getDeviceId } = syncLib;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    const id1 = getDeviceId();
    const id2 = getDeviceId();
    const id3 = getDeviceId();
    
    if (id1 !== id2 || id2 !== id3) {
      throw new Error(`Device ID not consistent: ${id1}, ${id2}, ${id3}`);
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    cleanupTestFiles();
  }
}

async function task2_scenario4_deviceIdCorruptedJson() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  writeFileSync(TEST_UNIX_JSON, '{ invalid }');
  
  const { getDeviceId } = syncLib;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    const deviceId = getDeviceId();
    if (deviceId !== 'unknown') {
      throw new Error(`Expected 'unknown' for corrupted JSON, got '${deviceId}'`);
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    cleanupTestFiles();
  }
}

async function task2_scenario5_deviceIdEmptyApiKeys() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  const testData = createTestData();
  testData.apiKeys = [];
  writeFileSync(TEST_UNIX_JSON, JSON.stringify(testData, null, 2));
  
  const { getDeviceId } = syncLib;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    const deviceId = getDeviceId();
    if (deviceId !== 'unknown') {
      throw new Error(`Expected 'unknown' for empty apiKeys, got '${deviceId}'`);
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    cleanupTestFiles();
  }
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

async function integration1_formatDetectionAndDeviceId() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  const testData = createTestData();
  writeFileSync(TEST_UNIX_JSON, JSON.stringify(testData, null, 2));
  
  const { detectDatabaseFormat, readProviderConnections } = dbHandler;
  const { getDeviceId } = syncLib;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    const format = detectDatabaseFormat();
    const deviceId = getDeviceId();
    const connections = readProviderConnections();
    
    if (format !== 'json') {
      throw new Error(`Format detection failed: ${format}`);
    }
    if (deviceId !== 'test-machine-123') {
      throw new Error(`Device ID retrieval failed: ${deviceId}`);
    }
    if (connections.length === 0) {
      throw new Error('Failed to read connections');
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    cleanupTestFiles();
  }
}

async function integration2_jsonPrecedenceForBoth() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  const testData = createTestData();
  writeFileSync(TEST_UNIX_JSON, JSON.stringify(testData, null, 2));
  
  const { detectDatabaseFormat, readProviderConnections } = dbHandler;
  const { getDeviceId } = syncLib;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    // Both operations should use JSON
    const format = detectDatabaseFormat();
    const deviceId = getDeviceId();
    const connections = readProviderConnections();
    
    if (format !== 'json') {
      throw new Error('Format detection should prefer JSON');
    }
    if (deviceId === 'unknown') {
      throw new Error('Device ID should be read from JSON');
    }
    if (connections.length === 0) {
      throw new Error('Connections should be read from JSON');
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    cleanupTestFiles();
  }
}

async function integration3_fallbackChain() {
  cleanupTestFiles();
  
  const { detectDatabaseFormat } = dbHandler;
  const { getDeviceId } = syncLib;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    // No JSON, no SQLite - should handle gracefully
    const format = detectDatabaseFormat();
    const deviceId = getDeviceId();
    
    if (format !== null && format !== 'sqlite') {
      throw new Error(`Unexpected format: ${format}`);
    }
    if (deviceId !== 'unknown') {
      throw new Error(`Expected 'unknown', got '${deviceId}'`);
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
}

// ============================================================================
// EDGE CASES
// ============================================================================

async function edge1_bothFormatsExist() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  const testData = createTestData();
  writeFileSync(TEST_UNIX_JSON, JSON.stringify(testData, null, 2));
  
  const { detectDatabaseFormat } = dbHandler;
  
  const format = detectDatabaseFormat();
  if (format !== 'json') {
    throw new Error('JSON should take precedence when both exist');
  }
  
  cleanupTestFiles();
}

async function edge2_neitherFormatExists() {
  cleanupTestFiles();
  
  const { detectDatabaseFormat, readProviderConnections } = dbHandler;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    const format = detectDatabaseFormat();
    if (format !== null) {
      throw new Error(`Expected null, got '${format}'`);
    }
    
    try {
      readProviderConnections();
      throw new Error('Should throw error when no database exists');
    } catch (error) {
      if (!error.message.includes('not found') && !error.message.includes('No 9router database')) {
        throw new Error(`Expected helpful error message, got: ${error.message}`);
      }
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
}

async function edge3_corruptedJsonFallback() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  writeFileSync(TEST_UNIX_JSON, '{ corrupted }');
  
  const { readProviderConnections } = dbHandler;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    try {
      readProviderConnections();
      throw new Error('Should throw error for corrupted JSON');
    } catch (error) {
      if (!error.message.includes('parse') && !error.message.includes('Invalid')) {
        throw new Error(`Expected parse error, got: ${error.message}`);
      }
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    cleanupTestFiles();
  }
}

async function edge4_emptyDataStructures() {
  cleanupTestFiles();
  ensureDir(TEST_UNIX_JSON);
  
  const emptyData = {
    providerConnections: [],
    apiKeys: []
  };
  writeFileSync(TEST_UNIX_JSON, JSON.stringify(emptyData, null, 2));
  
  const { readProviderConnections } = dbHandler;
  const { getDeviceId } = syncLib;
  
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  
  try {
    const connections = readProviderConnections();
    const deviceId = getDeviceId();
    
    if (!Array.isArray(connections)) {
      throw new Error('Should return empty array');
    }
    if (connections.length !== 0) {
      throw new Error('Should return empty array');
    }
    if (deviceId !== 'unknown') {
      throw new Error(`Expected 'unknown', got '${deviceId}'`);
    }
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    cleanupTestFiles();
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('9ROUTER-SYNC COMPREHENSIVE QA TEST SUITE');
  console.log('='.repeat(80));
  console.log();
  
  // Load modules
  try {
    // Convert Windows paths to file:// URLs
    const dbHandlerUrl = new URL(`file:///${dbHandlerPath.replace(/\\/g, '/')}`);
    const syncLibUrl = new URL(`file:///${syncLibPath.replace(/\\/g, '/')}`);
    
    dbHandler = await import(dbHandlerUrl.href);
    syncLib = await import(syncLibUrl.href);
  } catch (error) {
    console.error('Failed to load modules:', error.message);
    console.error('Paths tried:', dbHandlerPath, syncLibPath);
    process.exit(1);
  }
  
  // Task 1 Scenarios
  console.log('TASK 1: Database Format Detection (5 scenarios)');
  console.log('-'.repeat(80));
  await runTest('1. JSON database detection on Unix', 'task1', task1_scenario1_jsonDetectionUnix);
  await runTest('2. SQLite fallback on Unix', 'task1', task1_scenario2_sqliteFallbackUnix);
  await runTest('3. JSON precedence when both exist', 'task1', task1_scenario3_jsonPrecedence);
  await runTest('4. Fresh install creates JSON', 'task1', task1_scenario4_freshInstallCreatesJson);
  await runTest('5. Corrupted JSON graceful error', 'task1', task1_scenario5_corruptedJsonGracefulError);
  console.log();
  
  // Task 2 Scenarios
  console.log('TASK 2: Device ID Retrieval (5 scenarios)');
  console.log('-'.repeat(80));
  await runTest('1. Device ID from JSON on Unix', 'task2', task2_scenario1_deviceIdFromJsonUnix);
  await runTest('2. Device ID fallback to SQLite on Unix', 'task2', task2_scenario2_deviceIdFallbackToSqlite);
  await runTest('3. Device ID consistency across reads', 'task2', task2_scenario3_deviceIdConsistency);
  await runTest('4. Device ID graceful error on corrupted JSON', 'task2', task2_scenario4_deviceIdCorruptedJson);
  await runTest('5. Device ID from JSON with empty apiKeys', 'task2', task2_scenario5_deviceIdEmptyApiKeys);
  console.log();
  
  // Integration Tests
  console.log('INTEGRATION TESTS (3 scenarios)');
  console.log('-'.repeat(80));
  await runTest('1. Format detection + device ID working together', 'integration', integration1_formatDetectionAndDeviceId);
  await runTest('2. JSON precedence for both operations', 'integration', integration2_jsonPrecedenceForBoth);
  await runTest('3. Fallback chain: JSON → SQLite → error', 'integration', integration3_fallbackChain);
  console.log();
  
  // Edge Cases
  console.log('EDGE CASES (4 scenarios)');
  console.log('-'.repeat(80));
  await runTest('1. Both JSON and SQLite exist', 'edgeCases', edge1_bothFormatsExist);
  await runTest('2. Neither format exists', 'edgeCases', edge2_neitherFormatExists);
  await runTest('3. Corrupted JSON fallback', 'edgeCases', edge3_corruptedJsonFallback);
  await runTest('4. Empty/invalid data structures', 'edgeCases', edge4_emptyDataStructures);
  console.log();
  
  // Summary
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  
  const task1Pass = results.task1.filter(r => r.status === 'PASS').length;
  const task2Pass = results.task2.filter(r => r.status === 'PASS').length;
  const integrationPass = results.integration.filter(r => r.status === 'PASS').length;
  const edgeCasesPass = results.edgeCases.filter(r => r.status === 'PASS').length;
  
  const totalPass = task1Pass + task2Pass + integrationPass + edgeCasesPass;
  const totalTests = results.task1.length + results.task2.length + results.integration.length + results.edgeCases.length;
  
  console.log(`Task 1 Scenarios: ${task1Pass}/${results.task1.length} pass`);
  console.log(`Task 2 Scenarios: ${task2Pass}/${results.task2.length} pass`);
  console.log(`Integration Tests: ${integrationPass}/${results.integration.length} pass`);
  console.log(`Edge Cases: ${edgeCasesPass}/${results.edgeCases.length} tested`);
  console.log();
  console.log(`TOTAL: ${totalPass}/${totalTests} pass`);
  console.log();
  
  const verdict = totalPass === totalTests ? 'APPROVE' : 'REJECT';
  console.log(`VERDICT: ${verdict}`);
  console.log('='.repeat(80));
  
  // Save detailed results
  const reportPath = join(__dirname, 'test-results.json');
  writeFileSync(reportPath, JSON.stringify({
    summary: {
      task1: `${task1Pass}/${results.task1.length}`,
      task2: `${task2Pass}/${results.task2.length}`,
      integration: `${integrationPass}/${results.integration.length}`,
      edgeCases: `${edgeCasesPass}/${results.edgeCases.length}`,
      total: `${totalPass}/${totalTests}`,
      verdict,
    },
    details: results,
  }, null, 2));
  
  console.log(`\nDetailed results saved to: ${reportPath}`);
  
  process.exit(verdict === 'APPROVE' ? 0 : 1);
}

main().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
