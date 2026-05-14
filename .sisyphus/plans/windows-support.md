# Windows Support for 9router-sync

## TL;DR

> **Quick Summary**: Add Windows support to 9router-sync with cross-platform DB handling (SQLite for Unix, JSON for Windows) and PowerShell installer.
> 
> **Deliverables**:
> - PowerShell installer (`install.ps1`) and uninstaller (`uninstall.ps1`)
> - Batch CLI wrapper (`9router-sync.cmd`)
> - Cross-platform DB handler with schema transformation
> - Updated documentation with Windows instructions
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 2 → Task 5 → Task 8 → Task 9 → FINAL

---

## Context

### Original Request
User wants to run 9router-sync on Windows. Currently only works on Linux/macOS with bash installer and SQLite database.

### Interview Summary
**Key Discussions**:
- Windows 9router uses JSON file at `%USERPROFILE%\AppData\Roaming\9router\db.json`
- Unix 9router uses SQLite at `~/.9router/db/data.sqlite`
- User can test on Windows after implementation
- Decided on separate installer scripts (keep `install.sh`, add `install.ps1`)

**Research Findings**:
- Windows JSON has flat structure with top-level fields (`apiKey`, `providerSpecificData`, etc.)
- SQLite has nested structure with `data` JSON column containing tokens
- Schema mismatch requires bidirectional transformation layer
- Tool performs two-way sync: local DB ↔ Supabase

### Metis Review
**Identified Gaps** (addressed):
- Schema validation: Confirmed Windows JSON structure differs from SQLite
- Write operations: Confirmed tool writes to both local DB and Supabase
- Platform detection: Will use `process.platform` and file existence checks
- Error handling: Will preserve Unix error behavior, add Windows-specific messages
- Edge cases: Handle missing DB, corrupted JSON, spaces in paths

---

## Work Objectives

### Core Objective
Enable 9router-sync to work on Windows with the same functionality as Unix, handling different database formats transparently.

### Concrete Deliverables
- `install.ps1` - PowerShell installer script
- `uninstall.ps1` - PowerShell uninstaller script
- `9router-sync.cmd` - Batch file CLI wrapper
- `lib/db-handler.mjs` - Cross-platform database abstraction
- Updated `lib/sync-lib.mjs` - Use new DB handler
- Updated `bin/9router-sync` - Platform-agnostic paths
- Updated `README.md` - Windows installation section
- Updated `package.json` - Include Windows scripts in `files` array

### Definition of Done
- [ ] Windows user can run `install.ps1` and get working `9router-sync` command
- [ ] `9router-sync` reads from Windows JSON database correctly
- [ ] `9router-sync` writes to Windows JSON database correctly
- [ ] Sync to/from Supabase works on Windows (schema transformation applied)
- [ ] Unix functionality unchanged (regression-free)
- [ ] `uninstall.ps1` removes all installed files

### Must Have
- Bidirectional schema transformation (Windows JSON ↔ Supabase)
- Platform detection (Windows vs Unix)
- PowerShell installer matching `install.sh` behavior
- Batch wrapper handling spaces in paths
- Error messages for missing/corrupted database
- Cross-platform path handling

### Must NOT Have (Guardrails)
- No GUI installer or MSI package
- No automatic Node.js installation (only check and guide)
- No interactive prompts in installers
- No changes to CLI interface or commands
- No new configuration files
- No database caching or performance optimizations
- No automatic update checking
- No refactoring of Unix installer unless blocking
- No WSL/Cygwin/Git Bash special cases (only native Windows)
- No database backup/restore functionality
- No ORM or complex abstraction layers

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (no test framework)
- **Automated tests**: None (manual QA scenarios only)
- **Framework**: N/A

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Installation**: Use PowerShell - Run installer, verify CLI accessible
- **Database Operations**: Use Bash/PowerShell - Create test DB, run sync, verify output
- **Cross-platform**: Use Bash - Verify Unix behavior unchanged

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - 3 tasks in parallel):
├── Task 1: Create db-handler.mjs with platform detection [quick]
├── Task 2: Create PowerShell installer (install.ps1) [quick]
└── Task 3: Create PowerShell uninstaller (uninstall.ps1) [quick]

Wave 2 (Integration - 4 tasks in parallel, depends on Wave 1):
├── Task 4: Create batch CLI wrapper (9router-sync.cmd) [quick]
├── Task 5: Update sync-lib.mjs to use db-handler [deep]
├── Task 6: Update bin/9router-sync for cross-platform paths [quick]
└── Task 7: Update package.json files array [quick]

Wave 3 (Documentation & Testing - 2 tasks in parallel, depends on Wave 2):
├── Task 8: Update README.md with Windows instructions [quick]
└── Task 9: Integration testing on Windows [unspecified-high]

