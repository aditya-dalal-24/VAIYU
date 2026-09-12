/**
 * What `react-leaflet` is on the server: nothing.
 *
 * Leaflet reads `window` while its module body runs, so it cannot be loaded
 * outside a browser at all. The map is already behind a client-only, lazily
 * imported boundary (`LazyStormMap`), and that turned out not to be enough:
 * in a production build Nitro bundles react, react-dom, leaflet and
 * @react-leaflet/core into one shared chunk, and the SSR entry imports React
 * from it — so merely loading React on the server evaluated Leaflet and every
 * request answered 500. Dev never showed it, because Vite loads modules on
 * demand there, and the build config wrapper deliberately exposes no way to
 * influence Nitro's chunking.
 *
 * So the server is given this instead, aliased in for the SSR environment
 * only. It says the true thing — there is no Leaflet here — rather than
 * shimming a fake `window` and letting the server pretend to be a browser.
 * Every name `StormMap` imports must exist here, or the SSR module fails to
 * link.
 */

/** Rendered only if something bypasses the client-only boundary. */
function NotOnTheServer(): null {
  return null;
}

export const Circle = NotOnTheServer;
export const CircleMarker = NotOnTheServer;
export const MapContainer = NotOnTheServer;
export const Pane = NotOnTheServer;
export const Polyline = NotOnTheServer;
export const TileLayer = NotOnTheServer;
export const Tooltip = NotOnTheServer;

/**
 * There is no map instance to hand back, and inventing one would fail later
 * and further away. Reaching this means a caller rendered the map outside
 * `LazyStormMap`, and the message says so.
 */
export function useMap(): never {
  throw new Error(
    "useMap() was called during server rendering. The map is browser-only; " +
      "render it through LazyStormMap, which keeps it off the server.",
  );
}
