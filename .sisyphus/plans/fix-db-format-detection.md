# Fix Database Format Detection on Unix

## TL;DR

> **Quick Summary**: Enable 9router-sync to work with JSON databases on Unix systems (VPS case) while maintaining backward compatibility with SQLite installations.
> 
> **Deliverables**:
> - Auto-detect database format on Unix (JSON first, SQLite fallback)
> - Update device ID retrieval to support JSON on Unix
> - Maintain backward compatibility with existing SQLite installations
> 
> **Estimated Effort**: Short (1-2 hours)
> **Parallel Execution**: NO - sequential (only 2 tasks)
> **Critical Path**: Task 1 → Task 2

---

## Context

### Original Request
User's VPS running Linux has 9router database in JSON format at `~/.9router/db.json`, but 9router-sync expects SQLite at `~/.9router/db/data.sqlite`, causing error:
```
Error: 9router db not found: /root/.9router/db/data.sqlite
```

### Interview Summary
**Key Discussions**:
- User's 9router on VPS uses JSON format (different installation/version)
- User wants quick fix - just make it work
- Solution: Auto-detect database format (check JSON first, fallback to SQLite)

**User Decisions**:
- **Format Precedence**: JSON takes precedence when both exist
- **Fresh Install**: Create JSON (consistent with 9router)
- **Migration**: No migration utility (just detect and use existing format)

### Metis Review
**Identified Gaps** (addressed):
- Precedence when both formats exist → JSON takes precedence (user confirmed)
- Fresh install behavior → Create JSON (user confirmed)
- Migration path → No migration (user confirmed)
- Device ID retrieval from JSON on Unix → Added to Task 2
- Error handling for corrupted JSON → Added to acceptance criteria

---

## Work Objectives

### Core Objective
Enable 9router-sync to detect and use JSON databases on Unix systems while maintaining full backward compatibility with SQLite installations.

### Concrete Deliverables
- `lib/db-handler.mjs`: `detectDatabaseFormat()` function
- `lib/db-handler.mjs`: Updated `readProviderConnections()` and `writeProviderConnections()`
- `lib/sync-lib.mjs`: Updated `getDeviceId()` function

### Definition of Done
- [ ] `9router-sync` command works on Unix with JSON database (no "db not found" error)
- [ ] Existing SQLite installations continue working (backward compatibility verified)
- [ ] Device ID retrieval works from JSON on Unix
- [ ] Windows behavior unchanged (no regression)
- [ ] JSON takes precedence when both formats exist

### Must Have
- Auto-detection logic that checks JSON before SQLite on Unix
- Device ID retrieval from JSON on Unix
- Backward compatibility with SQLite
- Graceful error handling for corrupted JSON

### Must NOT Have (Guardrails)
- NO migration utility (SQLite → JSON conversion)
- NO configuration system (env vars, config files, CLI flags)
- NO database validation or integrity checks beyond basic parsing
- NO test infrastructure setup
- NO performance optimization
- NO documentation updates beyond minimal inline comments
- NO changes to Windows code paths
- NO changes to database schema or data structure
- NO new dependencies

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None (no test framework in package.json)
- **Framework**: N/A
- **QA Policy**: Agent-executed QA scenarios using bash + node

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Database Operations**: Use bash + node REPL - Import modules, call functions, verify output
- **CLI Testing**: Use bash - Run commands, check exit codes, parse output
- **File Inspection**: Use bash - Check file existence, read contents, verify format

---

## Execution Strategy

### Parallel Execution Waves

> Sequential execution (only 2 tasks, Task 2 depends on Task 1)

