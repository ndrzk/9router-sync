# Learnings - fix-json-merge-bug

## Conventions & Patterns

(Subagents will append findings here after each task)

## Task 1: mergeRowsById() Helper

- **Pattern**: Extract merge logic into pure helper function for reusability across JSON writers
- **Placement**: After `normalizedToWindowsRow()` keeps transformation helpers grouped together
- **Export**: Function must be exported for use by writers and testable from CLI
- **Algorithm**: `[...existingRows.filter(r => !incomingIds.has(r.id)), ...incomingRows]` preserves non-conflicting existing rows, incoming wins on conflicts
- **QA**: All 3 scenarios passed - helper exists, disjoint merge works, ID conflict resolved correctly
- **Evidence saved**: `.sisyphus/evidence/task-1-*.txt`

## Task 2: JSON Writer Fixes

- **Pattern**: Atomic write via .tmp file + renameSync prevents partial writes
- **Pattern**: Fail-loud on corrupted JSON (throw error instead of silent fallback) prevents data loss
- **Merge logic**: Both writeWindowsJson() and writeUnixJson() now use mergeRowsById() to merge existing + incoming rows
- **Import**: Added renameSync to node:fs imports
- **QA**: All 4 scenarios passed - disjoint merge, atomic write, corrupted fail, empty preserve
- **Evidence saved**: .sisyphus/evidence/task-2-*.txt
- **Key insight**: On Windows, writeProviderConnections calls writeWindowsJson (uses AppData\Roaming path), not writeUnixJson
