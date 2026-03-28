import Feature from "ol/Feature";
import OLMap from "ol/Map";
import Select from "ol/interaction/Select";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import KML from "ol/format/KML";
import type { Extent } from "ol/extent";
import type Projection from "ol/proj/Projection";
import { Style } from "ol/style";
import { unzipSync } from "fflate";
import { generateUniqueId } from "./mapUtils";

export let vectorLayers: { [key: string]: VectorLayer<VectorSource> } = {};
export let activeLayerId: string | null = null;

/** One row in the import GeoJSON default properties table (key → value per feature). */
export type ImportPropertyRow = { key: string; value: string };

/** Default rows whenever the import GeoJSON modal opens. */
export const DEFAULT_IMPORT_PROPERTY_ROWS: ImportPropertyRow[] = [
  { key: "block", value: "diamond_block" },
  { key: "elevation", value: "0" },
];

export type ImportOptions = {
  /** Applied to every imported feature. Row with key `elevation` (case-insensitive) also sets default Z on 2D coordinates. */
  propertyRows: ImportPropertyRow[];
};

function parseImportPropertyValue(raw: string): string | number | boolean {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "") return "";
  if (/^[-+]?(?:\d+\.?\d*|\d*\.\d+)(?:[eE][-+]?\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    if (!Number.isNaN(n)) return n;
  }
  return raw;
}

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

/** Detect format from filename (KMZ is unzipped to KML text before parsing). */
export function fileImportKind(file: File): "geojson" | "kml" | "kmz" {
  const n = file.name.toLowerCase();
  if (n.endsWith(".kmz")) return "kmz";
  if (n.endsWith(".kml")) return "kml";
  return "geojson";
}

function readImportText(file: File): Promise<string> {
  if (fileImportKind(file) === "kmz") {
    return file.arrayBuffer().then((buf) => {
      const out = unzipSync(new Uint8Array(buf));
      const keys = Object.keys(out);
      const docKml =
        keys.find((k) => (k.split("/").pop() ?? "").toLowerCase() === "doc.kml") ||
        keys.find((k) => k.toLowerCase().endsWith(".kml"));
      if (!docKml) {
        throw new Error("KMZ archive does not contain doc.kml or another .kml file");
      }
      return new TextDecoder("utf-8").decode(out[docKml]);
    });
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function parseImportFeatures(
  text: string,
  kind: "geojson" | "kml" | "kmz",
  featureProjection: Projection
): Feature[] {
  if (kind === "kml" || kind === "kmz") {
    const kmlFormat = new KML({ extractStyles: false });
    return kmlFormat.readFeatures(text, {
      featureProjection,
      dataProjection: "EPSG:4326",
    });
  }
  const geoJsonFormat = new GeoJSON();
  return geoJsonFormat.readFeatures(text, { featureProjection });
}

function applyImportOptionsToFeatures(features: Feature[], options: ImportOptions): void {
  const rows = (options.propertyRows || []).filter((r) => r.key.trim().length > 0);
  const elevRow = rows.find((r) => r.key.trim().toLowerCase() === "elevation");
  const elevation = elevRow ? parseFloat(elevRow.value) : 0;
  const elev = Number.isFinite(elevation) ? elevation : 0;

  features.forEach((feature: Feature, index: number) => {
    rows.forEach((row) => {
      const k = row.key.trim();
      if (!k) return;
      feature.set(k, parseImportPropertyValue(row.value));
    });

    if (elev !== 0) {
      const geometry = feature.getGeometry();
      if (geometry) {
        try {
          if (geometry.getType() === "Point") {
            const pointGeom = geometry as any;
            const coords = pointGeom.getCoordinates();
            if (coords && coords.length === 2) {
              pointGeom.setCoordinates([coords[0], coords[1], elev]);
            }
          } else if (geometry.getType() === "LineString") {
            const lineGeom = geometry as any;
            const coords = lineGeom.getCoordinates();
            if (coords && coords.length > 0 && coords[0].length === 2) {
              lineGeom.setCoordinates(
                coords.map((coord: number[]) => [coord[0], coord[1], elev])
              );
            }
          } else if (geometry.getType() === "Polygon") {
            const polyGeom = geometry as any;
            const coords = polyGeom.getCoordinates();
            if (coords && coords.length > 0 && coords[0].length > 0 && coords[0][0].length === 2) {
              polyGeom.setCoordinates(
                coords.map((ring: number[][]) =>
                  ring.map((coord: number[]) => [coord[0], coord[1], elev])
                )
              );
            }
          } else if (geometry.getType() === "MultiPolygon") {
            const multiPolyGeom = geometry as any;
            const coords = multiPolyGeom.getCoordinates();
            if (
              coords &&
              coords.length > 0 &&
              coords[0].length > 0 &&
              coords[0][0].length > 0 &&
              coords[0][0][0].length === 2
            ) {
              multiPolyGeom.setCoordinates(
                coords.map((polygon: number[][][]) =>
                  polygon.map((ring: number[][]) =>
                    ring.map((coord: number[]) => [coord[0], coord[1], elev])
                  )
                )
              );
            }
          }
        } catch (error) {
          console.warn(`Error applying elevation to feature ${index}:`, error);
        }
      }
    }
  });
}

function fitMapToExtent(map: OLMap, extent: Extent): void {
  if (extent.every((v) => Number.isFinite(v))) {
    map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
  }
}

/**
 * Import GeoJSON (.geojson, .json), KML (.kml), or KMZ (.kmz) as a new vector layer.
 */
export function importVectorFile(
  file: File,
  options: ImportOptions,
  ctx: LayerContext
): Promise<void> {
  return readImportText(file).then((text) => {
    const kind = fileImportKind(file);
    const proj = ctx.map.getView().getProjection();
    const features = parseImportFeatures(text, kind, proj);
    applyImportOptionsToFeatures(features, options);

    const uniqueId = generateUniqueId();
    const layerId = `layer-${uniqueId}`;
    const importedLayer = new VectorLayer({
      source: new VectorSource({ features }),
      style: ctx.inactiveLayerFeatureStyle,
    });

    importedLayer.set("id", layerId);
    importedLayer.set("name", file.name);

    vectorLayers[layerId] = importedLayer;
    ctx.map.addLayer(importedLayer);

    const extent = importedLayer.getSource()!.getExtent();
    fitMapToExtent(ctx.map, extent);
  });
}

/** @deprecated Use importVectorFile — kept for existing call sites. */
export const importGeoJSON = importVectorFile;
