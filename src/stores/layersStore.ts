import { get, writable } from "svelte/store";
import { map, mapReady, getVectorLayerContext } from "../utils/mapUtils";
import { vectorLayers, setActiveLayer, activeLayerId, createVectorLayer } from "../utils/vectorLayerUtils";
import { retrieveAllVectorLayers, storeLayers } from "../utils/saveLayers";
import type VectorLayer from "ol/layer/Vector";
import type VectorSource from "ol/source/Vector";

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
}

export const layers = writable<Layer[]>([]);
export const selectedLayerId = writable<string | null>(null);
/** True after `initLayersFromDBOnce` finishes (success or empty DB). */
export const vectorLayersHydrated = writable(false);

let initialized = false;

/** Create a new empty vector layer and register it in UI stores (used by Layers tab and welcome modal). */
export function addEmptyVectorLayer(nameInput?: string): string {
  const ctx = getVectorLayerContext();
  const trimmed = (nameInput ?? "").trim();
  const layerName = trimmed || `Layer ${get(layers).length + 1}`;
  const newLayer = createVectorLayer(layerName, ctx);
  const newLayerId = newLayer.get("id") as string;
  layers.update((arr) => [...arr, { id: newLayerId, name: layerName, visible: true }]);
  setActiveLayer(newLayerId, ctx);
  selectedLayerId.set(newLayerId);
  storeLayers(true);
  return newLayerId;
}

export async function initLayersFromDBOnce() {
  if (initialized) {
    vectorLayersHydrated.set(true);
    return;
  }

  await mapReady;
  if (!map) {
    vectorLayersHydrated.set(true);
    initialized = true;
    return;
  }

  try {
    const list = await retrieveAllVectorLayers();

    const uiLayers: Layer[] = [];
    let firstId: string | null = null;

    Object.keys(list).forEach((id, index) => {
      const layer: VectorLayer<VectorSource> = list[id].layer as any;
      const name = list[id].name;

      // Ensure properties are set
      layer.set("id", id);
      layer.set("name", name);

      vectorLayers[id] = layer;

      // Only add to map if not already present
      const existsOnMap = map
        .getLayers()
        .getArray()
        .some((l) => l === layer);
      if (!existsOnMap) {
        map.addLayer(layer);
      }

      uiLayers.push({ id, name, visible: true });
      if (index === 0) firstId = id;
    });

    layers.set(uiLayers);

    // Restore selection: prefer persisted id, then current active, else first
    let persistedId: string | null = null;
    try {
      persistedId = localStorage.getItem('activeLayerId');
    } catch {}

    const exists = (id: string | null) => !!id && Object.prototype.hasOwnProperty.call(vectorLayers, id);

    if (exists(persistedId)) {
      setActiveLayer(persistedId as string, getVectorLayerContext());
      selectedLayerId.set(persistedId);
    } else if (exists(activeLayerId)) {
      selectedLayerId.set(activeLayerId);
    } else if (firstId && exists(firstId)) {
      setActiveLayer(firstId, getVectorLayerContext());
      selectedLayerId.set(firstId);
    } else {
      selectedLayerId.set(null);
      try { localStorage.removeItem('activeLayerId'); } catch {}
    }

    initialized = true;
  } catch {
    // No layers found or DB not available; keep empty state
    initialized = true;
  } finally {
    vectorLayersHydrated.set(true);
  }
}


