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
- It is **not downloadable through the API**. There is no route that serves it,
  and it deliberately does not live in `EXPORT_DIR` or `SCHEDULE_RESULT_DIR`,
  which *are* streamed to users. Collect it from the host.
- Passwords never appear in the API response, the job status, the migration log,
  or the application log. The job records only the file name, the account count
  and a SHA-256 checksum.

### What you must do with it

1. Deliver each row to its owner over a channel you trust.
2. **Delete the file.** Nothing deletes it for you — an automatic sweep would
   race with distribution.

If the file cannot be written, the migration still succeeds (the data is
already committed) but logs an `ERROR`: the passwords are unrecoverable at that
point and the accounts must be reset from the Users page.

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
| `CREDENTIALS_DIR` | `storage/credentials` | Where the file is written. Dev compose sets `/app/credentials`, bind-mounted to `./credentials`. |

`credentials/` is in `.gitignore`. Do not commit it.
