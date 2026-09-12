/**
 * Client-only boundary for the map.
 *
 * Leaflet touches `window` while its module is being evaluated, so a static
 * import breaks server rendering even when the component itself never renders
 * on the server — rendering it inside a mounted check is not enough, because
 * the import runs first. Loading it lazily keeps the module off the server
 * entirely, and the route still renders and streams normally.
 */

import { Suspense, lazy } from "react";

import { ClientOnly } from "@/components/ui/client-only";
import type { StormMapProps } from "./StormMap";

const StormMap = lazy(() =>
  import("./StormMap").then((module) => ({ default: module.StormMap })),
);

function MapPlaceholder() {
  return <div className="graticule h-full w-full" aria-hidden />;
}

export function LazyStormMap(props: StormMapProps) {
  return (
    <ClientOnly fallback={<MapPlaceholder />}>
      <Suspense fallback={<MapPlaceholder />}>
        <StormMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
