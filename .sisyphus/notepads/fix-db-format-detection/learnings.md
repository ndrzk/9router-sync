# Learnings - fix-db-format-detection

## Conventions & Patterns

(Subagents will append findings here after each task)
## Task 1: Database Format Detection

### Implementation
- Added \UNIX_JSON_PATH\ constant: \join(HOME, '.9router', 'db.json')\
- Added \detectDatabaseFormat()\ function: returns 'json', 'sqlite', or null
- Added \eadUnixJson()\ function: reads JSON database on Unix
- Added \writeUnixJson()\ function: writes JSON database on Unix
- Updated \eadProviderConnections()\: detects format, uses JSON first on Unix
- Updated \writeProviderConnections()\: detects format, creates JSON on fresh install
- Updated \DB_PATHS\ export: added \unixJson\ field

### Pattern Used
- Detection pattern follows existing \detectPlatform()\ style
- JSON read/write functions mirror \eadWindowsJson\/\writeWindowsJson\ pattern
- Error handling with try-catch around JSON.parse()
- Graceful error messages for corrupted JSON

### Verified
- Module loads without errors
- \detectDatabaseFormat()\ returns 'json' when JSON exists
- \eadProviderConnections()\ successfully reads from JSON database
- \DB_PATHS.unixJson\ correctly exported


## Task 2: Device ID Retrieval for Unix JSON

### Implementation
- Updated `getDeviceId()` function in `lib/sync-lib.mjs`
- Added JSON-first check on Unix platform using `DB_PATHS.unixJson`
- Reused JSON parsing and `machineId` extraction pattern from Windows branch
- Fallback to SQLite if JSON doesn't exist or parsing fails
- Error handling: try-catch around JSON operations

### Pattern Used
- JSON check mirrors Windows branch pattern (lines 77-90)
- Same `apiKeys` array traversal with `find()` method
- Graceful fallback: JSON -> SQLite -> 'unknown'

### QA Results (All 5 Scenarios Passed)
1. Device ID from JSON: Returns correct machineId from JSON
2. SQLite Fallback: Falls through to SQLite when JSON missing/invalid
3. Consistency: Multiple reads return identical results
4. Corrupted JSON: Catches error, falls through gracefully
5. Empty apiKeys: Returns unknown, falls through to SQLite

### Files Modified
- `lib/sync-lib.mjs`: Updated `getDeviceId()` function (lines 74-152)

### Verified
- Module loads without errors
- `getDeviceId()` returns correct device ID on Windows
- Unix branch logic tested via simulation on Windows
- Evidence saved to `.sisyphus/evidence/task-2-*.txt`
