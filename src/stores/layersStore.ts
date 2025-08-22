import { writable } from "svelte/store";
import { map, mapReady, getVectorLayerContext } from "../utils/mapUtils";
import { vectorLayers, setActiveLayer, activeLayerId } from "../utils/vectorLayerUtils";
import { retrieveAllVectorLayers } from "../utils/saveLayers";
import type VectorLayer from "ol/layer/Vector";
import type VectorSource from "ol/source/Vector";

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
}

export const layers = writable<Layer[]>([]);
export const selectedLayerId = writable<string | null>(null);

let initialized = false;

export async function initLayersFromDBOnce() {
  if (initialized) return;

  await mapReady;
  if (!map) return; // Map not ready; bail out silently

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
  }
}


