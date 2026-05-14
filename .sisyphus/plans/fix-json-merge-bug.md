# Fix JSON Sync Merge Bug

## TL;DR

> **Quick Summary**: JSON database writers (`writeUnixJson`, `writeWindowsJson`) are causing data loss during sync because they REPLACE the entire `providerConnections` array instead of merging by ID. SQLite path is correct (uses UPSERT), only JSON paths are buggy.
>
> **Deliverables**:
> - Extract shared `mergeRowsById()` helper used by both JSON writers
> - Fix merge logic in `writeUnixJson()` and `writeWindowsJson()`
> - Add atomic write (write-temp-then-rename) to prevent crash corruption
> - Change corrupted JSON handling to fail loud (prevent silent data loss)
> - Add `node --test` regression test suite
>
> **Estimated Effort**: Medium (2-3 hours)
> **Parallel Execution**: NO - sequential (3 tasks with dependencies)
> **Critical Path**: Task 1 → Task 2 → Task 3

---

## Context

### Original Request
User reported sync data loss between devices:
- Device A: 9 accounts → push to Supabase (Supabase has 9)
- Device B: 4 accounts → push to Supabase (Supabase has 13)
- Device A pulls → ends up with only 4 accounts (lost 9)

### Root Cause Analysis

**Location**: `lib/db-handler.mjs`
- `writeUnixJson()` line 309: `providerConnections: jsonRows` ❌ REPLACES entire array
- `writeWindowsJson()` line 280: `providerConnections: windowsRows` ❌ REPLACES entire array

**Flow**:
1. `bin/9router-sync` line 91: `writeProviderConnections(toPull)` - only passes rows to PULL
2. JSON writer overwrites entire `providerConnections` with just those rows
3. All existing local-only rows are LOST

**Comparison**:
- SQLite `writeUnixite()` (lines 332-353): Uses `INSERT ... ON CONFLICT DO UPDATE` - CORRECT ✅
- JSON writers: Overwrite entire array - BUGGY ❌

### Metis Review

**User Decisions (confirmed)**:
- Corrupted JSON → Fail loud (throw error, refuse to write)
- Atomic write → Add it (write-temp-then-rename)
- Test infrastructure → Add node --test regression suite

---

## Work Objectives

### Core Objective
Fix data loss bug in JSON sync writers by merging incoming rows with existing rows by ID, while adding safety guarantees (atomic write, fail-loud on corruption) and regression tests.

### Concrete Deliverables
- `lib/db-handler.mjs`: New `mergeRowsById()` helper function
- `lib/db-handler.mjs`: Fixed `writeUnixJson()` with merge + atomic write + fail-loud
- `lib/db-handler.mjs`: Fixed `writeWindowsJson()` with merge + atomic write + fail-loud
- `lib/db-handler.mjs`: Updated JSDoc on `writeProviderConnections()` documenting upsert contract
- `test/db-handler.test.mjs`: New regression test suite (8 scenarios)
- `package.json`: Added `"test": "node --test test/"` script

### Definition of Done
- [ ] Sync between two devices preserves all rows (no data loss)
- [ ] All 8 regression tests pass
- [ ] Atomic write verified (no .tmp files left dangling)
- [ ] Corrupted JSON throws clear error (no silent overwrite)
- [ ] SQLite path UNCHANGED (already correct)
- [ ] `bin/9router-sync` flow logic UNCHANGED

### Must Have
- ID-keyed merge in both JSON writers (`mergeRowsById` helper)
- Atomic write (write to .tmp then rename)
- Fail-loud on corrupted existing JSON
- Sibling keys preserved (apiKeys, settings, etc.)
- Empty incoming array preserves existing rows
- Conflict resolution (incoming wins by ID)
- Regression test suite using `node --test`

