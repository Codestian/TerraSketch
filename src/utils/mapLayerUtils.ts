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
      wrapX: true,  // Allow horizontal wrapping and proper zoom beyond maxZoom
    }),
    preload: 1,
    opacity,
  });

  newMapLayer.set("id", mapLayerId);
  newMapLayer.set("name", name);
  newMapLayer.set("xyzUrl", url);
  // Remove maxZoom from tile layer to allow zooming beyond source maxZoom
  newMapLayer.set("opacity", opacity);

  mapLayers[mapLayerId] = newMapLayer;

  // Stack new XYZ tiles above existing tile layers (higher index = drawn on top).
  // insertAt(0) would put each new layer at the bottom, inverting visual order vs the UI list.
  const stack = ctx.map.getLayers().getArray();
  let lastTileIdx = -1;
  stack.forEach((l, i) => {
    if (l instanceof TileLayer) lastTileIdx = i;
  });
  ctx.map.getLayers().insertAt(lastTileIdx + 1, newMapLayer);

  // Auto-save the new layer to storage
  import("./saveLayers").then(({ storeMapLayer, storeMapLayerOrder }) => {
    storeMapLayer(newMapLayer).catch(err => {
      console.error('Failed to auto-save new map layer:', err);
    });
    // Also save the updated layer order
    const order = Object.keys(mapLayers);
    storeMapLayerOrder(order).catch(err => {
      console.error('Failed to auto-save map layer order:', err);
    });
  });

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
  // Validate inputs
  if (!id || !name || !url || typeof maxZoom !== 'number' || typeof opacity !== 'number') {
    throw new Error(`Invalid parameters for restoreMapLayer: id=${id}, name=${name}, url=${url}, maxZoom=${maxZoom}, opacity=${opacity}`);
  }
  
  // Ensure maxZoom is a valid number
  const validMaxZoom = Math.max(0, Math.min(22, maxZoom));
  
  // Ensure opacity is between 0 and 1
  const validOpacity = Math.max(0, Math.min(1, opacity));
  
  const restoredLayer: TileLayer<XYZ> = new TileLayer({
    source: new XYZ({
      url,
      maxZoom: validMaxZoom,
      transition: 0,
      crossOrigin: 'anonymous',
      cacheSize: 512,
      wrapX: true,  // Allow horizontal wrapping and proper zoom beyond maxZoom
    }),
    preload: 1,
    opacity: validOpacity,
  });

  restoredLayer.set("id", id);
  restoredLayer.set("name", name);
  restoredLayer.set("xyzUrl", url);
  // Remove maxZoom from tile layer to allow zooming beyond source maxZoom
  restoredLayer.set("opacity", validOpacity);

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
    console.log('Retrieved map layers from storage:', list);
    
    const order = (await retrieveMapLayerOrder()) || Object.keys(list);
    console.log('Retrieved map layer order from storage:', order);
    
    // First, restore all layers present
    Object.keys(list).forEach((id) => {
      const layerData = list[id];
      console.log('Processing layer data:', id, layerData);
      
      // Validate the layer data before restoring
      if (!layerData || typeof layerData !== 'object') {
        console.warn('Invalid layer data for ID:', id, layerData);
        return;
      }
      
      const { name, url, maxZoom, opacity = 1 } = layerData;
      
      // Validate required fields
      if (!name || !url || typeof maxZoom !== 'number') {
        console.warn('Missing required fields for layer:', id, { name, url, maxZoom });
        return;
      }
      
      try {
        restoreMapLayer(id, name, url, maxZoom, opacity, { map: globalMap });
      } catch (error) {
        console.error('Failed to restore layer:', id, error);
      }
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
    
    console.log('Successfully restored', Object.keys(list).length, 'map layers');
    
    // Clamp zoom level to available tile sources after layers are restored
    import('./mapUtils').then(({ clampMapZoomToAvailableTiles }) => {
      clampMapZoomToAvailableTiles();
    }).catch(err => {
      console.warn('Could not clamp zoom level:', err);
    });
    
  } catch (error) {
    console.error('Failed to restore map layers:', error);
    // no map layers; ignore
  } finally {
    mapLayersInitialized = true;
  }
}
