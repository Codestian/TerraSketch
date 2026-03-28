import { fromGeo } from "@bte-germany/terraconvert";
import { default as Collection } from "ol/Collection";
import { default as Feature } from "ol/Feature";
import type { FeatureLike } from "ol/Feature";
import OLMap from "ol/Map";
import View from "ol/View";
import { defaults as defaultControls } from "ol/control";
import { click } from "ol/events/condition";
import type { Extent } from "ol/extent";
import { GeoJSON } from "ol/format"; // Import GeoJSON format for handling GeoJSON data
import { Polygon, Circle } from "ol/geom";
import type Geometry from "ol/geom/Geometry";
import type SimpleGeometry from "ol/geom/SimpleGeometry";
import type { SketchCoordType } from "ol/interaction/Draw";
import { defaults as defaultInteractions, DragRotate } from "ol/interaction";
import DoubleClickZoom from "ol/interaction/DoubleClickZoom";
import PointerInteraction from "ol/interaction/Pointer";
import Draw, { createBox } from "ol/interaction/Draw";
import Modify from "ol/interaction/Modify";
import Select from "ol/interaction/Select";
import Translate from "ol/interaction/Translate";
import VectorLayer from "ol/layer/Vector";
import {
  fromLonLat,
  toLonLat,
  transform
} from "ol/proj";
import VectorSource from "ol/source/Vector";
import { Fill, Stroke, Style } from "ol/style";
import { writable } from "svelte/store";
import { rotateSelectedFeatures } from "./transformationUtils";
import { showContextMenu, hideContextMenu } from "../stores/contextMenuStore";
import { showFeatureContextMenu, hideFeatureContextMenu } from "../stores/featureContextMenuStore";
import TileLayer from "ol/layer/Tile";
import { OSM, XYZ } from "ol/source";

import * as turf from "@turf/turf";
import { vectorLayers, activeLayerId, getActiveLayer } from "./vectorLayerUtils";
import type { LayerContext } from "./vectorLayerUtils";
import { storeLayers } from "./saveLayers";


// Create a Svelte store to keep track of the selected feature type
export const selectedFeature = writable<Feature | null>(null);
export const hasSelectedFeatures = writable(false);

export let map: OLMap;
let drawInteraction: Draw | null = null;
let freehandSelectDrawInteraction: Draw | null = null;
let freehandSelectTempSource: VectorSource | null = null;
let freehandEscapeHandler: ((e: KeyboardEvent) => void) | null = null;
let freehandPointerUpHandler: (() => void) | null = null;
let freehandDrawingInProgress = false;
let selectInteraction: Select | null = null;
let translateInteraction: Translate | null = null;
let modifyInteraction: Modify | null = null;
let doubleClickZoomInteraction: DoubleClickZoom | null = null;
let rotatePointerInteraction: PointerInteraction | null = null;
let mapMoveTimeout: number | null = null;

export const isFreehandSelectionActive = writable(false);

export const attributionText = writable("TerrasEdit");

// Promise that resolves when the map has been initialized
let resolveMapReady: (() => void) | null = null;
export const mapReady: Promise<void> = new Promise((resolve) => {
  resolveMapReady = resolve;
});

// Define styles for features
const selectedFeatureStyle = new Style({
  stroke: new Stroke({
    color: "blue",
    width: 3,
  }),
  fill: new Fill({
    color: "rgba(0, 0, 255, 0.3)",
  }),
});

const unselectedFeatureStyle = new Style({
  stroke: new Stroke({
    color: "blue",
    width: 1,
  }),
  fill: new Fill({
    color: "rgba(0, 0, 255, 0.1)",
  }),
});

export const inactiveLayerFeatureStyle = new Style({
  stroke: new Stroke({
    color: "gray",
    width: 1,
  }),
  fill: new Fill({
    color: "rgba(200, 200, 200, 0.1)",
  }),
});

// Callback to notify about selection changes
let selectionChangeCallback: (
  selectedFeatures: Collection<Feature>
) => void = () => { };

export function onSelectionChange(
  callback: (selectedFeatures: Collection<Feature>) => void
) {
  selectionChangeCallback = (selectedFeatures) => {
    callback(selectedFeatures);

    // Get the first selected feature
    const feature = selectedFeatures.getArray()[0]; // Assuming single selection
    selectedFeature.set(feature || null);
  };
}