```
Wave 1 (Start Immediately):
└── Task 1: Add database format detection to db-handler.mjs [quick]

Wave 2 (After Task 1):
└── Task 2: Update device ID retrieval in sync-lib.mjs [quick]

Wave FINAL (After ALL tasks):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

- **1**: - - 2
- **2**: 1 - F1-F4

### Agent Dispatch Summary

- **Wave 1**: 1 task - T1 → `quick`
- **Wave 2**: 1 task - T2 → `quick`
- **FINAL**: 4 tasks - F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Add database format detection to db-handler.mjs

  **What to do**:
  - Add `detectDatabaseFormat()` function that checks for database files in order:
    1. `~/.9router/db.json` (Unix JSON path)
    2. `~/.9router/db/data.sqlite` (Unix SQLite path)
    3. Return `'json'`, `'sqlite'`, or `null` (neither exists)
  - Update `readProviderConnections()` to call `detectDatabaseFormat()` on Unix:
    - If format is `'json'`, call `readWindowsJson()` with Unix JSON path
    - If format is `'sqlite'`, call `readUnixSqlite()` (existing behavior)
    - If format is `null`, throw error with helpful message
  - Update `writeProviderConnections()` to call `detectDatabaseFormat()` on Unix:
    - If format is `'json'`, call `writeWindowsJson()` with Unix JSON path
    - If format is `'sqlite'`, call `writeUnixSqlite()` (existing behavior)
    - If format is `null` (fresh install), create JSON at `~/.9router/db.json`
  - Add Unix JSON path constant: `const UNIX_JSON_PATH = join(HOME, '.9router', 'db.json')`
  - Update `DB_PATHS` export to include `unixJson: UNIX_JSON_PATH`
  - Add error handling: try-catch around file operations, graceful error for corrupted JSON

  **Must NOT do**:
  - NO migration logic (SQLite → JSON conversion)
  - NO configuration system (env vars, config files)
  - NO changes to Windows code paths (keep Windows logic untouched)
  - NO new dependencies
  - NO database validation beyond basic JSON parsing
  - NO performance optimization (caching, lazy loading)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, focused change to existing module (add detection function + update 2 functions)
  - **Skills**: None needed (standard Node.js file operations)
  - **Skills Evaluated but Omitted**:
    - `typescript-expert`: Not needed (JavaScript file, no complex types)
    - `backend-dev-guidelines`: Not needed (simple utility function, not API/service layer)

  **Parallelization**:
  - **Can Run In Parallel**: NO (Task 2 depends on this)
  - **Parallel Group**: Wave 1 (solo task)
  - **Blocks**: Task 2 (device ID retrieval needs detection logic)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `lib/db-handler.mjs:35-37` - `detectPlatform()` function pattern (similar detection logic)
  - `lib/db-handler.mjs:139-147` - `readProviderConnections()` current structure (where to add detection)
  - `lib/db-handler.mjs:197-205` - `writeProviderConnections()` current structure (where to add detection)
  - `lib/db-handler.mjs:153-170` - `readWindowsJson()` function (reuse for Unix JSON)
  - `lib/db-handler.mjs:211-234` - `writeWindowsJson()` function (reuse for Unix JSON)

  **API/Type References** (contracts to implement against):
  - `lib/db-handler.mjs:277-280` - `DB_PATHS` export structure (add `unixJson` field)
  - `lib/db-handler.mjs:16-23` - Path constants pattern (add `UNIX_JSON_PATH`)

  **External References** (libraries and frameworks):
  - Node.js `fs.existsSync()` - Check file existence (already imported)
  - Node.js `path.join()` - Build file paths (already imported)

  **WHY Each Reference Matters**:
  - `detectPlatform()` shows the pattern for platform detection functions (return string, no side effects)
  - `readProviderConnections()` and `writeProviderConnections()` are the entry points where detection logic must be added
  - `readWindowsJson()` and `writeWindowsJson()` can be reused for Unix JSON (just pass different path)
  - `DB_PATHS` export needs new `unixJson` field for consistency with existing API
  - Path constants pattern shows how to define file paths at module level

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** - No human action permitted.

  **Function Implementation**:
  - [ ] `detectDatabaseFormat()` function exists in lib/db-handler.mjs
  - [ ] Function checks `~/.9router/db.json` first, then `~/.9router/db/data.sqlite`
  - [ ] Function returns `'json'`, `'sqlite'`, or `null`
  - [ ] `UNIX_JSON_PATH` constant defined: `join(HOME, '.9router', 'db.json')`
  - [ ] `DB_PATHS.unixJson` exported

  **Read Operations**:
  - [ ] `readProviderConnections()` calls `detectDatabaseFormat()` on Unix
  - [ ] Uses `readWindowsJson()` with Unix JSON path when format is `'json'`
  - [ ] Falls back to `readUnixSqlite()` when format is `'sqlite'`
  - [ ] Throws error when format is `null`

  **Write Operations**:
  - [ ] `writeProviderConnections()` calls `detectDatabaseFormat()` on Unix
  - [ ] Uses `writeWindowsJson()` with Unix JSON path when format is `'json'`
  - [ ] Falls back to `writeUnixSqlite()` when format is `'sqlite'`
  - [ ] Creates JSON at `~/.9router/db.json` when format is `null` (fresh install)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: JSON database detection on Unix
    Tool: bash + node
    Preconditions: Clean state, no existing database
    Steps:
      1. mkdir -p ~/.9router
      2. echo '{"providerConnections":[],"apiKeys":[]}' > ~/.9router/db.json
      3. node -e "import('./lib/db-handler.mjs').then(m => console.log(m.readProviderConnections()))"
    Expected Result: No error, returns empty array []
    Failure Indicators: "db not found" error, crash, wrong path error
    Evidence: .sisyphus/evidence/task-1-json-detection.txt

  Scenario: SQLite fallback on Unix
    Tool: bash + node
    Preconditions: JSON removed, SQLite exists (mock or skip if no SQLite available)
    Steps:
      1. rm -f ~/.9router/db.json
      2. # Assume SQLite exists at ~/.9router/db/data.sqlite
      3. node -e "import('./lib/db-handler.mjs').then(m => console.log(m.readProviderConnections()))"
    Expected Result: No error, reads from SQLite
    Failure Indicators: "db not found" error, tries to read JSON instead
    Evidence: .sisyphus/evidence/task-1-sqlite-fallback.txt

  Scenario: JSON precedence when both exist
    Tool: bash + node
    Preconditions: Both JSON and SQLite exist
    Steps:
      1. mkdir -p ~/.9router/db
      2. echo '{"providerConnections":[{"id":"json-provider","provider":"test"}],"apiKeys":[]}' > ~/.9router/db.json
      3. # Assume SQLite exists with different data
      4. node -e "import('./lib/db-handler.mjs').then(m => console.log(JSON.stringify(m.readProviderConnections())))"
    Expected Result: Output contains "json-provider" (from JSON, not SQLite)
    Failure Indicators: Output contains SQLite data instead, or error
    Evidence: .sisyphus/evidence/task-1-json-precedence.txt

  Scenario: Fresh install creates JSON
    Tool: bash + node
    Preconditions: No existing database
    Steps:
      1. rm -rf ~/.9router
      2. mkdir -p ~/.9router
      3. node -e "import('./lib/db-handler.mjs').then(m => m.writeProviderConnections([{id:'test',provider:'test',authType:'oauth',data:'{}',createdAt:'2024-01-01',updatedAt:'2024-01-01'}]))"
      4. ls -la ~/.9router/
    Expected Result: db.json file created (not data.sqlite)
    Failure Indicators: data.sqlite created instead, or error
    Evidence: .sisyphus/evidence/task-1-fresh-install.txt

  Scenario: Corrupted JSON graceful error
    Tool: bash + node
    Preconditions: Corrupted JSON file
    Steps:
      1. mkdir -p ~/.9router
      2. echo 'invalid json{{{' > ~/.9router/db.json
      3. node -e "import('./lib/db-handler.mjs').then(m => m.readProviderConnections()).catch(e => console.error(e.message))" 2>&1
    Expected Result: Error message mentions JSON parsing issue (not crash)
    Failure Indicators: Uncaught exception, process crash, generic error
    Evidence: .sisyphus/evidence/task-1-corrupted-json-error.txt
  ```

  **Evidence to Capture**:
  - [ ] Each evidence file named: task-1-{scenario-slug}.txt
  - [ ] Terminal output showing command execution and results
  - [ ] File listings showing created files (ls output)

  **Commit**: YES
  - Message: `fix(db): add database format detection for Unix JSON support`
  - Files: `lib/db-handler.mjs`
  - Pre-commit: None (no test framework)

