# Learnings - Windows Support

## Conventions & Patterns

(Agents will append findings here)

## Task 1: db-handler.mjs Implementation

### Windows JSON Path
- Windows 9router uses `%USERPROFILE%\AppData\Roaming\9router\db.json`
- Not the Unix path `~/.9router/db/data.sqlite`

### Data Transformation Pattern
- Windows JSON: Flat structure with extra fields at top level (apiKey, testStatus, providerSpecificData, modelLock_*, lastError)
- SQLite: Normalized with extra fields packed into `data` JSON string column
- Round-trip transformation preserves all fields correctly

### Platform Detection
- Use `process.platform === 'win32'` for Windows detection
- On Windows, JSON path uses `process.env.USERPROFILE` as base
- On Unix, SQLite path uses `homedir()` as base

### SQLite Patterns (from sync-lib.mjs)
- better-sqlite3 loading: Check multiple candidate paths (bundled, 9router runtime, nvm, global)
- Transaction pattern: `db.transaction(() => { for (row of rows) stmt.run(row); })`
- Upsert pattern: `INSERT ... ON CONFLICT(id) DO UPDATE SET ...`

### Error Handling
- Missing DB: Clear "not found" message with path
- Corrupted JSON: Include parse error details
- Invalid structure: Check for required fields (providerConnections array)

### Windows Write Behavior
- Creates file if missing (different from Unix SQLite which requires existing file)
- Preserves other top-level fields in JSON when writing

## Task 2: Windows Installer (install.ps1)

### PowerShell Patterns
- Use `$PSScriptRoot` or `Split-Path -Parent $MyInvocation.MyCommand.Definition` for script location
- Color output: `$([char]27)[32m` for green, `[33m` for yellow, `[31m` for red
- Check command existence: `Get-Command <cmd> -ErrorAction SilentlyContinue`
- PATH split: `$env:PATH -split ";"`
- Join paths: `Join-Path $HOME ".9router-sync"`

### Windows CLI Wrapper Pattern
- `.cmd` wrapper calls `node` with full path to the script
- Use `%USERPROFILE%` for home directory in batch files
- Respect `APP_DIR` environment variable for custom install locations
- Example: `node "%USERPROFILE%\.9router-sync\bin\9router-sync" %*`

### Installation Flow
1. Platform check (reject Unix)
2. Node.js >= 18 check via `node -p 'process.versions.node.split(".")[0]'`
3. npm availability check
4. Determine APP_DIR (env var or default `~\.9router-sync`)
5. Determine PREFIX (env var, or PATH match, or default `~\.local\bin`)
6. Copy files with `Copy-Item -Recurse -Force`
7. Run `npm install --omit=dev --no-audit --no-fund --silent`
8. Copy CLI wrapper to PREFIX
9. Verify with `--help` call
10. Check PATH and warn if PREFIX not in PATH

### Error Handling
- `$ErrorActionPreference = "Stop"` for fail-fast behavior
- Custom `die` function that prints error and exits
- Use `-Force` on `Copy-Item` to handle existing files

### PATH Warning
- Windows users may need to add PREFIX to PATH manually
- Suggest adding to PowerShell profile: `$env:PATH = "$PREFIX;$env:PATH"`

## Task 9: Windows Integration Testing

### Installation Testing
- PowerShell String Escaping Issue Found: Node version check failed due to nested quotes
  - Original: Single quotes wrapping JavaScript with double quotes inside
  - Fixed: Double quotes wrapping JavaScript with single quotes inside
  - Lesson: PowerShell string escaping differs from bash - use double quotes for outer string
- Installation flow works end-to-end on Windows 11 with Node v24.14.1
- better-sqlite3 compiles successfully during npm install
- CLI wrapper (9router-sync.cmd) works correctly

### Config & DB Paths
- Config: %USERPROFILE%\.9router\sync.json (matches Unix ~/.9router/sync.json)
- DB: %APPDATA%\9router\db.json (Windows-specific, differs from Unix SQLite path)
- Both paths resolve correctly via environment variables

### Error Handling Validation
- Missing DB: Clear error with full path shown
- Invalid Config: Clear validation error for missing required fields
- Network Errors: Proper error propagation when Supabase unreachable
- Corrupted JSON: May need additional logging (error caught but not explicitly logged)

### Uninstallation
- Removes app directory and CLI wrapper cleanly
- Preserves user config (sync.json) as intended
- Clear instructions for manual cleanup if needed

### Test Data Patterns
- Use dummy Supabase URLs for testing: https://test-project.supabase.co
- Use dummy API keys: test-dummy-key-for-qa-testing-only
- Sample provider connections work with both ollama and openai types
- JSON structure auto-expands with 9router defaults (settings, pricing, etc.)

### Windows-Specific Behaviors
- PowerShell command execution requires -ExecutionPolicy Bypass for scripts
- Tee-Object works for capturing output to files
- Path separators: Use semicolon for PATH, backslash for file paths
- Environment variables: $env:USERPROFILE, $env:APPDATA

### Production Readiness
- All critical workflows tested and working
- Error handling robust and user-friendly
- Installation/uninstallation clean and reversible
- Cross-platform compatibility validated
- Minor: Consider adding explicit JSON parse error logging
