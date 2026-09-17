# Migrated user accounts and temporary passwords

Discoverer stores usernames but never passwords, so a migration cannot carry
credentials across. Instead it **provisions** each migrated person with a
freshly generated temporary password, forces them to change it at first login,
and writes the temporary passwords to a file for you to distribute.

---

## What the migration creates

| Principal | Password | Can sign in? | Must change? |
| --- | --- | --- | --- |
| A person (`EU_ROLE_FLAG = 0`) | Generated temporary password | Yes | **Yes**, before anything else |
| A database role (`EU_ROLE_FLAG = 1`) | None — deliberately unusable | **No** | n/a |
| The migration service account | None — deliberately unusable | **No** | n/a |

Roles are grant-holders, not people. Giving `CONNECT` a working password would
invent a login that never existed in Discoverer, so they are created with a
hash no password can match.

## The credentials file

Written once, at the end of a successful migration, to the directory named by
`CREDENTIALS_DIR` — bind-mounted to **`./credentials/`** on the host:

```
credentials/credentials-<run-id>.csv
```

```csv
# Discoverer Neo — temporary credentials
# Migration run: 15866b71-…
# Generated:     2026-08-24T15:21:23.302Z
…
"username","email","temporary_password"
"ADANJ","adanj@migrated.local","<generated>"
```

**This file contains working passwords.** Handling is deliberate:

- It is written **only on a real migration** — a dry run provisions nothing, so
  there are no credentials to leak.
- It is written **after the transaction commits**, so every row corresponds to
  an account that actually exists.
- It is created with an **exclusive open**: a re-run cannot silently overwrite a
  file whose passwords are still being distributed.
- File mode `0600`, directory `0700` where the host honours it.
- It does **not** live in `EXPORT_DIR` or `SCHEDULE_RESULT_DIR`, which *are*
  streamed to users, and no route serves this directory.
- Passwords never appear in the migration API response, the job status, the
  migration log, or the application log. The job records only the file name,
  the account count and a SHA-256 checksum.

### What you must do with it

1. Deliver each row to its owner over a channel you trust.
2. **Delete the file** as soon as you have.

### It is deleted for you after `CREDENTIAL_FILE_TTL_HOURS`

A sweep runs at boot and hourly and removes any `credentials-*.csv` older than
`CREDENTIAL_FILE_TTL_HOURS` (default 24). "Delete it when you are done" was an
instruction inside a file, and an instruction inside a file is not a control.

**The passwords are gone with it** — they are stored only as hashes. If the
file was swept before you distributed it, re-issue instead (below). Raise
`CREDENTIAL_FILE_TTL_HOURS` if a 24-hour window is too short for your cutover.

## Re-issuing: the Credentials file button

Users page → **Credentials file**. Administrators only. It generates a fresh
temporary password for every active account still on a temporary one, forces a
change at next login, and downloads the same CSV in the browser. A copy is
written to `CREDENTIALS_DIR` as well, so the issue is traceable — and swept on
the same timer.

`POST /api/users/credentials` is the route. An optional `userIds` array limits
it to named accounts; omit the body to mean "everyone still on a temporary
password". Database roles are skipped: they hold grants and never sign in.

This is the only way back once a credentials file is gone. Nothing else can
recover a password that was never stored.

If the file cannot be written, the migration still succeeds (the data is
already committed) but logs an `ERROR`: those passwords are unrecoverable, and
the accounts need re-issuing (below).

Only the API-driven migration writes this file. `dn-migrate`, the CLI, wires no
credential sink — it provisions the accounts but hands the passwords nowhere.
After a CLI migration, use the Credentials file button to issue them.

## First login

A provisioned account can reach exactly three routes until it rotates its
password — `change-password`, `me`, and `logout`. Everything else returns:

```json
{ "error": "Password change required", "code": "PASSWORD_CHANGE_REQUIRED" }
```

with HTTP 403. This is enforced in the API's auth guard, not in the UI, because
the API is reachable directly — a front-end-only prompt would be decoration
rather than a control. The web client reads the same flag and routes straight
to the change screen so the user never sees a wall of failed requests.

The new password must be at least 12 characters and different from the
temporary one, and the current password is re-verified even though the caller
already holds a valid token — that stops a borrowed session from taking
ownership of an account by rotating its credential.

## Generated password properties

16 characters from a CSPRNG (`node:crypto`), guaranteed to contain lower-case,
upper-case, digit and symbol, then shuffled so the classes do not sit at fixed
positions.

The alphabet deliberately **excludes `O 0 l 1 I B S`**. These passwords are read
off a printed or pasted list by a human; ambiguous glyphs turn into failed
logins, failed logins turn into support calls, and support calls turn into
passwords being re-sent over chat.

## Related configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `CREDENTIALS_DIR` | `storage/credentials` | Where the file is written. Both compose files set `/app/credentials`, bind-mounted to `./credentials` on the host. |
| `CREDENTIAL_FILE_TTL_HOURS` | `24` | How long a credentials file survives the sweep. |

`credentials/` is in `.gitignore`. Do not commit it.

## Re-provisioning at cutover

Don't assume a fixed headcount of people still needing a credential — query
it live, and query the right thing. `must_change_password = true` alone
over-counts: some of those rows already have a real credential and are just
mid-flow, not still blocked. See
[`docs/admin-guide/user-management.md`](../admin-guide/user-management.md#re-provisioning-at-cutover)
for the two separate queries, and
[`docs/deployment/cutover-runbook.md`](../deployment/cutover-runbook.md#step-6--re-provision-credentials)
for a real rehearsal of the full login → gated → change-password → full-access
sequence.
