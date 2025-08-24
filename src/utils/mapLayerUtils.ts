import TileLayer from "ol/layer/Tile";
import { generateUniqueId, mapReady, map as globalMap } from "./mapUtils";
import { XYZ } from "ol/source";
import OLMap from "ol/Map";
import type TileSource from "ol/source/Tile";
import { retrieveAllMapLayers, retrieveMapLayerOrder, storeMapLayerOrder } from "./saveLayers";

export let mapLayers: { [key: string]: TileLayer } = {};

export type mapLayerContext = {
  map: OLMap;
};

export type CreateMapLayerOptions = {
  url?: string;
  maxZoom?: number;
  opacity?: number;
};


export function createMapLayer(name: string, ctx: mapLayerContext, options: CreateMapLayerOptions = {}): TileLayer<TileSource> {
  const { url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom = 18, opacity = 1 } = options;
  const uniqueId = generateUniqueId();
  const mapLayerId = `mapLayer-${uniqueId}`;

  const newMapLayer: TileLayer<XYZ> = new TileLayer({
    source: new XYZ({
      url,
      maxZoom,
      transition: 0,
      crossOrigin: 'anonymous',
      cacheSize: 512,
    }),
    preload: 1,
    opacity,
  });

  newMapLayer.set("id", mapLayerId);
  newMapLayer.set("name", name);
  newMapLayer.set("xyzUrl", url);
  newMapLayer.set("maxZoom", maxZoom);
  newMapLayer.set("opacity", opacity);

  mapLayers[mapLayerId] = newMapLayer;

  ctx.map.getLayers().insertAt(0, newMapLayer);

  return newMapLayer;
}

export function renameMapLayer(id: string, newName: string) {
  const layer = mapLayers[id];
  if (layer) {
    layer.set("name", newName);
  }
}

export function setMapLayerVisibility(id: string, visible: boolean) {
  const layer = mapLayers[id];
  if (layer) {
    layer.setVisible(visible);
  }
}

export function setMapLayerOpacity(id: string, opacity: number) {
  const layer = mapLayers[id];
  if (layer) {
    layer.setOpacity(opacity);
    layer.set("opacity", opacity);
    
    // Auto-save the layer when opacity changes
    import("./saveLayers").then(({ storeMapLayer }) => {
      storeMapLayer(layer).catch(err => {
        console.error('Failed to auto-save map layer after opacity change:', err);
      });
    });
  }
}

export function getMapLayerOpacity(id: string): number {
  const layer = mapLayers[id];
  return layer ? (layer.getOpacity() ?? 1) : 1;
}

export function removeMapLayer(id: string, ctx: mapLayerContext) {
  const layer = mapLayers[id];
  if (!layer) return;
  ctx.map.removeLayer(layer);
  delete mapLayers[id];
  // update persisted order
  const order = Object.keys(mapLayers);
  storeMapLayerOrder(order).catch(() => { });
}

export function restoreMapLayer(
  id: string,
  name: string,
  url: string,
  maxZoom: number,
  opacity: number,
  ctx: mapLayerContext
): TileLayer<TileSource> {
  const restoredLayer: TileLayer<XYZ> = new TileLayer({
    source: new XYZ({
      url,
      maxZoom,
      transition: 0,
      crossOrigin: 'anonymous',
      cacheSize: 512,
    }),
    preload: 1,
    opacity,
  });

  restoredLayer.set("id", id);
  restoredLayer.set("name", name);
  restoredLayer.set("xyzUrl", url);
  restoredLayer.set("maxZoom", maxZoom);
  restoredLayer.set("opacity", opacity);

  mapLayers[id] = restoredLayer;
  ctx.map.getLayers().insertAt(0, restoredLayer);
  return restoredLayer;
}

let mapLayersInitialized = false;
export async function initMapLayersFromDBOnce() {
  if (mapLayersInitialized) return;
  await mapReady;
  if (!globalMap) { mapLayersInitialized = true; return; }
  try {
    const list = await retrieveAllMapLayers();
    const order = (await retrieveMapLayerOrder()) || Object.keys(list);
    // First, restore all layers present
    Object.keys(list).forEach((id) => {
      const { name, url, maxZoom, opacity = 1 } = list[id];
      restoreMapLayer(id, name, url, maxZoom, opacity, { map: globalMap });
    });
    // Then, apply order by re-inserting in reverse
    const olLayers = globalMap.getLayers();
    order.forEach((id) => {
      const layer = mapLayers[id];
      if (layer) olLayers.remove(layer);
    });
    [...order].reverse().forEach((id) => {
      const layer = mapLayers[id];
      if (layer) olLayers.insertAt(0, layer);
    });
  } catch {
    // no map layers; ignore
  } finally {
    mapLayersInitialized = true;
  }
}
