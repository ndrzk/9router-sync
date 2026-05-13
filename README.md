# 9router-sync

Two-way sync of [9router](https://github.com/decolua/9router) `providerConnections` with a Supabase table, so multiple devices can share the same provider accounts (Kiro, GLM, etc.) without re-logging on each machine.

- Last-write-wins per row based on `updatedAt`.
- Never deletes: rows missing on one side are copied over, not pruned.
- Single command, no daemons.

## Requirements

- Node.js 18+
- 9router already installed and initialized (`~/.9router/db/data.sqlite` exists)
- A Supabase project

## Install

One-liner (macOS / Linux):

```bash
curl -fsSL https://raw.githubusercontent.com/alfianriv/9router-sync/main/install.sh | bash
```

The installer copies the package into `~/.9router-sync/`, runs `npm install` so `better-sqlite3` is built against your local Node, and symlinks the CLI into `~/.local/bin/9router-sync` (override with `PREFIX=…`).

From a clone:

```bash
git clone https://github.com/alfianriv/9router-sync.git
cd 9router-sync
./install.sh
```

Uninstall:

```bash
~/.9router-sync/uninstall.sh   # or: curl -fsSL https://raw.githubusercontent.com/alfianriv/9router-sync/main/uninstall.sh | bash
```

## Setup

1. Print the config template and the Supabase schema:

   ```bash
   9router-sync --init
   ```

2. Save the JSON template as `~/.9router/sync.json` and fill in your project URL and an API key:

   ```json
   {
     "supabaseUrl": "https://YOUR-PROJECT.supabase.co",
     "supabaseKey": "SERVICE_ROLE_OR_ANON_KEY",
     "table": "router9_provider_connections"
   }
   ```

   Use the `service_role` key for a personal setup (it bypasses RLS). If you prefer the `anon` key, add an RLS policy keyed on `auth.uid()` or a shared secret.

3. Run the printed SQL in the Supabase SQL editor to create the `router9_provider_connections` table.

## Usage

On each device:

```bash
9router-sync            # merge both directions
9router-sync --dry-run  # print the plan only
```

After a pull, restart 9router so it picks up the refreshed tokens.

## How it works

- Reads `providerConnections` from `~/.9router/db/data.sqlite` via `better-sqlite3`.
- Fetches the same rows from Supabase via the REST endpoint (`/rest/v1/<table>`).
- For each id present on either side:
  - If only one side has it, it gets copied to the other.
  - If both sides have it, the row with the newer `updatedAt` wins.
- Pushes use `Prefer: resolution=merge-duplicates` so they upsert by `id`.
- Pulls apply an `INSERT ... ON CONFLICT(id) DO UPDATE` inside a single SQLite transaction.

The `data` column — which contains OAuth tokens — is stored as `jsonb` on Supabase and as text in SQLite. **Those are plaintext tokens; do not sync them to a publicly-readable project.** Restrict the table with RLS or keep the project private.

## License

MIT
