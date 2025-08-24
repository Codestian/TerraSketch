import Feature from "ol/Feature";
import OLMap from "ol/Map";
import Select from "ol/interaction/Select";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { GeoJSON } from "ol/format";
import type { Extent } from "ol/extent";
import { Style } from "ol/style";
import { generateUniqueId } from "./mapUtils";

export let vectorLayers: { [key: string]: VectorLayer<VectorSource> } = {};
export let activeLayerId: string | null = null;

export type ImportOptions = {
  block: string;
  elevationStart: number;
  elevationEnd: number;
  elevation: number;
};

export type LayerContext = {
  map: OLMap;
  selectInteraction: Select | null;
  selectedFeatureStyle: Style;
  unselectedFeatureStyle: Style;
  inactiveLayerFeatureStyle: Style;
};

export function getActiveLayer(): VectorLayer<VectorSource> | null {
  return activeLayerId ? vectorLayers[activeLayerId] || null : null;
}

export function renameLayer(id: string, newName: string) {
  if (vectorLayers[id]) {
    vectorLayers[id].set("name", newName);
  }
}

export function removeVectorLayer(id: string, ctx: LayerContext) {
  const layer = vectorLayers[id];
  if (layer) {
    ctx.map.removeLayer(layer);
    delete vectorLayers[id];
    if (activeLayerId === id) {
      activeLayerId = null;
    }
  }
}

export function setActiveLayer(id: string, ctx: LayerContext) {
  if (!vectorLayers[id]) {
    alert(`Layer with id '${id}' does not exist.`);
    return;
  }

  if (ctx.selectInteraction) {
    ctx.selectInteraction.getFeatures().clear();
  }

  activeLayerId = id;
  const activeLayer = vectorLayers[id];

  try {
    localStorage.setItem("activeLayerId", id);
  } catch {}

  ctx.map.removeLayer(activeLayer);
  ctx.map.addLayer(activeLayer);

  Object.keys(vectorLayers).forEach((layerId) => {
    const layer = vectorLayers[layerId];
    const isLayerActive = layerId === activeLayerId;
    layer.setStyle((feature) => {
      const isSelected = ctx.selectInteraction
        ?.getFeatures()
        .getArray()
        .includes(feature as Feature);
      if (isLayerActive) {
        return isSelected
          ? ctx.selectedFeatureStyle
          : ctx.unselectedFeatureStyle;
      } else {
        return ctx.inactiveLayerFeatureStyle;
      }
    });
  });

  activeLayer.setVisible(true);
}

export function createVectorLayer(name: string, ctx: LayerContext): VectorLayer<VectorSource> {
  const uniqueId = generateUniqueId();
  const layerId = `layer-${uniqueId}`;

  const newVectorLayer = new VectorLayer({
    source: new VectorSource(),
    style: ctx.inactiveLayerFeatureStyle,
  });

  newVectorLayer.set("id", layerId);
  newVectorLayer.set("name", name);

  vectorLayers[layerId] = newVectorLayer;
  ctx.map.addLayer(newVectorLayer);

  if (!activeLayerId) {
    activeLayerId = layerId;
    setActiveLayer(layerId, ctx);
  }

  return newVectorLayer;
}

export function importGeoJSON(
  file: File,
  options: ImportOptions,
  ctx: LayerContext
): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const geoJsonData = event.target?.result as string;
      const format = new GeoJSON();
      const features = format.readFeatures(geoJsonData, {
        featureProjection: ctx.map.getView().getProjection(),
      });

      const { block, elevationStart, elevationEnd, elevation } = options;

      features.forEach((feature: Feature) => {
        const geometry = feature.getGeometry();
        const properties = feature.getProperties();
        if (geometry && geometry.getType() === "LineString") {
          if (!Object.prototype.hasOwnProperty.call(properties, "elevationStart")) {
            feature.set("elevationStart", elevationStart);
          }
          if (!Object.prototype.hasOwnProperty.call(properties, "elevationEnd")) {
            feature.set("elevationEnd", elevationEnd);
          }
        } else {
          if (!Object.prototype.hasOwnProperty.call(properties, "elevation")) {
            feature.set("elevation", elevation);
          }
        }
        feature.set("block", block);
      });

      const uniqueId = generateUniqueId();
      const layerId = `layer-${uniqueId}`;
      const geoJsonLayer = new VectorLayer({
        source: new VectorSource({ features }),
        style: ctx.inactiveLayerFeatureStyle,
      });

      geoJsonLayer.set("id", layerId);
      geoJsonLayer.set("name", file.name);

      vectorLayers[layerId] = geoJsonLayer;
      ctx.map.addLayer(geoJsonLayer);

      const extent: Extent = geoJsonLayer.getSource()!.getExtent();
      ctx.map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });

      resolve();
    };

    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}