---

- [x] 2. Update device ID retrieval in sync-lib.mjs

  **What to do**:
  - Update `getDeviceId()` function to handle JSON on Unix:
    - Import `DB_PATHS` from db-handler.mjs (add `unixJson` to destructure)
    - On Unix platform, check for JSON first using `existsSync(DB_PATHS.unixJson)`
    - If JSON exists, read and parse it (same logic as Windows branch)
    - Extract `machineId` from `apiKeys` array (same as Windows)
    - If JSON doesn't exist or fails, fallback to SQLite logic (existing behavior)
  - Add error handling: try-catch around JSON parsing, return 'unknown' on failure
  - Maintain exact same behavior for Windows (no changes to Windows branch)

  **Must NOT do**:
  - NO changes to Windows code path
  - NO new dependencies
  - NO database validation beyond basic JSON parsing
  - NO caching or performance optimization
  - NO configuration system

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small update to single function (add JSON check before SQLite logic)
  - **Skills**: None needed (standard Node.js file operations)
  - **Skills Evaluated but Omitted**:
    - `typescript-expert`: Not needed (JavaScript file, simple logic)
    - `backend-dev-guidelines`: Not needed (utility function, not service layer)

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1)
  - **Parallel Group**: Wave 2 (solo task)
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Task 1 (needs `DB_PATHS.unixJson` and detection logic)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `lib/sync-lib.mjs:74-90` - `getDeviceId()` function current structure (where to add JSON check)
  - `lib/sync-lib.mjs:77-90` - Windows branch logic (reuse for Unix JSON)
  - `lib/sync-lib.mjs:82-86` - JSON parsing and `machineId` extraction pattern

  **API/Type References** (contracts to implement against):
  - `lib/db-handler.mjs:277-280` - `DB_PATHS` export (now includes `unixJson` from Task 1)
  - `lib/sync-lib.mjs:13` - `DB_PATHS` import (add `unixJson` to destructure)

  **External References** (libraries and frameworks):
  - Node.js `fs.existsSync()` - Check file existence (already imported)
  - Node.js `fs.readFileSync()` - Read file contents (already imported)
  - JSON.parse() - Parse JSON string (already used)

  **WHY Each Reference Matters**:
  - Windows branch shows exact pattern for reading JSON and extracting `machineId` (reuse this logic)
  - `DB_PATHS` import needs to include new `unixJson` field from Task 1
  - Existing error handling pattern (try-catch, return 'unknown') should be maintained

  **Acceptance Criteria**:

  > **AGENT-EXECUTABLE VERIFICATION ONLY** - No human action permitted.

  **Function Implementation**:
  - [ ] `getDeviceId()` function updated in lib/sync-lib.mjs
  - [ ] Unix branch checks `DB_PATHS.unixJson` before SQLite
  - [ ] JSON parsing logic matches Windows branch pattern
  - [ ] Fallback to SQLite if JSON doesn't exist or fails
  - [ ] Error handling: try-catch around JSON operations, return 'unknown' on failure

  **Import Updates**:
  - [ ] `DB_PATHS` import includes `unixJson` field
  - [ ] No new imports added (use existing fs functions)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Device ID from JSON on Unix
    Tool: bash + node
    Preconditions: JSON database with known device ID
    Steps:
      1. mkdir -p ~/.9router
      2. echo '{"providerConnections":[],"apiKeys":[{"machineId":"unix-json-device-456","provider":"test"}]}' > ~/.9router/db.json
      3. node -e "import('./lib/sync-lib.mjs').then(m => console.log(m.getDeviceId()))"
    Expected Result: Output is "unix-json-device-456"
    Failure Indicators: Output is "unknown", error, or wrong device ID
    Evidence: .sisyphus/evidence/task-2-device-id-json.txt

  Scenario: Device ID fallback to SQLite on Unix
    Tool: bash + node
    Preconditions: No JSON, SQLite exists (mock or skip if unavailable)
    Steps:
      1. rm -f ~/.9router/db.json
      2. # Assume SQLite exists with device ID
      3. node -e "import('./lib/sync-lib.mjs').then(m => console.log(m.getDeviceId()))"
    Expected Result: Reads device ID from SQLite (not "unknown")
    Failure Indicators: Returns "unknown" when SQLite has valid device ID
    Evidence: .sisyphus/evidence/task-2-device-id-sqlite-fallback.txt

  Scenario: Device ID consistency across multiple reads
    Tool: bash + node
    Preconditions: JSON database with device ID
    Steps:
      1. mkdir -p ~/.9router
      2. echo '{"providerConnections":[],"apiKeys":[{"machineId":"consistent-id-789"}]}' > ~/.9router/db.json
      3. for i in {1..3}; do node -e "import('./lib/sync-lib.mjs').then(m => console.log(m.getDeviceId()))"; done
    Expected Result: All 3 outputs are identical: "consistent-id-789"
    Failure Indicators: Different outputs, "unknown" on some reads
    Evidence: .sisyphus/evidence/task-2-device-id-consistency.txt

  Scenario: Device ID graceful error on corrupted JSON
    Tool: bash + node
    Preconditions: Corrupted JSON file
    Steps:
      1. mkdir -p ~/.9router
      2. echo 'invalid json{{{' > ~/.9router/db.json
      3. node -e "import('./lib/sync-lib.mjs').then(m => console.log(m.getDeviceId()))"
    Expected Result: Returns "unknown" (graceful fallback, no crash)
    Failure Indicators: Uncaught exception, process crash
    Evidence: .sisyphus/evidence/task-2-device-id-corrupted-json.txt

  Scenario: Device ID from JSON with empty apiKeys array
    Tool: bash + node
    Preconditions: JSON with empty apiKeys
    Steps:
      1. mkdir -p ~/.9router
      2. echo '{"providerConnections":[],"apiKeys":[]}' > ~/.9router/db.json
      3. node -e "import('./lib/sync-lib.mjs').then(m => console.log(m.getDeviceId()))"
    Expected Result: Returns "unknown" (no device ID available)
    Failure Indicators: Crash, error, undefined
    Evidence: .sisyphus/evidence/task-2-device-id-empty-apikeys.txt
  ```

  **Evidence to Capture**:
  - [ ] Each evidence file named: task-2-{scenario-slug}.txt
  - [ ] Terminal output showing command execution and results
  - [ ] Multiple reads showing consistency

  **Commit**: YES
  - Message: `fix(sync): update device ID retrieval for Unix JSON databases`
  - Files: `lib/sync-lib.mjs`
  - Pre-commit: None (no test framework)

---

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, check function exists, verify logic). For each "Must NOT Have": search codebase for forbidden patterns (migration code, config system, new dependencies) — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Review all changed files (`lib/db-handler.mjs`, `lib/sync-lib.mjs`) for: proper error handling (try-catch around file operations), no console.log in production code, consistent code style with existing codebase, proper function documentation comments. Check for edge cases: file permission errors, corrupted JSON, missing directories.
  Output: `Files [N clean/N issues] | Error Handling [PASS/FAIL] | Style [PASS/FAIL] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration: format detection + device ID retrieval working together. Test edge cases: both formats exist (JSON precedence), neither exists (error handling), corrupted JSON (graceful failure). Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance: no migration code, no config system, no test infrastructure. Verify only 2 files modified (`lib/db-handler.mjs`, `lib/sync-lib.mjs`). Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Files Modified [2 expected/N actual] | Forbidden Additions [CLEAN/N found] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `fix(db): add database format detection for Unix JSON support` - lib/db-handler.mjs
