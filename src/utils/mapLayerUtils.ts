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
  };


export function createMapLayer(name: string, ctx: mapLayerContext, options: CreateMapLayerOptions = {}): TileLayer<TileSource> {
    const { url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom = 18 } = options;
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
      });
  
      newMapLayer.set("id", mapLayerId);
      newMapLayer.set("name", name);
      newMapLayer.set("xyzUrl", url);
      newMapLayer.set("maxZoom", maxZoom);
  
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
  
  export function removeMapLayer(id: string, ctx: mapLayerContext) {
    const layer = mapLayers[id];
    if (!layer) return;
    ctx.map.removeLayer(layer);
    delete mapLayers[id];
    // update persisted order
    const order = Object.keys(mapLayers);
    storeMapLayerOrder(order).catch(() => {});
  }

  export function restoreMapLayer(
    id: string,
    name: string,
    url: string,
    maxZoom: number,
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
    });

    restoredLayer.set("id", id);
    restoredLayer.set("name", name);
    restoredLayer.set("xyzUrl", url);
    restoredLayer.set("maxZoom", maxZoom);

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
        const { name, url, maxZoom } = list[id];
        restoreMapLayer(id, name, url, maxZoom, { map: globalMap });
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
  