Wave FINAL (After ALL tasks - 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

- **1**: - - 5
- **2**: - - 9
- **3**: - - 9
- **4**: - - 9
- **5**: 1 - 6, 9
- **6**: 5 - 8, 9
- **7**: - - 9
- **8**: 6 - F1-F4
- **9**: 2, 3, 4, 5, 6, 7 - F1-F4
- **F1-F4**: 8, 9 - user okay

### Agent Dispatch Summary

- **Wave 1**: 3 tasks - T1 → `quick`, T2 → `quick`, T3 → `quick`
- **Wave 2**: 4 tasks - T4 → `quick`, T5 → `deep`, T6 → `quick`, T7 → `quick`
- **Wave 3**: 2 tasks - T8 → `quick`, T9 → `unspecified-high`
- **FINAL**: 4 tasks - F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Create cross-platform database handler

  **What to do**:
  - Create `lib/db-handler.mjs` with platform-agnostic interface
  - Implement `detectPlatform()` - returns 'windows' or 'unix' based on `process.platform` and file existence
  - Implement `readProviderConnections()` - reads from JSON (Windows) or SQLite (Unix), returns normalized array
  - Implement `writeProviderConnections(rows)` - writes to JSON (Windows) or SQLite (Unix)
  - Add schema transformation for Windows:
    - Windows → Normalized: Extract `apiKey`, `providerSpecificData`, `modelLock_*`, `lastError` into `data` object
    - Normalized → Windows: Unpack `data` object, merge with top-level fields
  - Handle errors: missing DB file, corrupted JSON, SQLite connection failures

  **Must NOT do**:
  - Add caching or performance optimizations
  - Create ORM-like abstraction layers
  - Add database migration tools
  - Handle WSL/Cygwin special cases

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward file I/O and JSON transformation, no complex algorithms
  - **Skills**: [`javascript-pro`]
    - `javascript-pro`: Node.js fs module, JSON parsing, error handling patterns
  - **Skills Evaluated but Omitted**:
    - `typescript-expert`: No TypeScript in this project (pure JS)
    - `database-design`: Simple read/write, not schema design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 5 (sync-lib.mjs refactor)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `lib/sync-lib.mjs:96-100` - Existing SQLite database opening pattern with better-sqlite3
  - `lib/sync-lib.mjs:44` - Current providerConnections read: `db.prepare('SELECT * FROM providerConnections').all()`
  - `lib/sync-lib.mjs:90-109` - Current SQLite write pattern with transaction and upsert

  **API/Type References**:
  - User-provided Windows JSON structure (from conversation):
    ```json
    {
      "providerConnections": [{
        "id": "...",
        "provider": "ollama",
        "authType": "apikey",
        "name": "...",
        "priority": 1,
        "isActive": true,
        "createdAt": "...",
        "updatedAt": "...",
        "apiKey": "...",
        "providerSpecificData": {...},
        "modelLock_*": null,
        "lastError": "..."
      }]
    }
    ```
  - SQLite schema (from existing code): `id, provider, authType, name, email, priority, isActive, data (JSON text), createdAt, updatedAt`

  **External References**:
  - Node.js fs docs: https://nodejs.org/api/fs.html#fsreadfilesyncpath-options
  - Node.js path docs: https://nodejs.org/api/path.html#pathjoinpaths

  **WHY Each Reference Matters**:
  - `sync-lib.mjs:96-100`: Shows how better-sqlite3 is currently loaded and initialized - preserve this for Unix
  - `sync-lib.mjs:44`: Shows exact SQL query to replicate for SQLite reads
  - `sync-lib.mjs:90-109`: Shows transaction pattern and upsert logic to preserve for SQLite writes
  - Windows JSON structure: Defines exact field mapping for transformation layer
  - SQLite schema: Defines target structure for Windows → SQLite transformation

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Detect Windows platform correctly
    Tool: Bash (PowerShell)
    Preconditions: Running on Windows with db.json present at %USERPROFILE%\AppData\Roaming\9router\db.json
    Steps:
      1. node -e "import('./lib/db-handler.mjs').then(m => console.log(m.detectPlatform()))"
      2. Assert output is "windows"
    Expected Result: Prints "windows"
    Failure Indicators: Prints "unix" or throws error
    Evidence: .sisyphus/evidence/task-1-detect-windows.txt

  Scenario: Read Windows JSON database
    Tool: Bash (PowerShell)
    Preconditions: Test db.json created with known data
    Steps:
      1. mkdir -Force $env:USERPROFILE\AppData\Roaming\9router
      2. echo '{"providerConnections":[{"id":"test-123","provider":"ollama","authType":"apikey","name":"Test","priority":1,"isActive":true,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","apiKey":"secret-key","providerSpecificData":{}}]}' > $env:USERPROFILE\AppData\Roaming\9router\db.json
      3. node -e "import('./lib/db-handler.mjs').then(m => m.readProviderConnections().then(r => console.log(JSON.stringify(r))))"
      4. Assert output contains "test-123"
      5. Assert output contains "data" field with "apiKey" nested inside
    Expected Result: JSON array with transformed structure (apiKey moved to data object)
    Failure Indicators: Error thrown, missing fields, incorrect transformation
    Evidence: .sisyphus/evidence/task-1-read-windows.txt

  Scenario: Write Windows JSON database
    Tool: Bash (PowerShell)
    Preconditions: Empty db.json file
    Steps:
      1. echo '{"providerConnections":[]}' > $env:USERPROFILE\AppData\Roaming\9router\db.json
      2. node -e "import('./lib/db-handler.mjs').then(m => m.writeProviderConnections([{id:'write-test',provider:'test',authType:'apikey',name:'WriteTest',priority:1,isActive:true,data:JSON.stringify({apiKey:'key123'}),createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'}]))"
      3. cat $env:USERPROFILE\AppData\Roaming\9router\db.json
      4. Assert file contains "write-test"
      5. Assert file contains "apiKey" at top level (unpacked from data)
    Expected Result: db.json updated with new record, data object unpacked
    Failure Indicators: File unchanged, incorrect structure, data not unpacked
    Evidence: .sisyphus/evidence/task-1-write-windows.txt

  Scenario: Handle missing database gracefully
    Tool: Bash (PowerShell)
    Preconditions: No db.json file exists
    Steps:
      1. Remove-Item -Force $env:USERPROFILE\AppData\Roaming\9router\db.json -ErrorAction SilentlyContinue
      2. node -e "import('./lib/db-handler.mjs').then(m => m.readProviderConnections().catch(e => console.log('ERROR:', e.message)))"
      3. Assert output contains "ERROR:" and mentions database not found
    Expected Result: Clear error message about missing database
    Failure Indicators: Uncaught exception, stack trace, cryptic error
    Evidence: .sisyphus/evidence/task-1-missing-db-error.txt
  ```

  **Evidence to Capture**:
  - [ ] task-1-detect-windows.txt - Platform detection output
  - [ ] task-1-read-windows.txt - Read operation output with transformation
  - [ ] task-1-write-windows.txt - Write operation result
  - [ ] task-1-missing-db-error.txt - Error handling output

  **Commit**: NO (groups with Task 5)

- [x] 2. Create PowerShell installer script

  **What to do**:
  - Create `install.ps1` mirroring `install.sh` structure
  - Check Node.js version >= 18 (exit with error if not met)
  - Check npm availability
  - Determine install directory: `$env:APP_DIR` or `$HOME\.9router-sync`
  - Determine CLI wrapper location: `$env:PREFIX` or `$HOME\.local\bin` or `$HOME\bin`
  - Copy files: `bin/`, `lib/`, `package.json`, `README.md`, `LICENSE`, `uninstall.ps1`, `9router-sync.cmd`
  - Run `npm install --omit=dev --no-audit --no-fund --silent` in APP_DIR
  - Copy `9router-sync.cmd` to PREFIX directory
  - Verify installation by running `9router-sync --help`
  - Check if PREFIX is in PATH, warn if not (with instructions to add)
  - Print next steps: run `9router-sync --init`, create config, etc.

  **Must NOT do**:
  - Auto-install Node.js or npm
  - Add interactive prompts
  - Modify system PATH automatically
  - Create GUI installer
  - Add telemetry or analytics

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Script follows existing install.sh pattern, straightforward file operations
  - **Skills**: []
    - No specialized skills needed - PowerShell scripting is general-purpose
  - **Skills Evaluated but Omitted**:
    - All skills: PowerShell scripting doesn't require JS/TS expertise

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 9 (integration testing)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `install.sh:1-130` - Complete Unix installer structure to mirror in PowerShell
  - `install.sh:26-30` - Platform check pattern (adapt for Windows-only)
  - `install.sh:32-39` - Node.js version check pattern
  - `install.sh:42-60` - PREFIX selection logic
  - `install.sh:80-95` - File copy and npm install pattern
  - `install.sh:99-102` - Symlink creation (adapt to file copy for Windows)
  - `install.sh:104-118` - Verification and PATH check pattern
  - `install.sh:120-130` - Next steps message

  **External References**:
  - PowerShell docs: https://learn.microsoft.com/en-us/powershell/scripting/overview

  **WHY Each Reference Matters**:
  - `install.sh`: Complete reference implementation - PowerShell version should match behavior exactly
  - Each section shows specific logic to replicate: version checks, path selection, file operations, verification

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Fresh installation on Windows
    Tool: interactive_bash (PowerShell)
    Preconditions: Node.js 18+ installed, no existing 9router-sync installation
    Steps:
      1. cd D:\ndrzk\Project New\9router-sync
      2. .\install.ps1
      3. Wait for completion (npm install may take 30-60s)
      4. 9router-sync --help
    Expected Result: 
      - install.ps1 exits with code 0
      - "9router-sync installed" message appears
      - --help shows usage information
    Failure Indicators: Error during npm install, command not found, permission errors
    Evidence: .sisyphus/evidence/task-2-install-success.txt

  Scenario: Node.js version check
    Tool: Bash (PowerShell)
    Preconditions: Temporarily mock node version to 16
    Steps:
      1. Create test script that sets node version to 16
      2. Run install.ps1
      3. Assert error message about Node.js version
      4. Assert exit code is non-zero
    Expected Result: Clear error "node v16.x.x too old (need >= 18)"
    Failure Indicators: Installer proceeds despite old version, unclear error
    Evidence: .sisyphus/evidence/task-2-version-check.txt

  Scenario: PATH warning when not in PATH
    Tool: Bash (PowerShell)
    Preconditions: Install to directory not in PATH
    Steps:
      1. $env:PREFIX = "C:\temp\test-bin"
      2. .\install.ps1
      3. Check output for PATH warning
    Expected Result: Warning message with instructions to add to PATH
    Failure Indicators: No warning, unclear instructions
    Evidence: .sisyphus/evidence/task-2-path-warning.txt
  ```

  **Evidence to Capture**:
  - [ ] task-2-install-success.txt - Successful installation output
  - [ ] task-2-version-check.txt - Version validation output
  - [ ] task-2-path-warning.txt - PATH warning message

  **Commit**: NO (groups with Task 9)

- [x] 8. Update README.md with Windows instructions

  **What to do**:
  - Add "Windows" section under "Install" heading
  - Include PowerShell one-liner installation command
  - Include manual installation from clone
  - Add Windows-specific paths in examples: `%USERPROFILE%\.9router\sync.json`
  - Update "Setup" section to show both Unix and Windows config paths
  - Add note about PowerShell execution policy if needed
  - Keep existing Unix instructions unchanged

  **Must NOT do**:
  - Remove or modify Unix installation instructions
  - Add extensive troubleshooting guide
  - Add screenshots or diagrams
  - Rewrite existing sections

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward documentation update
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - All skills: Basic markdown editing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (but must wait for Task 6)
  - **Blocks**: Final verification wave
  - **Blocked By**: Task 6 (need to know correct paths first)

  **References**:

  **Pattern References**:
  - `README.md:15-37` - Current "Install" section to extend
  - `README.md:39-60` - Current "Setup" section to update with Windows paths
  - `install.sh:120-130` - Next steps message to mirror in README

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: README includes Windows installation section
    Tool: Bash
    Preconditions: README.md updated
    Steps:
      1. grep -A 20 "Windows" README.md
      2. Assert output contains "install.ps1"
      3. Assert output contains "%USERPROFILE%"
      4. Assert output contains PowerShell command
    Expected Result: Clear Windows installation instructions
    Failure Indicators: Missing section, Unix-only paths
    Evidence: .sisyphus/evidence/task-8-readme-windows.txt

  Scenario: Unix instructions unchanged
    Tool: Bash
    Preconditions: README.md updated
    Steps:
      1. grep -A 10 "macOS / Linux" README.md
      2. Assert output contains "install.sh"
      3. Assert output matches original content
    Expected Result: Unix section preserved exactly
    Failure Indicators: Modified Unix instructions, broken links
    Evidence: .sisyphus/evidence/task-8-readme-unix.txt
  ```

  **Evidence to Capture**:
  - [ ] task-8-readme-windows.txt
  - [ ] task-8-readme-unix.txt

  **Commit**: NO (groups with Task 9)

- [x] 9. Integration testing on Windows

  **What to do**:
  - Run complete installation flow on Windows
  - Test `9router-sync --init` command
  - Create test `sync.json` config with dummy Supabase credentials
  - Create test `db.json` with sample provider connection
  - Run `9router-sync --dry-run` and verify output
  - Test error handling: missing DB, corrupted JSON, invalid config
  - Verify uninstallation works correctly
  - Document any issues found and verify fixes

  **Must NOT do**:
  - Test with real Supabase credentials (use dummy values)
  - Modify production 9router database
  - Add new test framework or infrastructure

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive integration testing requiring judgment and exploration
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - All skills: Manual testing doesn't require specific technical skills

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (but must wait for all Wave 2 tasks)
  - **Blocks**: Final verification wave
  - **Blocked By**: Tasks 2, 3, 4, 5, 6, 7 (all implementation must complete)

  **References**:

  **Pattern References**:
  - `README.md:62-69` - Usage examples to test
  - `bin/9router-sync:25-38` - CLI flags to test (--help, --init, --dry-run)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Complete installation and sync workflow
    Tool: interactive_bash (PowerShell)
    Preconditions: Clean Windows system, Node.js 18+ installed
    Steps:
      1. cd D:\ndrzk\Project New\9router-sync
      2. .\install.ps1
      3. 9router-sync --init
      4. Create test config: echo '{"supabaseUrl":"https://test.supabase.co","supabaseKey":"test-key","table":"router9_provider_connections"}' > $env:USERPROFILE\.9router\sync.json
      5. Create test DB: echo '{"providerConnections":[{"id":"test-1","provider":"ollama","authType":"apikey","name":"Test","priority":1,"isActive":true,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","apiKey":"key123","providerSpecificData":{}}]}' > $env:USERPROFILE\AppData\Roaming\9router\db.json
      6. 9router-sync --dry-run
      7. Assert output shows sync plan
      8. Assert no errors
    Expected Result: Complete workflow works end-to-end
    Failure Indicators: Any step fails, errors thrown, incorrect output
    Evidence: .sisyphus/evidence/task-9-integration-full.txt

  Scenario: Error handling for missing database
    Tool: Bash (PowerShell)
    Preconditions: No db.json file
    Steps:
      1. Remove-Item -Force $env:USERPROFILE\AppData\Roaming\9router\db.json -ErrorAction SilentlyContinue
      2. 9router-sync --dry-run
      3. Assert clear error message
      4. Assert exit code is non-zero
    Expected Result: Graceful error with helpful message
    Failure Indicators: Crash, stack trace, unclear error
    Evidence: .sisyphus/evidence/task-9-error-missing-db.txt

  Scenario: Error handling for corrupted JSON
    Tool: Bash (PowerShell)
    Preconditions: Invalid JSON in db.json
    Steps:
      1. echo '{invalid json}' > $env:USERPROFILE\AppData\Roaming\9router\db.json
      2. 9router-sync --dry-run
      3. Assert error mentions JSON parsing
      4. Assert exit code is non-zero
    Expected Result: Clear JSON parse error message
    Failure Indicators: Crash, unclear error
    Evidence: .sisyphus/evidence/task-9-error-corrupted-json.txt

  Scenario: Uninstallation cleanup
    Tool: Bash (PowerShell)
    Preconditions: 9router-sync installed
    Steps:
      1. .\uninstall.ps1
      2. 9router-sync --help
      3. Assert command not found
      4. Test-Path $HOME\.9router-sync
      5. Assert returns False
    Expected Result: Complete removal of all files
    Failure Indicators: Files remain, command still works
    Evidence: .sisyphus/evidence/task-9-uninstall-cleanup.txt
  ```

  **Evidence to Capture**:
  - [ ] task-9-integration-full.txt
  - [ ] task-9-error-missing-db.txt
  - [ ] task-9-error-corrupted-json.txt
  - [ ] task-9-uninstall-cleanup.txt

  **Commit**: YES
  - Message: `feat(install): add Windows support with PowerShell installer`
  - Files: `install.ps1`, `uninstall.ps1`, `9router-sync.cmd`, `package.json`, `README.md`
  - Pre-commit: `node bin/9router-sync --help` (verify CLI still works)

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**

- [x] F1. **Plan Compliance Audit** — `oracle` — VERDICT: APPROVE

  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high` — VERDICT: APPROVE

  Run `node bin/9router-sync --help` to verify no syntax errors. Review all changed files for: hardcoded paths, missing error handling, console.log in production code, commented-out code. Check for Windows-specific issues: path separators, line endings (CRLF vs LF), PowerShell syntax errors.
  
  Output: `Syntax [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` — VERDICT: APPROVE

  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-platform: Unix behavior unchanged, Windows works correctly. Test edge cases: missing DB, corrupted JSON, spaces in paths. Save to `.sisyphus/evidence/final-qa/`.
  
  Output: `Scenarios [N/N pass] | Cross-platform [PASS/FAIL] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep` — VERDICT: APPROVE

  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect unaccounted changes.
  
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: No commits (foundation work)
- **Wave 2**: 
  - After Task 5: `feat(core): add cross-platform database support for Windows` - `lib/db-handler.mjs`, `lib/sync-lib.mjs`
- **Wave 3**:
  - After Task 9: `feat(install): add Windows support with PowerShell installer` - `install.ps1`, `uninstall.ps1`, `9router-sync.cmd`, `package.json`, `README.md`

---

## Success Criteria

### Verification Commands

**Windows:**
```powershell
# Installation
.\install.ps1
9router-sync --help  # Expected: usage information, exit code 0

# Database read
echo '{"providerConnections":[{"id":"test","provider":"ollama","authType":"apikey","name":"Test","priority":1,"isActive":true,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","apiKey":"key","providerSpecificData":{}}]}' > $env:USERPROFILE\AppData\Roaming\9router\db.json
9router-sync --dry-run  # Expected: sync plan displayed, exit code 0

# Uninstallation
.\uninstall.ps1
9router-sync --help  # Expected: command not found
```

**Unix (regression):**
```bash
# Verify unchanged behavior
./install.sh
9router-sync --help  # Expected: same output as before Windows support
9router-sync --dry-run  # Expected: same behavior as before
```

### Final Checklist
- [ ] All "Must Have" features implemented
- [ ] All "Must NOT Have" guardrails respected
- [ ] Windows installation works end-to-end
- [ ] Windows sync operations work correctly
- [ ] Unix functionality unchanged (no regressions)
- [ ] All QA scenarios pass
- [ ] Documentation updated with Windows instructions
- [ ] User explicitly approves final verification results

  **What to do**:
  - Import `db-handler.mjs` functions
  - Replace `openDb()` calls with `readProviderConnections()` from db-handler
  - Replace direct SQLite queries with db-handler abstraction
  - Update `getDeviceId()` to work with both SQLite and JSON (read from JSON if Windows, SQLite if Unix)
  - Remove direct better-sqlite3 usage from sync-lib.mjs (move to db-handler)
  - Preserve all existing behavior for Unix (no functional changes)
  - Update write operations to use `writeProviderConnections()` from db-handler

  **Must NOT do**:
  - Change function signatures or exports
  - Add new features beyond platform abstraction
  - Refactor unrelated code
  - Change error handling behavior

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires careful refactoring to preserve existing behavior while adding abstraction
  - **Skills**: [`javascript-pro`]
    - `javascript-pro`: Module imports, async/await patterns, error handling
  - **Skills Evaluated but Omitted**:
    - `typescript-expert`: No TypeScript in project

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (but must wait for Task 1)
  - **Blocks**: Task 6 (bin script update), Task 9 (integration testing)
  - **Blocked By**: Task 1 (db-handler must exist first)

  **References**:

  **Pattern References**:
  - `lib/sync-lib.mjs:96-100` - Current `openDb()` function to replace
  - `lib/sync-lib.mjs:102-109` - Current `getDeviceId()` function to update
  - `bin/9router-sync:42-44` - Current usage: `const db = openDb(false); const localRows = db.prepare('SELECT * FROM providerConnections').all()`
  - `bin/9router-sync:90-109` - Current write pattern with SQLite transaction

  **API/Type References**:
  - Task 1 deliverable: `db-handler.mjs` exports `readProviderConnections()`, `writeProviderConnections()`, `detectPlatform()`

  **WHY Each Reference Matters**:
  - `openDb()`: Shows current SQLite initialization - replace with db-handler call
  - `getDeviceId()`: Reads from SQLite `apiKeys` table - need JSON equivalent for Windows
  - `bin/9router-sync:42-44`: Shows how db is currently used - must preserve this interface
  - `bin/9router-sync:90-109`: Shows write pattern - must work with db-handler

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Unix functionality unchanged (regression test)
    Tool: Bash
    Preconditions: Unix system with SQLite database at ~/.9router/db/data.sqlite
    Steps:
      1. cd /path/to/9router-sync
      2. node bin/9router-sync --dry-run
      3. Assert output format matches pre-refactor behavior
      4. Assert exit code is 0
    Expected Result: Identical behavior to before refactoring
    Failure Indicators: Different output, errors, changed behavior
    Evidence: .sisyphus/evidence/task-5-unix-regression.txt

  Scenario: Windows database read via db-handler
    Tool: Bash (PowerShell)
    Preconditions: Windows with test db.json
    Steps:
      1. echo '{"providerConnections":[{"id":"test-123","provider":"ollama","authType":"apikey","name":"Test","priority":1,"isActive":true,"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","apiKey":"secret","providerSpecificData":{}}]}' > $env:USERPROFILE\AppData\Roaming\9router\db.json
      2. node bin/9router-sync --dry-run
      3. Assert output contains "test-123"
      4. Assert no SQLite errors
    Expected Result: Reads Windows JSON successfully
    Failure Indicators: SQLite errors, file not found, incorrect data
    Evidence: .sisyphus/evidence/task-5-windows-read.txt

  Scenario: getDeviceId works on Windows
    Tool: Bash (PowerShell)
    Preconditions: Windows db.json with machineId field
    Steps:
      1. echo '{"apiKeys":[{"machineId":"WIN-MACHINE-123"}],"providerConnections":[]}' > $env:USERPROFILE\AppData\Roaming\9router\db.json
      2. node -e "import('./lib/sync-lib.mjs').then(m => console.log(m.getDeviceId()))"
      3. Assert output is "WIN-MACHINE-123"
    Expected Result: Device ID extracted from JSON
    Failure Indicators: "unknown" returned, error thrown
    Evidence: .sisyphus/evidence/task-5-deviceid-windows.txt
  ```

  **Evidence to Capture**:
  - [ ] task-5-unix-regression.txt
  - [ ] task-5-windows-read.txt
  - [ ] task-5-deviceid-windows.txt

  **Commit**: YES
  - Message: `feat(core): add cross-platform database support for Windows`
  - Files: `lib/db-handler.mjs`, `lib/sync-lib.mjs`
  - Pre-commit: `node bin/9router-sync --help` (verify no syntax errors)

- [x] 6. Update bin/9router-sync for cross-platform paths

  **What to do**:
  - Import Node.js `path` module
  - Replace hardcoded Unix paths with cross-platform equivalents:
    - `~/.9router/db/data.sqlite` → use `path.join(os.homedir(), '.9router', 'db', 'data.sqlite')`
    - `~/.9router/sync.json` → use `path.join(os.homedir(), '.9router', 'sync.json')`
  - Update `CONFIG_PATH` and `DB_PATH` constants in sync-lib.mjs if they exist
  - Ensure all path operations use `path.join()` instead of string concatenation

  **Must NOT do**:
  - Change CLI interface or arguments
  - Add new commands or flags
  - Refactor unrelated logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple path replacement, no complex logic
  - **Skills**: [`javascript-pro`]
    - `javascript-pro`: Node.js path and os modules
  - **Skills Evaluated but Omitted**:
    - None

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (but must wait for Task 5)
  - **Blocks**: Task 8 (README), Task 9 (integration testing)
  - **Blocked By**: Task 5 (sync-lib refactor must complete first)

  **References**:

  **Pattern References**:
  - `lib/sync-lib.mjs:12` - Current `DB_PATH` constant: `join(HOME, '.9router', 'db', 'data.sqlite')`
  - `lib/sync-lib.mjs:13` - Current `CONFIG_PATH` constant: `join(HOME, '.9router', 'sync.json')`
  - `lib/sync-lib.mjs:11` - Current `HOME` constant: `homedir()`

  **External References**:
  - Node.js path docs: https://nodejs.org/api/path.html

  **WHY Each Reference Matters**:
  - Already uses `path.join()` and `homedir()` - just need to verify Windows compatibility
  - May need to update DB_PATH logic to detect platform and use correct file

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Config path resolves correctly on Windows
    Tool: Bash (PowerShell)
    Preconditions: Windows system
    Steps:
      1. node -e "import('./lib/sync-lib.mjs').then(m => console.log(m.CONFIG_PATH))"
      2. Assert output contains "AppData\Roaming\9router" or ".9router"
      3. Assert no Unix-style paths (no forward slashes on Windows)
    Expected Result: Windows-style path with backslashes
    Failure Indicators: Unix path format, hardcoded paths
    Evidence: .sisyphus/evidence/task-6-config-path-windows.txt

  Scenario: DB path resolves correctly on Windows
    Tool: Bash (PowerShell)
    Preconditions: Windows system
    Steps:
      1. node -e "import('./lib/sync-lib.mjs').then(m => console.log(m.DB_PATH))"
      2. Assert output contains Windows-appropriate path
    Expected Result: Correct Windows path to db.json
    Failure Indicators: SQLite path on Windows, incorrect directory
    Evidence: .sisyphus/evidence/task-6-db-path-windows.txt
  ```

  **Evidence to Capture**:
  - [ ] task-6-config-path-windows.txt
  - [ ] task-6-db-path-windows.txt

  **Commit**: NO (groups with Task 5)

- [x] 7. Update package.json files array

  **What to do**:
  - Add Windows scripts to `files` array in `package.json`:
    - `install.ps1`
    - `uninstall.ps1`
    - `9router-sync.cmd`
  - Verify existing entries remain: `bin`, `lib`, `README.md`, `LICENSE`

  **Must NOT do**:
  - Change version number
  - Add new dependencies
  - Modify other package.json fields

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Trivial JSON edit
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - All skills: Simple JSON editing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6)
  - **Blocks**: Task 9 (integration testing)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `package.json:9-14` - Current `files` array

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: package.json includes Windows scripts
    Tool: Bash
    Preconditions: package.json updated
    Steps:
      1. cat package.json | grep -A 10 '"files"'
      2. Assert output contains "install.ps1"
      3. Assert output contains "uninstall.ps1"
      4. Assert output contains "9router-sync.cmd"
    Expected Result: All Windows scripts listed in files array
    Failure Indicators: Missing entries, invalid JSON
    Evidence: .sisyphus/evidence/task-7-package-json.txt
  ```

  **Evidence to Capture**:
  - [ ] task-7-package-json.txt

  **Commit**: NO (groups with Task 9)


  **What to do**:
  - Create `uninstall.ps1` mirroring `uninstall.sh` structure
  - Remove CLI wrapper from PREFIX directory (`$HOME\.local\bin\9router-sync.cmd` or `$HOME\bin\9router-sync.cmd`)
  - Remove APP_DIR (`$HOME\.9router-sync\`) recursively
  - Print confirmation message
  - Handle case where files don't exist (no error, just skip)

  **Must NOT do**:
  - Remove user's 9router database or config
  - Add interactive confirmation prompts
  - Remove PATH entries automatically

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file deletion script
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - All skills: Basic PowerShell file operations

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 9 (integration testing)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `uninstall.sh:1-20` - Complete Unix uninstaller to mirror

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Uninstall after successful installation
    Tool: Bash (PowerShell)
    Preconditions: 9router-sync installed via install.ps1
    Steps:
      1. .\uninstall.ps1
      2. 9router-sync --help
      3. Assert command not found error
      4. Test-Path $HOME\.9router-sync
      5. Assert returns False
    Expected Result: All files removed, command no longer accessible
    Failure Indicators: Files remain, command still works
    Evidence: .sisyphus/evidence/task-3-uninstall-success.txt

  Scenario: Uninstall when nothing installed (idempotent)
    Tool: Bash (PowerShell)
    Preconditions: No 9router-sync installation
    Steps:
      1. .\uninstall.ps1
      2. Assert exit code 0
      3. Assert no errors printed
    Expected Result: Script completes successfully with no errors
    Failure Indicators: Error messages, non-zero exit code
    Evidence: .sisyphus/evidence/task-3-uninstall-idempotent.txt
  ```

  **Evidence to Capture**:
  - [ ] task-3-uninstall-success.txt
  - [ ] task-3-uninstall-idempotent.txt

  **Commit**: NO (groups with Task 9)

- [x] 4. Create batch CLI wrapper

  **What to do**:
  - Create `9router-sync.cmd` batch file
  - Invoke Node.js with correct path to `bin/9router-sync`
  - Pass all arguments through: `%*`
  - Handle spaces in paths with proper quoting
  - Set exit code from Node.js process: `exit /b %ERRORLEVEL%`

  **Must NOT do**:
  - Add argument parsing or validation (let Node.js script handle it)
  - Add environment variable setup
  - Add logging or telemetry

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Trivial batch file wrapper
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - All skills: Basic batch scripting

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Task 9 (integration testing)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `bin/9router-sync:1` - Shebang line shows Node.js invocation pattern (adapt for Windows)

  **External References**:
  - Batch file docs: https://ss64.com/nt/cmd.html

  **WHY Each Reference Matters**:
  - Need to replicate `#!/usr/bin/env node` behavior in batch format

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: CLI wrapper invokes Node.js script correctly
    Tool: Bash (PowerShell)
    Preconditions: 9router-sync.cmd in PATH, Node.js installed
    Steps:
      1. 9router-sync --help
      2. Assert output contains "usage: 9router-sync"
      3. Assert exit code is 0
    Expected Result: Help text displayed correctly
    Failure Indicators: Command not found, wrong output, non-zero exit
    Evidence: .sisyphus/evidence/task-4-wrapper-help.txt

  Scenario: CLI wrapper passes arguments correctly
    Tool: Bash (PowerShell)
    Preconditions: 9router-sync.cmd in PATH
    Steps:
      1. 9router-sync --dry-run
      2. Assert output contains "dry-run" or similar
      3. Assert exit code is 0
    Expected Result: --dry-run flag recognized by Node.js script
    Failure Indicators: Flag not recognized, error message
    Evidence: .sisyphus/evidence/task-4-wrapper-args.txt

  Scenario: CLI wrapper handles spaces in paths
    Tool: Bash (PowerShell)
    Preconditions: Install to path with spaces (e.g., "C:\Program Files\9router-sync")
    Steps:
      1. $env:APP_DIR = "C:\Program Files\9router-sync"
      2. .\install.ps1
      3. 9router-sync --help
      4. Assert no path-related errors
    Expected Result: Works correctly despite spaces in path
    Failure Indicators: "path not found" errors, incorrect path parsing
    Evidence: .sisyphus/evidence/task-4-wrapper-spaces.txt
  ```

  **Evidence to Capture**:
  - [ ] task-4-wrapper-help.txt
  - [ ] task-4-wrapper-args.txt
  - [ ] task-4-wrapper-spaces.txt

  **Commit**: NO (groups with Task 9)

