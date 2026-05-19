import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../lib/sync-lib.mjs';

describe('parseArgs', () => {
  test('supports --pull-only', () => {
    assert.deepEqual(parseArgs(['node', '9router-sync', '--pull-only']), {
      dryRun: false,
      pullOnly: true,
    });
  });

  test('supports --pull-only with --dry-run', () => {
    assert.deepEqual(parseArgs(['node', '9router-sync', '--pull-only', '--dry-run']), {
      dryRun: true,
      pullOnly: true,
    });
  });
});
