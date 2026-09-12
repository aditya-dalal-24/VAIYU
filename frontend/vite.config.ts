// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

/**
 * Keeps Leaflet out of the server's module graph.
 *
 * Leaflet reads `window` while its module body runs, so it cannot be loaded
 * outside a browser at all. The map already sits behind a client-only, lazily
 * imported boundary (`LazyStormMap`) — and that is not enough on its own: in a
 * production build Nitro bundles react, react-dom, leaflet and
 * @react-leaflet/core into one shared chunk, and the SSR entry imports React
 * from it. Loading React on the server therefore evaluated Leaflet, and every
 * route answered 500 with "window is not defined". Dev never showed it,
 * because Vite loads modules on demand there.
 *
 * Neither `ssr.external` nor chunk grouping nor `environments.ssr.resolve.alias`
 * survives this project's config wrapper, which deliberately exposes only
 * Nitro's preset and output directories. A resolver plugin does survive, and it
 * is narrower anyway: it answers one question, for one environment, and leaves
 * the client build entirely alone.
 *
 * `leaflet` itself is deliberately not redirected. The only references left to
 * it on the server are a type-only import, which is erased, and
 * `leaflet/dist/leaflet.css`, which must keep resolving as a stylesheet.
 */
function stubLeafletOnTheServer(): Plugin {
  // fileURLToPath, not URL.pathname: on Windows the latter yields
  // "/D:/..." and rolldown rejects it as a malformed path.
  const stub = fileURLToPath(
    new URL("./src/components/map/react-leaflet.ssr-stub.tsx", import.meta.url),
  );

  return {
    name: "vaiyu:stub-leaflet-on-the-server",
    enforce: "pre",
    resolveId(source) {
      if (this.environment?.name !== "ssr") {
        return null;
      }
      if (source === "react-leaflet" || source.startsWith("@react-leaflet/")) {
        return stub;
      }
      return null;
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      port: 5173,
      strictPort: false,
    },
    plugins: [stubLeafletOnTheServer()],
  },
});
