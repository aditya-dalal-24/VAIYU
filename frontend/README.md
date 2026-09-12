# VAIYU console

The React frontend. See the [root README](../README.md) for the whole system and
how to run it; this file covers only what a person editing the frontend needs.

```bash
npm install
npm run dev         # http://localhost:5173
npm run typecheck
npm run build
```

`VITE_API_BASE_URL` points at Spring Boot; it defaults to
`http://localhost:8081`. There is no other backend. The browser never calls the
Python AI service — every call goes through `src/lib/api.ts`, which is the one
place a request to the outside is made.

## Stack

TanStack Start (SSR + file routes), React 19, TanStack Query, Leaflet via
react-leaflet, Recharts, Tailwind v4.

TypeScript runs with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
on. Both are deliberate and both are inconvenient: the first stops `undefined`
being passed where a field means "absent", and the second forces every array
index to be treated as possibly missing — which is the right default in a
codebase whose whole subject is gappy observational data.

## The rules this interface is built on

**Provenance has a colour, and it is never decorative.** Four hues are defined
in `src/styles.css` and used for nothing else:

| | |
| --- | --- |
| `--observed` (blue) | a fix that was actually recorded |
| `--model` (amber) | output of a trained model |
| `--analogue` (violet) | an aggregate of similar past storms |
| `--absent` (grey) | no data — never filled in with a plausible value |

A reader who learns three colours can tell measurement from prediction at a
glance, which is the distinction the whole product turns on.

**Absent is rendered, not hidden.** `ABSENT = "—"` in `src/lib/format.ts` is what
a missing number looks like. Do not substitute a zero, a dash-free blank, a
last-known value, or an interpolation. Uncertainty circles on the map are drawn
only when the model actually returned a radius.

**An empty state is not an error state.** A storm with no forecast yet is the
normal case: the backend answers 204 and the panel invites you to run the
models. Only a genuine failure — 422 "this storm's data cannot support a
forecast", 503 "the model is not loaded", or an unreachable backend — is drawn
as a problem, and each says which of the three it is.

## Layout

```text
src/
  routes/          one file per screen; __root.tsx holds the shell
  components/
    console/       AppShell and the shared primitives (Panel, Metric, Empty…)
    map/           StormMap and its client-only boundary
    timeline/      the scrubbable lifecycle strip
    charts/        Recharts wrappers
  lib/
    api.ts         every HTTP call
    queries.ts     TanStack Query hooks and cache policy
    format.ts      number, date and category formatting, and ABSENT
    verify.ts      scoring a forecast against the outcome and the baselines
    types.ts       the backend contract
```

Two details that will bite if they are undone:

- **The map must stay lazy.** Leaflet touches `window` while its module is
  evaluated, so a static import breaks SSR even if the component never renders
  on the server. `LazyStormMap` keeps it off the server; import `StormMap`
  directly and the route will fail to render.
- **The basemap is keyless.** CARTO's dark basemap now stamps "API KEY
  REQUIRED" over every anonymously served tile, so the tile layer uses Esri
  Dark Gray Canvas, whose axis order is `{z}/{y}/{x}` rather than OSM's
  `{z}/{x}/{y}`.