- **Wave 2**: `fix(sync): update device ID retrieval for Unix JSON databases` - lib/sync-lib.mjs

---

## Success Criteria

### Verification Commands
```bash
# Test 1: JSON database on Unix (VPS case)
mkdir -p ~/.9router
echo '{"providerConnections":[],"apiKeys":[{"machineId":"test-device-123"}]}' > ~/.9router/db.json
node bin/9router-sync --dry-run  # Expected: No "db not found" error, exit code 0

# Test 2: SQLite fallback (backward compatibility)
rm -f ~/.9router/db.json
# (Assume SQLite exists from previous installation)
node bin/9router-sync --dry-run  # Expected: Works with SQLite, exit code 0

# Test 3: Device ID from JSON on Unix
mkdir -p ~/.9router
echo '{"providerConnections":[],"apiKeys":[{"machineId":"unix-json-device-456"}]}' > ~/.9router/db.json
node -e "import('./lib/sync-lib.mjs').then(m => console.log(m.getDeviceId()))"  # Expected: "unix-json-device-456"

# Test 4: JSON precedence when both exist
mkdir -p ~/.9router/db
echo '{"providerConnections":[{"id":"json-provider"}],"apiKeys":[{"machineId":"json-device"}]}' > ~/.9router/db.json
# (Assume SQLite also exists with different data)
node -e "import('./lib/db-handler.mjs').then(m => console.log(JSON.stringify(m.readProviderConnections())))"  # Expected: Contains "json-provider"
```

### Final Checklist
- [ ] All "Must Have" present (auto-detection, device ID, backward compatibility, error handling)
- [ ] All "Must NOT Have" absent (no migration, no config, no tests, no docs, no new deps)
- [ ] Only 2 files modified (lib/db-handler.mjs, lib/sync-lib.mjs)
- [ ] Windows behavior unchanged (no regression)
- [ ] All QA scenarios pass with evidence captured