export function getMap(): OLMap {
  return map;
}

export function getSelectInteraction() {
  return selectInteraction;
}

// Compute midpoint of the union bbox of all selected features
function computeSelectionCenter(): [number, number] | null {
  const select = getSelectInteraction();
  if (!select) return null;

  const selected = select.getFeatures();
  if (selected.getLength() === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  selected.forEach((feature: Feature) => {
    const geom = feature.getGeometry();
    if (geom) {
      const extent = geom.getExtent();
      minX = Math.min(minX, extent[0]);
      minY = Math.min(minY, extent[1]);
      maxX = Math.max(maxX, extent[2]);
      maxY = Math.max(maxY, extent[3]);
    }
  });

  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function ensureRotateInteractionOnTop() {
  if (rotatePointerInteraction) {
    map.removeInteraction(rotatePointerInteraction);
    map.addInteraction(rotatePointerInteraction);
  }
}

function enableAltDragFreeRotate() {
  if (rotatePointerInteraction) {
    map.removeInteraction(rotatePointerInteraction);
    rotatePointerInteraction = null;
  }

  let isRotating = false;
  let center: [number, number] | null = null;
  let lastAngleRad = 0;

  rotatePointerInteraction = new PointerInteraction({
    handleDownEvent: (evt) => {
      const oe = evt.originalEvent as MouseEvent;
      const select = getSelectInteraction();
      if (!select || select.getFeatures().getLength() === 0) return false;
      if (!oe.altKey || oe.button !== 0) return false;

      center = computeSelectionCenter();
      if (!center) return false;

      const dx = evt.coordinate[0] - center[0];
      const dy = evt.coordinate[1] - center[1];
      lastAngleRad = Math.atan2(dy, dx);
      isRotating = true;
      return true; // start drag sequence
    },

    handleDragEvent: (evt) => {
      if (!isRotating || !center) return;

      const oe = evt.originalEvent as MouseEvent;
      if (!oe.altKey) {
        isRotating = false;
        center = null;
        return;
      }

      const dx = evt.coordinate[0] - center[0];
      const dy = evt.coordinate[1] - center[1];
      const angleRad = Math.atan2(dy, dx);

      let deltaRad = angleRad - lastAngleRad;
      // Normalize to [-PI, PI] to prevent jumps across the wrap boundary
      if (deltaRad > Math.PI) deltaRad -= 2 * Math.PI;
      if (deltaRad < -Math.PI) deltaRad += 2 * Math.PI;
      const deltaDeg = (deltaRad * 180) / Math.PI;

      rotateSelectedFeatures(deltaDeg, getSelectInteraction());
      lastAngleRad = angleRad;
    },

    handleUpEvent: () => {
      isRotating = false;
      center = null;
      return false;
    },
  });

  map.addInteraction(rotatePointerInteraction);
  ensureRotateInteractionOnTop();
}

// Note: all vector layer operations moved to vectorLayerUtils.ts

export function getVectorLayerContext(): LayerContext {
  return {
    map,
    selectInteraction,
    selectedFeatureStyle,
    unselectedFeatureStyle,
    inactiveLayerFeatureStyle,
  };
}

// Add a right-click listener to display either feature properties menu or coordinates menu
function addRightClickListener(map: OLMap) {
  map.getViewport().addEventListener("click", () => {
    hideContextMenu();
    hideFeatureContextMenu();
  });

  map.getViewport().addEventListener("contextmenu", (evt) => {
    evt.preventDefault();

    // Check if a vector feature is under the cursor
    const pixel = map.getEventPixel(evt);
    let hitFeature: Feature<Geometry> | null = null;

    // Only check for vector features, not image layers
    map.forEachFeatureAtPixel(
      pixel,
      (feature: FeatureLike, layer) => {
        // Only consider features from vector layers, not image layers
        if (feature instanceof Feature && layer instanceof VectorLayer) {
          hitFeature = feature as Feature<Geometry>;
          return true;
        }
        return false;
      },
      { hitTolerance: 5 }
    );

    if (hitFeature) {
      // Check if only one feature is selected before opening the feature context menu
      if (selectInteraction && selectInteraction.getFeatures().getLength() === 1) {
        const props = { ...(hitFeature as any).getProperties() } as Record<string, unknown>;
        if ("geometry" in props) {
          delete (props as any).geometry;
        }

        showFeatureContextMenu({
          x: evt.clientX,
          y: evt.clientY,
          properties: props,
          featureId: ((hitFeature as any).getId() as string | number | null) ?? null,
          feature: hitFeature,
        });
        hideContextMenu();
        return;
      }
      // If multiple features are selected, don't show the feature context menu
      // Just return without showing any menu
      return;
    }

    // If no vector feature, show coordinates menu (this includes clicking on images)
    const coordinate = map.getEventCoordinate(evt);
    const [lon, lat] = toLonLat(coordinate);

    const tpllText = `/tpll ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    const minecraftCoords = fromGeo(lat, lon);
    const tpText = `/tp @p ${minecraftCoords[0].toFixed(0)} y ${minecraftCoords[1].toFixed(0)}`;

    showContextMenu({
      x: evt.clientX,
      y: evt.clientY,
      tpllText,
      tpText,
    });
    hideFeatureContextMenu();
  });
}

// Export a function to clamp zoom level that can be called from other modules
export function clampMapZoomToAvailableTiles() {
  try {
    const view = map.getView();
    const currentZoom = view.getZoom();
    if (!currentZoom) return;
    
    // Find the highest maxZoom among all tile sources
    let maxAvailableZoom = 18; // Default fallback
    
    // Check all layers in the map
    const layers = map.getLayers();
    layers.forEach(layer => {
      // Check if this is a tile layer with a source
      if ('getSource' in layer) {
        const source = (layer as any).getSource();
        // Check if it's an XYZ source
        if (source && 'maxZoom_' in source) {
          // @ts-ignore - accessing internal maxZoom property
          const sourceMaxZoom = source.maxZoom_ || 18;
          maxAvailableZoom = Math.max(maxAvailableZoom, sourceMaxZoom);
        }
      }
    });
    
    // Clamp zoom if necessary
    if (currentZoom > maxAvailableZoom) {
      view.setZoom(maxAvailableZoom);
      console.log(`Clamped zoom from ${currentZoom} to ${maxAvailableZoom} based on available tile sources`);
    }
  } catch (error) {
    console.warn('Error clamping zoom level:', error);
  }
}

// Initializes the map
export function initializeMap(target: HTMLElement) {
  const savedState = restoreMapState();
  map = new OLMap({
    target: target,
    layers: [],
    view: new View({
      center: savedState ? fromLonLat([savedState.lon, savedState.lat]) : fromLonLat([0, 0]),
      zoom: savedState ? savedState.zoom : 3,
    }),
    controls: defaultControls({
      zoom: false,
      rotate: false,
      attribution: false,
    }),
    interactions: defaultInteractions({ shiftDragZoom: false }).extend([
      new DragRotate({
        condition: (event) => {
          const originalEvent = event.originalEvent;
          return (
            originalEvent.shiftKey ||
            originalEvent.metaKey ||
            originalEvent.ctrlKey
          );
        },
      }),
    ]),
  });

  // Set map background color
  map.getViewport().style.background = "rgb(10 12 12)";

  // Add listener for when map movement ends
  map.getView().on('change:center', () => {
    // Clear any existing timeout
    if (mapMoveTimeout) {
      clearTimeout(mapMoveTimeout);
    }
    // Set a new timeout
    mapMoveTimeout = window.setTimeout(() => {
      saveMapState(); // Save the map state when movement stops
    }, 150); // 150ms delay to ensure the movement has actually stopped
  });

  // Also save state when zoom changes
  map.getView().on('change:resolution', () => {
    if (mapMoveTimeout) {
      clearTimeout(mapMoveTimeout);
    }
    mapMoveTimeout = window.setTimeout(() => {
      saveMapState();
    }, 150);
  });

  doubleClickZoomInteraction = map
    .getInteractions()
    .getArray()
    .find(
      (interaction) => interaction instanceof DoubleClickZoom
    ) as DoubleClickZoom;

  enableFeatureSelection();
  enableAltDragFreeRotate();
  addRightClickListener(map);

  if (resolveMapReady) {
    resolveMapReady();
    resolveMapReady = null; // ensure it resolves only once
  }
}

// Converts a circle geometry to a polygon using OpenLayers built-in method
// This ensures circles are properly handled in export and other operations
function convertCircleToPolygon(circle: Circle): Polygon {
  // Use OpenLayers built-in method to get circle coordinates
  // The getCoordinates() method returns coordinates that can be used to create a polygon
  const coordinates = circle.getCoordinates();
  if (coordinates) {
    return new Polygon(coordinates);
  }
  
  // Fallback: if getCoordinates() returns null, use the manual approach
  const center = circle.getCenter();
  const radius = circle.getRadius();
  
  const vertices: [number, number][] = [];
  const numberOfSides = 64;
  
  for (let i = 0; i < numberOfSides; i++) {
    const angle = (i * 2 * Math.PI) / numberOfSides;
    const x = center[0] + radius * Math.cos(angle);
    const y = center[1] + radius * Math.sin(angle);
    vertices.push([x, y]);
  }
  
  // Close the polygon by adding the first point again
  vertices.push(vertices[0]);
  
  return new Polygon([vertices]);
}

// Creates a custom geometry function for drawing ellipses
function createEllipse() {
  return function (coordinates: SketchCoordType, geometry: SimpleGeometry | undefined): SimpleGeometry {
    if (coordinates.length < 2) {
      return geometry || new Polygon([]);
    }

    // Get the current map rotation
    const view = map.getView();
    const rotation = view.getRotation();

    // Extract coordinates properly from SketchCoordType
    const center = coordinates[0] as [number, number];
    const first = coordinates[1] as [number, number];
    
    // Calculate the vector from center to first point
    const dx = first[0] - center[0];
    const dy = first[1] - center[1];
    const radiusX = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate the angle of the first radius vector relative to the map rotation
    const firstAngle = Math.atan2(dy, dx) - rotation;

    let radiusY = radiusX;
    let secondAngle = firstAngle + Math.PI / 2; // Default to perpendicular
    
    if (coordinates.length > 2) {
      const second = coordinates[2] as [number, number];
      const dx2 = second[0] - center[0];
      const dy2 = second[1] - center[1];
      radiusY = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      
      // Calculate the angle of the second radius vector relative to the map rotation
      secondAngle = Math.atan2(dy2, dx2) - rotation;
    }

    // Create ellipse as a polygon with many sides
    const vertices: [number, number][] = [];
    const numberOfSides = 64;
    
    for (let i = 0; i < numberOfSides; i++) {
      const angle = (i * 2 * Math.PI) / numberOfSides;
      
      // Calculate the ellipse point in the ellipse's local coordinate system
      const localX = radiusX * Math.cos(angle);
      const localY = radiusY * Math.sin(angle);
      
      // Rotate the point to match the ellipse's orientation
      const rotatedX = localX * Math.cos(firstAngle) - localY * Math.sin(firstAngle);
      const rotatedY = localX * Math.sin(firstAngle) + localY * Math.cos(firstAngle);
      
      // Apply the map rotation to the rotated point
      const finalX = center[0] + rotatedX * Math.cos(rotation) - rotatedY * Math.sin(rotation);
      const finalY = center[1] + rotatedX * Math.sin(rotation) + rotatedY * Math.cos(rotation);
      
      vertices.push([finalX, finalY]);
    }
    
    // Close the polygon by adding the first point again
    vertices.push(vertices[0]);
    
    const ellipse = new Polygon([vertices]);
    
    if (!geometry) {
      return ellipse;
    } else {
      // Cast to Polygon to access setCoordinates method
      (geometry as Polygon).setCoordinates(ellipse.getCoordinates());
      return geometry;
    }
  };
}

// Enables drawing on the active layer
export function enableDrawing(
  type: "Polygon" | "Circle" | "LineString" | "Point" | "Box" | "Ellipse"
) {
  disableDrawing();
  disableFeatureSelection();

  if (doubleClickZoomInteraction) {
    map.removeInteraction(doubleClickZoomInteraction);
  }

  // Check if there's an active layer before proceeding
  const initialActiveLayer = getActiveLayer();
  if (!initialActiveLayer) {
    alert("No active layer to draw on.");
    return;
  }

  // Use regular Draw interaction for all shapes, including ellipse
  drawInteraction = new Draw({
    source: initialActiveLayer.getSource() as VectorSource,
    type: type === "Box" ? "Circle" : type === "Ellipse" ? "LineString" : type,
    geometryFunction: type === "Box" ? createBox() : type === "Ellipse" ? createEllipse() : undefined,
    maxPoints: type === "Ellipse" ? 3 : undefined, // Allow up to 3 points for ellipse (center, radiusX, radiusY)
  });

  drawInteraction.on("drawend", (event) => {
    const feature = event.feature;
    const geometry = feature.getGeometry();

    // Get the CURRENT active layer at drawing time, not the one from when button was clicked
    const currentActiveLayer = getActiveLayer();
    if (!currentActiveLayer) {
      console.error("No active layer found when drawing completed");
      return;
    }

    // Convert circles to polygons with many sides for better compatibility
    // This ensures circles can be properly exported and modified
    if (geometry instanceof Circle) {
      const polygonGeometry = convertCircleToPolygon(geometry);
      feature.setGeometry(polygonGeometry);
      
      // Force the map to refresh to show the updated geometry
      map.render();
      
      // Use the CURRENT active layer's source, not the old one
      const source = currentActiveLayer.getSource() as VectorSource;
      if (source) {
        source.changed();
      }
    }

    feature.setId("feature-" + generateUniqueId());

    // Set default elevation to 0 for newly created features
    const featureGeometry = feature.getGeometry();
    if (featureGeometry) {
      try {
        // For Point geometry
        if (featureGeometry.getType() === 'Point') {
          const pointGeom = featureGeometry as any;
          const coords = pointGeom.getCoordinates();
          if (coords && coords.length === 2) {
            const newCoords = [coords[0], coords[1], 0];
            pointGeom.setCoordinates(newCoords);
          }
        }
        // For LineString geometry
        else if (featureGeometry.getType() === 'LineString') {
          const lineGeom = featureGeometry as any;
          const coords = lineGeom.getCoordinates();
          if (coords && coords.length > 0) {
            const newCoords = coords.map((coord: any) => [coord[0], coord[1], 0]);
            lineGeom.setCoordinates(newCoords);
          }
        }
        // For Polygon geometry
        else if (featureGeometry.getType() === 'Polygon') {
          const polyGeom = featureGeometry as any;
          const coords = polyGeom.getCoordinates();
          if (coords && coords.length > 0) {
            const newCoords = coords.map((ring: any) => 
              ring.map((coord: any) => [coord[0], coord[1], 0])
            );
            polyGeom.setCoordinates(newCoords);
          }
        }
        // For MultiPolygon geometry (from converted Circle)
        else if (featureGeometry.getType() === 'MultiPolygon') {
          const multiPolyGeom = featureGeometry as any;
          const coords = multiPolyGeom.getCoordinates();
          if (coords && coords.length > 0) {
            const newCoords = coords.map((polygon: any) => 
              polygon.map((ring: any) => 
                ring.map((coord: any) => {
                  if (coord && coord.length >= 2) {
                    return [coord[0], coord[1], 0];
                  }
                  return coord;
                })
              )
            );
            multiPolyGeom.setCoordinates(newCoords);
          }
        }
      } catch (error) {
        console.warn('Error setting default elevation:', error);
      }
    }

    // Add the feature to the CURRENT active layer, not the old one
    const currentSource = currentActiveLayer.getSource() as VectorSource;
    if (currentSource) {
      currentSource.addFeature(feature);
    }

    // Newly created features now have default elevation of 0

    disableDrawing();
    setTimeout(() => {
      enableFeatureSelection();
      if (doubleClickZoomInteraction) {
        map.addInteraction(doubleClickZoomInteraction);
      }
    }, 100);
  });

  map.addInteraction(drawInteraction);
}

// Disables the drawing interaction
export function disableDrawing() {
  if (drawInteraction) {
    map.removeInteraction(drawInteraction);
    drawInteraction = null;
  }
}

// Style for the freehand selection polygon while drawing
const freehandSelectDrawStyle = new Style({
  stroke: new Stroke({
    color: "rgba(0, 150, 255, 0.8)",
    width: 2,
  }),
  fill: new Fill({
    color: "rgba(0, 150, 255, 0.15)",
  }),
});

function cleanupFreehandSelection(selectIntersectingFeatures: Feature[] | null) {
  if (!freehandSelectDrawInteraction) return;

  map.removeInteraction(freehandSelectDrawInteraction);
  freehandSelectDrawInteraction = null;
  if (freehandSelectTempSource) {
    freehandSelectTempSource.clear();
    freehandSelectTempSource = null;
  }

  // Re-enable all map interactions (pan, zoom, rotate, etc.)
  map.getInteractions().getArray().forEach((interaction) => {
    interaction.setActive(true);
  });

  // Re-add selection and related interactions
  if (selectInteraction) {
    map.addInteraction(selectInteraction);
    if (selectIntersectingFeatures !== null) {
      selectInteraction.getFeatures().clear();
      selectIntersectingFeatures.forEach((f) =>
        selectInteraction!.getFeatures().push(f)
      );
      selectionChangeCallback(selectInteraction.getFeatures());
      hasSelectedFeatures.set(selectInteraction.getFeatures().getLength() > 0);
      selectedFeature.set(selectInteraction.getFeatures().getArray()[0] || null);
    }
  }
  if (translateInteraction) map.addInteraction(translateInteraction);
  if (modifyInteraction) map.addInteraction(modifyInteraction);
  if (doubleClickZoomInteraction) map.addInteraction(doubleClickZoomInteraction);
  ensureRotateInteractionOnTop();

  if (freehandEscapeHandler) {
    window.removeEventListener("keydown", freehandEscapeHandler);
    freehandEscapeHandler = null;
  }
  if (freehandPointerUpHandler) {
    const viewport = map.getViewport();
    viewport.removeEventListener("pointerup", freehandPointerUpHandler as EventListener, true);
    freehandPointerUpHandler = null;
  }
  freehandDrawingInProgress = false;
  isFreehandSelectionActive.set(false);
}

/**
 * Enables freehand selection: draw a polygon on the map to select all features
 * that intersect it. Pan, zoom and rotate are disabled while drawing.
 */
export function enableFreehandSelection() {
  if (freehandSelectDrawInteraction) return;

  const activeLayer = getActiveLayer();
  if (!activeLayer) {
    return;
  }

  // Remove select/translate/modify so they don't capture events during draw
  if (selectInteraction) map.removeInteraction(selectInteraction);
  if (translateInteraction) map.removeInteraction(translateInteraction);
  if (modifyInteraction) map.removeInteraction(modifyInteraction);
  if (doubleClickZoomInteraction) map.removeInteraction(doubleClickZoomInteraction);

  freehandSelectTempSource = new VectorSource();
  freehandSelectDrawInteraction = new Draw({
    source: freehandSelectTempSource,
    type: "Polygon",
    freehand: true,
    style: freehandSelectDrawStyle,
  });

  freehandSelectDrawInteraction.on("drawstart", () => {
    freehandDrawingInProgress = true;
  });

  freehandSelectDrawInteraction.on("drawend", (event) => {
    freehandDrawingInProgress = false;
    const drawnFeature = event.feature;
    const polygon = drawnFeature.getGeometry();
    if (!polygon || !(polygon instanceof Polygon)) {
      cleanupFreehandSelection(null);
      return;
    }

    const source = activeLayer.getSource();
    if (!source) {
      cleanupFreehandSelection(null);
      return;
    }
    const format = new GeoJSON();
    const polygonGeo = format.writeGeometryObject(polygon);
    const candidates = source.getFeatures();
    const selected = candidates.filter((f) => {
      const g = f.getGeometry();
      if (!g) return false;
      try {
        const featureGeo = format.writeGeometryObject(g);
        return turf.booleanIntersects(polygonGeo as turf.helpers.Geometry, featureGeo as turf.helpers.Geometry);
      } catch {
        return false;
      }
    });

    cleanupFreehandSelection(selected);
  });

  // Finish freehand polygon on pointer up. Use capture phase so we run before Draw's handleUpEvent
  // (which would otherwise call abortDrawing() when shouldHandle_ is false).
  freehandPointerUpHandler = () => {
    if (freehandSelectDrawInteraction) {
      freehandSelectDrawInteraction.finishDrawing();
    }
  };
  map.getViewport().addEventListener("pointerup", freehandPointerUpHandler as EventListener, true);

  map.addInteraction(freehandSelectDrawInteraction);

  // Disable pan, zoom, rotate during freehand draw
  map.getInteractions().getArray().forEach((interaction) => {
    if (interaction !== freehandSelectDrawInteraction) {
      interaction.setActive(false);
    }
  });

  freehandEscapeHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      cleanupFreehandSelection(null);
    }
  };
  window.addEventListener("keydown", freehandEscapeHandler);
  isFreehandSelectionActive.set(true);
}

/**
 * Disables freehand selection and restores map interactions.
 */
export function disableFreehandSelection() {
  if (freehandSelectDrawInteraction) {
    cleanupFreehandSelection(null);
  }
}

// Enables feature selection and translation interaction
function enableFeatureSelection() {
  if (selectInteraction) {
    map.removeInteraction(selectInteraction);
  }
  if (translateInteraction) {
    map.removeInteraction(translateInteraction);
  }
  if (modifyInteraction) {
    map.removeInteraction(modifyInteraction);
  }

  selectInteraction = new Select({
    condition: click,
    style: (feature) => {
      const isLayerActive =
        activeLayerId &&
        vectorLayers[activeLayerId]
          ?.getSource()
          ?.hasFeature(feature as Feature);
      const isSelected = selectInteraction
        ?.getFeatures()
        .getArray()
        .includes(feature as Feature);
      if (isLayerActive) {
        return isSelected ? selectedFeatureStyle : unselectedFeatureStyle;
      } else {
        return inactiveLayerFeatureStyle;
      }
    },
  });

  const selectedFeatures = selectInteraction.getFeatures();

  selectInteraction.on("select", (event) => {
    const selectedFeatures = event.selected;

    selectedFeatures.forEach((feature: Feature) => {
      const layer = vectorLayers[activeLayerId!];
      const source = layer.getSource();
      if (source && source.hasFeature(feature)) {
      } else {
        selectInteraction!.getFeatures().remove(feature);
      }
    });
  });

  selectedFeatures.on("add", () => {
    selectionChangeCallback(selectedFeatures);
    hasSelectedFeatures.set(selectedFeatures.getLength() > 0);
    selectedFeature.set(selectedFeatures.getArray()[0] || null);
    enableMoveMode();
  });
  selectedFeatures.on("remove", () => {
    storeLayers(true); // Silent autosave when features are unselected
    selectionChangeCallback(selectedFeatures);
    hasSelectedFeatures.set(selectedFeatures.getLength() > 0);
    selectedFeature.set(selectedFeatures.getArray()[0] || null);
  });

  map.addInteraction(selectInteraction);
  ensureRotateInteractionOnTop();
}

// Enables move mode
export function enableMoveMode() {
  if (modifyInteraction) {
    map.removeInteraction(modifyInteraction);
    modifyInteraction = null;
  }
  if (!translateInteraction && selectInteraction) {
    translateInteraction = new Translate({
      features: selectInteraction.getFeatures(),
      // Do not translate while Alt is held (reserved for rotation)
      condition: (evt) => {
        const oe = evt.originalEvent as MouseEvent;
        return !oe.altKey;
      },
    });
    map.addInteraction(translateInteraction);
    ensureRotateInteractionOnTop();
  }
}

// Enables modify mode
export function enableModifyMode() {
  if (translateInteraction) {
    map.removeInteraction(translateInteraction);
    translateInteraction = null;
  }
  if (!modifyInteraction && selectInteraction) {
    modifyInteraction = new Modify({
      features: selectInteraction.getFeatures(),
    });
    map.addInteraction(modifyInteraction);
    ensureRotateInteractionOnTop();
  }
}

// Disables feature selection and translation interaction
export function disableFeatureSelection() {
  if (selectInteraction) {
    map.removeInteraction(selectInteraction);
    selectInteraction = null;
  }
  if (translateInteraction) {
    map.removeInteraction(translateInteraction);
    translateInteraction = null;
  }
  if (modifyInteraction) {
    map.removeInteraction(modifyInteraction);
    modifyInteraction = null;
  }
}

// Checks if any features are selected
export function areFeaturesSelected(): boolean {
  return (
    selectInteraction !== null &&
    selectInteraction.getFeatures().getLength() > 0
  );
}

// Deletes selected features
export function deleteSelectedFeatures() {
  const map = getMap();
  const selectInteraction = getSelectInteraction();

  if (map && selectInteraction) {
    const selectedFeatures = selectInteraction.getFeatures();

    selectedFeatures.forEach((feature: Feature) => {
      Object.keys(vectorLayers).forEach((id) => {
        const layer = vectorLayers[id];
        const source = layer.getSource();
        if (source && source.hasFeature(feature)) {
          source.removeFeature(feature);
        }
      });
    });

    selectedFeatures.clear();
  }
}

// Function to move the map to a specified latitude and longitude
export function moveToLocation(
  lat: number,
  lng: number,
  zoomLevel: number = 15
): void {
  if (!map) {
    console.error("Map is not initialized.");
    return;
  }
  const view = map.getView();
  const coordinates = fromLonLat([lng, lat]);
  view.setCenter(coordinates);
  view.setZoom(zoomLevel);
}

let copiedFeatures: Feature[] = [];

/**
 * Copies the currently selected features to a temporary storage.
 */
export function copySelectedFeatures() {
  const selectInteraction = getSelectInteraction();
  if (!selectInteraction) return;

  const selectedFeatures = selectInteraction.getFeatures();
  copiedFeatures = selectedFeatures
    .getArray()
    .map((feature) => feature.clone());
}

/**
 * Pastes the copied features at the center of the current map view.
 * The copied features are not cleared after pasting, allowing multiple pastes.
 */
export function pasteCopiedFeatures() {
  if (copiedFeatures.length === 0) return;

  const activeLayer = getActiveLayer();
  if (!activeLayer) return;

  const vectorSource = activeLayer.getSource();
  if (!vectorSource) return;

  const map = getMap();
  if (!map) return;

  // Get the center of the current map view
  const view = map.getView();
  const center = view.getCenter();
  if (!center) return;

  // Determine the center of the first copied feature using its extent (works for all geometry types)
  const firstGeom = copiedFeatures[0].getGeometry();
  if (!firstGeom) return;
  const extent = firstGeom.getExtent();
  const centroid: [number, number] = [
    (extent[0] + extent[2]) / 2,
    (extent[1] + extent[3]) / 2,
  ];

  // Translate and paste each feature so that its centroid matches the center of the map view
  copiedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      const deltaX = center[0] - centroid[0];
      const deltaY = center[1] - centroid[1];
      geometry.translate(deltaX, deltaY);
    }
    vectorSource.addFeature(feature.clone());
  });
}

// Function to create a polygon from coordinates and add it to a specified layer
export function addPolygonToLayer(
  coordinates: [number, number][],
  layerId: string
) {
  // Find the vector layer by ID
  const layer = vectorLayers[layerId];
  if (!layer) {
    alert(`Layer with ID '${layerId}' does not exist.`);
    return;
  }

  const translatedCoordinates = coordinates.map((coordinate) =>
    transform(coordinate, "EPSG:4326", "EPSG:3857")
  );

  // Ensure coordinates are in the correct format for Polygon
  const polygonCoordinates = [translatedCoordinates];

  // Create a new polygon geometry
  const polygon = new Polygon(polygonCoordinates);

  // Create a new feature with the polygon geometry
  const feature = new Feature({
    geometry: polygon,
  });

  // Optionally set a unique ID or other properties on the feature
  feature.setId("feature-" + generateUniqueId());

  // Add the feature to the layer's source
  const source = layer.getSource() as VectorSource;
  if (!source) {
    alert(`Source for layer '${layerId}' is not found.`);
    return;
  }
  source.addFeature(feature);
}

function saveMapState() {
  const view = map.getView();
  const center = view.getCenter();
  const zoom = view.getZoom();

  if (center) {
    const [lon, lat] = toLonLat(center);
    localStorage.setItem('mapState', JSON.stringify({
      lat,
      lon,
      zoom
    }));
  }
}

function restoreMapState(): { lat: number; lon: number; zoom: number } | null {
  const savedState = localStorage.getItem('mapState');
  if (savedState) {
    try {
      return JSON.parse(savedState);
    } catch (e) {
      console.error('Error parsing saved map state:', e);
      return null;
    }
  }
  return null;
}

export function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 11);
}