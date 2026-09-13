# Reporting an error: the correlation id

A genuine error (a **red** panel — see [Executing Maps](../user-guide/executing-maps.md);
an amber refusal panel is different, see [Why a worksheet was declined](refusals.md))
now carries a `correlationId` alongside its message:

```json
{
  "error": "The query could not be completed.",
  "statusCode": 500,
  "kind": "QUERY",
  "correlationId": "8f14e45f-ceea-467e-a4d6-f8c9d1e2b3a4"
}
```

The message on screen is deliberately generic — for a map execution failure,
it never contains the database's own error text (an Oracle `ORA-` message can
describe schema or data internals that should not reach every user who can
run a map). The full detail — the real driver error, the SQL, the stack — is
kept server-side, tagged with the same id.

**When reporting an error, include the `correlationId`.** An administrator
can find the matching server log line (or, for a map execution, the async
job's own id doubles as its correlation id) without needing the raw text
repeated back to them.

`kind` groups the error by what went wrong (`CONFIG`, `CONNECT`, `TIMEOUT`,
`QUERY`, `CANCELLED`, `FORBIDDEN`) — useful for support triage before anyone
opens a log.
