# ViewBoard WebSocket Load Test

Simulates multiple player clients connecting to the ViewBoard Socket.io server and measures connection latency, heartbeat delivery, and playlist propagation time.

## Prerequisites

- Node.js >= 20
- The ViewBoard API server running (default `http://localhost:3001`)

## Setup

```bash
cd tests/load
npm install
```

## Running

Default run (100 players against localhost:3001):

```bash
npm test
```

Custom player count:

```bash
npx tsx websocket-load.ts --players 50
npx tsx websocket-load.ts --players 200
```

Custom server URL:

```bash
npx tsx websocket-load.ts --url http://192.168.1.10:3001 --players 100
```

All options:

```
--players <n>     Number of simulated players (default: 100)
--url <url>       Server URL (default: http://localhost:3001)
--tenant <id>     Tenant ID used for screen:join (default: load-test-tenant)
--timeout <ms>    Per-player connection timeout in ms (default: 10000)
```

## What it measures

| Metric | Description |
|---|---|
| Connection latency | Time from `io()` call to `connect` event per player |
| Connection success rate | Percentage of players that connected successfully |
| Playlist propagation latency | Time from broadcast trigger until each player receives `playlist:update` |
| Percentiles | avg, p50, p95, p99, min, max for all latency metrics |

## Test phases

1. **Connect** — All players connect in batches of 20, each emitting `screen:join`
2. **Heartbeat** — Every connected player sends one `screen:heartbeat`
3. **Propagation** — An admin socket emits `playlist:broadcast`; the test measures how long each player takes to receive the resulting `playlist:update`
4. **Report** — Prints a summary table to stdout

## Notes on propagation measurement

The propagation test requires the server to handle a `playlist:broadcast` event (or equivalent) that fans out `playlist:update` to all screens in the tenant room. If the server does not support this event, the propagation phase will be skipped and the report will note it.

To enable propagation testing without modifying the server, you can alternatively trigger a playlist update via the REST API while the load test players are connected.