### Must NOT Have (Guardrails)
- NO changes to SQLite path (`writeUnixite()`) - already correct
- NO changes to `bin/9router-sync` flow logic - already correct
- NO new dependencies (no lodash, no test framework deps)
- NO reformatting of unrelated code in db-handler.mjs
- NO backup/restore/snapshot/migration features
- NO changes to JSON wire format (shape, indentation, key order)
- NO changes to `windowsRowToNormalized` or `normalizedToWindowsRow` transform functions

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO (no test files, no test script in package.json)
- **Automated tests**: YES (add Node's built-in test runner)
- **Framework**: `node --test` (built-in, Node 18+, no dependency)
- **TDD approach**: Write tests in Task 3 to verify Task 2's fix

### QA Policy
Every task MUST include agent-executed verification.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Code Changes**: Use `Read` and `git diff` to verify
- **Tests**: Use `npm test` to run regression suite
- **End-to-End**: Use bash + node to simulate sync scenarios

---

## Execution Strategy

### Parallel Execution Waves

> Sequential execution (3 tasks with dependencies)

```
Wave 1 (Start Immediately):
└── Task 1: Add mergeRowsById helper + update writeProviderConnections JSDoc [quick]

Wave 2 (After Task 1):
└── Task 2: Fix writeUnixJson and writeWindowsJson with merge + atomic + fail-loud [quick]

Wave 3 (After Task 2):
└── Task 3: Add node --test regression test suite [unspecified-high]

Wave FINAL (After ALL tasks):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

- **1**: - - 2
- **2**: 1 - 3
- **3**: 2 - F1-F4

### Agent Dispatch Summary

- **Wave 1**: 1 task - T1 → `quick`
- **Wave 2**: 1 task - T2 → `quick`
- **Wave 3**: 1 task - T3 → `unspecified-high`
- **FINAL**: 4 tasks - F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Add mergeRowsById helper + update writeProviderConnections JSDoc

  **What to do**:
  - Add new helper function `mergeRowsById(existingRows, incomingRows)` in `lib/db-handler.mjs`:
    - Accepts two arrays of provider connection rows (in flat Windows-JSON format)
    - Returns merged array: existing rows NOT in incoming + all incoming rows
    - Logic: `[...existingRows.filter(r => !incomingIds.has(r.id)), ...incomingRows]`
    - Place after `normalizedToWindowsRow()` function (around line 132)
  - Update JSDoc comment on `writeProviderConnections()` to document upsert contract:
    - "Upserts incoming rows by id; preserves existing rows not present in incoming."
    - "Caller is responsible for last-write-wins ordering by `updatedAt`."

  **Must NOT do**:
  - NO changes to writer functions yet (Task 2 will use this helper)
  - NO new dependencies
  - NO changes to other helpers (windowsRowToNormalized, normalizedToWindowsRow)
  - NO reformatting of unrelated code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, isolated addition (one helper function + JSDoc update)

  **Parallelization**:
  - **Can Run In Parallel**: NO (Task 2 depends on this)
  - **Blocked By**: None

  **References**:
  - `lib/db-handler.mjs:115-132` - `normalizedToWindowsRow()` for placement reference
  - `lib/db-handler.mjs:332-353` - SQLite UPSERT pattern (the behavior we're mimicking)
  - `lib/db-handler.mjs:138-148` - `writeProviderConnections()` for JSDoc location

  **Acceptance Criteria**:
  - [ ] `mergeRowsById()` function exists in lib/db-handler.mjs
  - [ ] Function takes 2 array parameters and returns 1 array
  - [ ] JSDoc on `writeProviderConnections()` documents upsert contract
  - [ ] No other code changes

  **QA Scenarios**:

  ```
  Scenario: Helper function exists and is exported
    Tool: bash + node
    Steps:
      1. node -e "import('./lib/db-handler.mjs').then(m => console.log(typeof m.mergeRowsById))"
    Expected Result: Output is "function"
    Evidence: .sisyphus/evidence/task-1-helper-exists.txt

  Scenario: Helper merges correctly (disjoint sets)
    Tool: bash + node
    Steps:
      1. node -e "
        import('./lib/db-handler.mjs').then(m => {
          const existing = [{id:'a'},{id:'b'},{id:'c'}];
          const incoming = [{id:'d'},{id:'e'}];
          const result = m.mergeRowsById(existing, incoming);
          console.log(JSON.stringify(result.map(r => r.id)));
        });
      "
    Expected Result: ["a","b","c","d","e"]
    Evidence: .sisyphus/evidence/task-1-merge-disjoint.txt

  Scenario: Helper handles ID conflicts (incoming wins)
    Tool: bash + node
    Steps:
      1. node -e "
        import('./lib/db-handler.mjs').then(m => {
          const existing = [{id:'a',v:'old'},{id:'b'}];
          const incoming = [{id:'a',v:'new'}];
          const result = m.mergeRowsById(existing, incoming);
          console.log(JSON.stringify(result));
        });
      "
    Expected Result: Contains a with v="new" and b unchanged
    Evidence: .sisyphus/evidence/task-1-merge-conflict.txt
  ```

  **Commit**: YES
  - Message: `refactor(db): extract mergeRowsById helper for JSON writers`
  - Files: `lib/db-handler.mjs`

---

- [ ] 2. Fix writeUnixJson and writeWindowsJson with merge + atomic + fail-loud

  **What to do**:
  - Fix `writeUnixJson()` (lines 294-317):
    - Read existing data (preserve current logic at 296-303)
    - **CHANGE**: Replace `catch {}` (line 300-302) with `throw new Error("existing DB JSON is unparseable; refusing to write to avoid data loss: " + e.message)`
    - Convert incoming rows: `const incomingRows = rows.map(normalizedToWindowsRow)` (existing line 305)
    - **NEW**: Merge with existing using helper: `const mergedRows = mergeRowsById(existingData.providerConnections || [], incomingRows)`
    - Build new data: `const newData = { ...existingData, providerConnections: mergedRows }`
    - **NEW**: Atomic write to temp then rename:
      - `const tmpPath = UNIX_JSON_PATH + '.tmp'`
      - `writeFileSync(tmpPath, JSON.stringify(newData, null, 2), 'utf8')`
      - `renameSync(tmpPath, UNIX_JSON_PATH)`
    - Wrap in try-catch, throw descriptive error on failure
  - Fix `writeWindowsJson()` (lines 265-288): SAME changes as writeUnixJson but with WINDOWS_DB_PATH
  - Add `renameSync` to imports from 'node:fs' (line 6)

  **Must NOT do**:
  - NO changes to SQLite path (`writeUnixite()`)
  - NO changes to `windowsRowToNormalized` or `normalizedToWindowsRow`
  - NO changes to read functions
  - NO new dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Two parallel functions with same change pattern, well-scoped

  **Parallelization**:
  - **Can Run In Parallel**: NO (Task 3 depends on this)
  - **Blocked By**: Task 1 (needs `mergeRowsById` helper)

  **References**:
  - `lib/db-handler.mjs:265-288` - writeWindowsJson (current buggy version)
  - `lib/db-handler.mjs:294-317` - writeUnixJson (current buggy version)
  - Task 1: `mergeRowsById()` helper to use

  **Acceptance Criteria**:
  - [ ] `writeUnixJson()` calls `mergeRowsById()` before writing
  - [ ] `writeWindowsJson()` calls `mergeRowsById()` before writing
  - [ ] Both functions use atomic write (write .tmp then rename)
  - [ ] Both throw error on corrupted existing JSON (no silent fallback)
  - [ ] `renameSync` imported from 'node:fs'
  - [ ] No changes to SQLite or read functions

  **QA Scenarios**:

  ```
  Scenario: Disjoint merge preserves all rows
    Tool: bash + node
    Setup:
      mkdir -p ~/.9router
      echo '{"providerConnections":[{"id":"a"},{"id":"b"},{"id":"c"}],"apiKeys":[{"machineId":"dev1"}]}' > ~/.9router/db.json
    Steps:
      node -e "
        import('./lib/db-handler.mjs').then(m =>
          m.writeProviderConnections([
            {id:'d',provider:'test',authType:'oauth',data:'{}',createdAt:'2024-01-01',updatedAt:'2024-01-01'},
            {id:'e',provider:'test',authType:'oauth',data:'{}',createdAt:'2024-01-01',updatedAt:'2024-01-01'}
          ])
        );
      "
      cat ~/.9router/db.json
    Expected: providerConnections has 5 rows (a,b,c,d,e), apiKeys preserved
    Evidence: .sisyphus/evidence/task-2-disjoint-merge.txt

  Scenario: Atomic write (no .tmp file dangling)
    Tool: bash
    Setup: Run a successful write
    Steps:
      ls ~/.9router/*.tmp 2>&1
    Expected: "No such file" (no .tmp file remaining)
    Evidence: .sisyphus/evidence/task-2-atomic-write.txt

  Scenario: Corrupted JSON throws error
    Tool: bash + node
    Setup:
      echo 'invalid json{{{' > ~/.9router/db.json
    Steps:
      node -e "
        import('./lib/db-handler.mjs').then(m =>
          m.writeProviderConnections([{id:'test',provider:'test',authType:'oauth',data:'{}',createdAt:'2024-01-01',updatedAt:'2024-01-01'}])
        ).catch(e => console.error('CAUGHT:', e.message));
      "
    Expected: Output contains "unparseable" or similar; original file unchanged
    Evidence: .sisyphus/evidence/task-2-corrupted-fail.txt

  Scenario: Empty incoming preserves existing
    Tool: bash + node
    Setup:
      echo '{"providerConnections":[{"id":"a"},{"id":"b"}],"apiKeys":[]}' > ~/.9router/db.json
    Steps:
      node -e "import('./lib/db-handler.mjs').then(m => m.writeProviderConnections([]))"
      cat ~/.9router/db.json
    Expected: providerConnections still has [a,b]
    Evidence: .sisyphus/evidence/task-2-empty-incoming.txt
  ```

  **Commit**: YES
  - Message: `fix(db): merge JSON rows by id to prevent sync data loss`
  - Files: `lib/db-handler.mjs`

---

- [ ] 3. Add node --test regression test suite

  **What to do**:
  - Create `test/` directory
  - Create `test/db-handler.test.mjs` with 8 regression tests using `node --test`:
    1. Headline regression: disjoint merge (existing [a,b,c] + incoming [d,e] = [a,b,c,d,e])
    2. Conflict resolution (incoming wins on ID collision)
    3. Empty incoming preserves existing rows
    4. Fresh install (file absent) creates new file with incoming
    5. Sibling keys preserved (apiKeys, settings unchanged)
    6. Corrupted JSON throws error (per Task 2 fix)
    7. Round-trip: write [] then verify existing rows still present
    8. Cross-platform path selection (test runs on current platform)
  - Use `node:test` and `node:assert/strict` (built-in, no deps)
  - Use `os.tmpdir()` for test fixtures (don't pollute real ~/.9router)
  - Use `process.platform` to test the appropriate platform's writer
  - Add to `package.json` scripts: `"test": "node --test test/"`
  - All tests must clean up after themselves (delete temp files)

  **Must NOT do**:
  - NO new test framework dependencies (use built-in `node:test`)
  - NO modification of source code
  - NO mocking (use real file operations on temp paths)
  - NO modification of real `~/.9router/` directory

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Test writing requires careful design of fixtures and assertions

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Task 2 (testing the fixed writers)

  **References**:
  - Task 2 fixed writers (target of tests)
  - `lib/db-handler.mjs:DB_PATHS` export for path testing
  - Node.js docs: https://nodejs.org/api/test.html

  **Acceptance Criteria**:
  - [ ] `test/db-handler.test.mjs` exists with 8 test cases
  - [ ] `package.json` has `"test": "node --test test/"` script
  - [ ] All 8 tests pass: `npm test` exits 0
  - [ ] Tests use temp directories, don't pollute real DB
  - [ ] Tests clean up after themselves
  - [ ] No new dependencies in package.json

  **QA Scenarios**:

  ```
  Scenario: Run test suite
    Tool: bash
    Steps:
      npm test 2>&1
    Expected: All 8 tests pass, exit code 0
    Evidence: .sisyphus/evidence/task-3-test-results.txt

  Scenario: Headline bug regression test
    Tool: bash
    Steps:
      npm test 2>&1 | grep -i "disjoint\|regression\|headline"
    Expected: Test for disjoint merge passes
    Evidence: .sisyphus/evidence/task-3-headline-test.txt

  Scenario: No test pollution
    Tool: bash
    Setup: Note current state of ~/.9router/ (if exists)
    Steps:
      npm test
      # Verify ~/.9router/ unchanged after tests
    Expected: ~/.9router/ unchanged (tests use temp dirs)
    Evidence: .sisyphus/evidence/task-3-no-pollution.txt

  Scenario: End-to-end bug fix verification
    Tool: bash + node
    Setup:
      mkdir -p ~/.9router
      echo '{"providerConnections":[{"id":"a"},{"id":"b"},{"id":"c"},{"id":"d"},{"id":"e"},{"id":"f"},{"id":"g"},{"id":"h"},{"id":"i"}],"apiKeys":[{"machineId":"deviceA"}]}' > ~/.9router/db.json
    Steps:
      # Simulate pulling 4 new rows from "Device B"
      node -e "
        import('./lib/db-handler.mjs').then(m =>
          m.writeProviderConnections([
            {id:'j',provider:'test',authType:'oauth',data:'{}',createdAt:'2024-01-01',updatedAt:'2024-01-01'},
            {id:'k',provider:'test',authType:'oauth',data:'{}',createdAt:'2024-01-01',updatedAt:'2024-01-01'},
            {id:'l',provider:'test',authType:'oauth',data:'{}',createdAt:'2024-01-01',updatedAt:'2024-01-01'},
            {id:'m',provider:'test',authType:'oauth',data:'{}',createdAt:'2024-01-01',updatedAt:'2024-01-01'}
          ])
        );
      "
      node -e "console.log(JSON.parse(require('fs').readFileSync(require('os').homedir() + '/.9router/db.json', 'utf8')).providerConnections.length)"
    Expected: Output is 13 (9 original + 4 new = bug FIXED)
    Evidence: .sisyphus/evidence/task-3-e2e-bug-fix.txt
  ```

  **Commit**: YES
  - Message: `test(db): add regression suite for JSON merge behavior`
  - Files: `test/db-handler.test.mjs`, `package.json`

---

## Final Verification Wave (MANDATORY)

> 4 review agents run in PARALLEL. ALL must APPROVE.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify each "Must Have" implemented, each "Must NOT Have" absent. Check evidence files exist.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Review code for error handling, no console.log, consistent style, JSDoc.
  Output: `Files [N clean/N issues] | Error Handling [PASS/FAIL] | Style [PASS/FAIL] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Run `npm test`, verify 8 scenarios pass. Test sync flow end-to-end with mock data simulating the original bug (Device A has 9, Device B has 4 → after sync both should have 13).
  Output: `Tests [N/N pass] | Bug Reproduction [FIXED/NOT FIXED] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  Verify only `lib/db-handler.mjs`, `test/db-handler.test.mjs`, `package.json` modified. Verify SQLite path untouched. Verify `bin/9router-sync` untouched.
  Output: `Files Modified [3 expected/N actual] | SQLite Untouched [YES/NO] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `refactor(db): extract mergeRowsById helper for JSON writers` - lib/db-handler.mjs
- **Wave 2**: `fix(db): merge JSON rows by id to prevent sync data loss` - lib/db-handler.mjs
- **Wave 3**: `test(db): add regression suite for JSON merge behavior` - test/db-handler.test.mjs, package.json

---

## Success Criteria

### Verification Commands
```bash
# Test 1: Run full test suite
npm test
# Expected: All 8 tests pass, exit code 0

# Test 2: Reproduce original bug scenario (manual)
# Setup Device A: 9 rows in db.json
# Setup Device B: 4 rows in db.json (different IDs)
# Mock Supabase responses
# Run sync on Device A then Device B
# Expected: Both end up with 13 rows after second sync

# Test 3: Atomic write verification
# Verify no .tmp files left in ~/.9router/ after successful run

# Test 4: Corrupted JSON handling
echo 'invalid json{{{' > /tmp/test-db.json
node -e "import('./lib/db-handler.mjs').then(m => m.writeProviderConnections([{id:'test',provider:'test',authType:'oauth',data:'{}',createdAt:'2024-01-01',updatedAt:'2024-01-01'}]))"
# Expected: Throws error with "unparseable" in message, file unchanged
```

### Final Checklist
- [ ] Sync data loss bug FIXED (verified end-to-end)
- [ ] All 8 regression tests pass
- [ ] Atomic write working (no .tmp files dangling)
- [ ] Corrupted JSON fails loud (no silent data loss)
- [ ] SQLite path UNCHANGED (already correct)
- [ ] `bin/9router-sync` UNCHANGED
- [ ] Only 3 files modified (db-handler.mjs, test file, package.json)
- [ ] No new dependencies added
