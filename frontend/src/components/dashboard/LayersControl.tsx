import { Panel, PanelTitle, Toggle } from "@/components/ui/primitives";
import { useCyclone, type LayerKey } from "@/state/cyclone-store";

const ITEMS: { key: LayerKey; label: string }[] = [
  { key: "wind", label: "Wind Particles" },
  { key: "history", label: "Historical Track" },
  { key: "prediction", label: "Prediction" },
  { key: "corridor", label: "Confidence Corridor" },
  { key: "risk", label: "Risk Zones" },
  { key: "satellite", label: "Satellite View" },
];

export function LayersControl() {
  const { layers, toggleLayer, view } = useCyclone();
  return (
    <Panel>
      <PanelTitle title="Layers" sub={view === "2D" ? "2D map layers" : "Globe layers"} />
      <div className="divide-y divide-border">
        {ITEMS.map((i) => (
          <Toggle key={i.key} label={i.label} checked={layers[i.key]} onChange={() => toggleLayer(i.key)} />
        ))}
      </div>
    </Panel>
  );
}
