import { fromGeo } from "@bte-germany/terraconvert";
import { default as Collection } from "ol/Collection";
import { default as Feature } from "ol/Feature";
import OLMap from "ol/Map";
import View from "ol/View";
import { defaults as defaultControls } from "ol/control";
import { click } from "ol/events/condition";
import type { Extent } from "ol/extent";
import { GeoJSON } from "ol/format"; // Import GeoJSON format for handling GeoJSON data
import { Polygon } from "ol/geom";
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
import { MapTileLayer, mapTileLayers } from "./mapTileUtils";
import { rotateSelectedFeatures } from "./transformationUtils";


// Create a Svelte store to keep track of the selected feature type
export const selectedFeature = writable<Feature | null>(null);

export let map: OLMap;
let drawInteraction: Draw | null = null;
let selectInteraction: Select | null = null;
let translateInteraction: Translate | null = null;
let modifyInteraction: Modify | null = null;
let doubleClickZoomInteraction: DoubleClickZoom | null = null;
let rotatePointerInteraction: PointerInteraction | null = null;
let mapMoveTimeout: number | null = null;

// Manage multiple vector layers using a plain object
export let vectorLayers: { [key: string]: VectorLayer } = {};
export let activeLayerId: string | null = null;

export const attributionText = writable("TerrasEdit");

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
) => void = () => {};

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

// Function to create a new vector layer with a unique ID and a given name
export function createVectorLayer(name: string): VectorLayer {
  const uniqueId = generateUniqueId();
  const layerId = `layer-${uniqueId}`;

  const newVectorLayer = new VectorLayer({
    source: new VectorSource(),
    style: inactiveLayerFeatureStyle, // Initialize with inactive layer style
  });

  newVectorLayer.set("id", layerId); // Set a unique ID for each layer
  newVectorLayer.set("name", name); // Set the name for the layer

  vectorLayers[layerId] = newVectorLayer;
  map.addLayer(newVectorLayer);

  if (!activeLayerId) {
    activeLayerId = layerId;
    setActiveLayer(layerId); // Set the first layer as the active layer and style it
  }

  return newVectorLayer;
}

// Helper function to generate a unique ID
function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 11); // Generate a random alphanumeric string
}

// Function to remove a vector layer
export function removeVectorLayer(id: string) {
  const layer = vectorLayers[id];
  if (layer) {
    map.removeLayer(layer);
    delete vectorLayers[id];
    if (activeLayerId === id) {
      activeLayerId = null; // Reset active layer if it's removed
    }
  }
}

export function renameLayer(id: string, newName: string) {
  if (vectorLayers[id]) {
    vectorLayers[id].set("name", newName);
  }
}

// Function to set the active layer by its unique ID
export function setActiveLayer(id: string) {
  if (vectorLayers[id]) {
    // Clear selected features before switching layers
    if (selectInteraction) {
      selectInteraction.getFeatures().clear();
    }

    activeLayerId = id;
    const activeLayer = vectorLayers[id];

    // Remove the active layer from the map and re-add it to bring it to the top
    map.removeLayer(activeLayer);
    map.addLayer(activeLayer);

    // Update the style of features in all layers
    Object.keys(vectorLayers).forEach((layerId) => {
      const layer = vectorLayers[layerId];
      const isLayerActive = layerId === activeLayerId;
      layer.setStyle((feature) => {
        const isSelected = selectInteraction
          ?.getFeatures()
          .getArray()
          .includes(feature as Feature);
        if (isLayerActive) {
          return isSelected ? selectedFeatureStyle : unselectedFeatureStyle;
        } else {
          return inactiveLayerFeatureStyle;
        }
      });
    });

    // Ensure the active layer is visible when selected
    activeLayer.setVisible(true);
  } else {
    alert(`Layer with id '${id}' does not exist.`);
  }
}

// Function to get the active layer
export function getActiveLayer(): VectorLayer | null {
  return activeLayerId ? vectorLayers[activeLayerId] || null : null;
}

// Function to import a GeoJSON file and add it as a new layer
export function importGeoJSON(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const geoJsonData = event.target?.result as string;
      const format = new GeoJSON();
      const features = format.readFeatures(geoJsonData, {
        featureProjection: map.getView().getProjection(),
      });

      // Prompt the user for elevation values
      const blockInput = prompt(
        "Enter the default block name used:",
        "diamond_block"
      );
      const elevationStartInput = prompt(
        "Enter the default starting elevation for lines:",
        "0"
      );
      const elevationEndInput = prompt(
        "Enter the default ending elevation for lines:",
        "0"
      );
      const elevationInput = prompt(
        "Enter the default elevation for other shapes:",
        "0"
      );

      const block = blockInput !== null ? blockInput : "diamond_block";

      const elevationStart =
        elevationStartInput !== null ? parseFloat(elevationStartInput) : 0;
      const elevationEnd =
        elevationEndInput !== null ? parseFloat(elevationEndInput) : 0;
      const elevation =
        elevationInput !== null ? parseFloat(elevationInput) : 0;

      // Loop through each feature and apply the corresponding elevation properties
      features.forEach((feature: Feature) => {
        const geometry = feature.getGeometry();
        const properties = feature.getProperties();

        if (geometry && geometry.getType() === "LineString") {
          // Apply elevationStart and elevationEnd to LineString geometries if they don't exist
          if (!properties.hasOwnProperty("elevationStart")) {
            feature.set("elevationStart", elevationStart);
          }
          if (!properties.hasOwnProperty("elevationEnd")) {
            feature.set("elevationEnd", elevationEnd);
          }
        } else {
          // Apply elevation to other geometries if it doesn't exist
          if (!properties.hasOwnProperty("elevation")) {
            feature.set("elevation", elevation);
          }
        }
        feature.set("block", block);
      });

      const uniqueId = generateUniqueId();
      const layerId = `layer-${uniqueId}`;
      const geoJsonLayer = new VectorLayer({
        source: new VectorSource({
          features: features,
        }),
        style: inactiveLayerFeatureStyle,
      });

      geoJsonLayer.set("id", layerId);
      geoJsonLayer.set("name", file.name);

      vectorLayers[layerId] = geoJsonLayer;
      map.addLayer(geoJsonLayer);

      // Move the map to the center of the features
      const extent: Extent = geoJsonLayer.getSource()!.getExtent();
      map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });

      resolve();
    };

    reader.onerror = (error) => {
      alert("Error reading GeoJSON file: " + error);
      reject(error);
    };

    reader.readAsText(file);
  });
}

// Add a right-click listener to display coordinates with two buttons
function addRightClickListener(map: OLMap) {
  const coordContainer = document.createElement("div");
  coordContainer.style.position = "absolute";
  coordContainer.style.zIndex = "1001";
  coordContainer.style.background = "#fff";
  coordContainer.style.padding = "8px 0";
  coordContainer.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)";
  coordContainer.style.display = "none";
  coordContainer.style.flexDirection = "column";
  coordContainer.style.alignItems = "flex-start";
  document.body.appendChild(coordContainer);

  // Create the first coordinate button
  const coordButton1 = document.createElement("button");
  coordButton1.style.padding = "8px 16px";
  coordButton1.style.border = "none";
  coordButton1.style.borderRadius = "4px";
  coordButton1.style.background = "#fff";
  coordButton1.style.cursor = "pointer";
  coordButton1.style.fontFamily = "Arial, sans-serif";
  coordButton1.style.fontSize = "14px";
  coordContainer.appendChild(coordButton1);

  // Create the second coordinate button
  const coordButton2 = document.createElement("button");
  coordButton2.style.padding = "8px 16px";
  coordButton2.style.border = "none";
  coordButton2.style.borderRadius = "4px";
  coordButton2.style.background = "#fff";
  coordButton2.style.cursor = "pointer";
  coordButton2.style.fontFamily = "Arial, sans-serif";
  coordButton2.style.fontSize = "14px";
  coordContainer.appendChild(coordButton2);

  map.getViewport().addEventListener("click", () => {
    coordContainer.style.display = "none";
  });

  map.getViewport().addEventListener("contextmenu", (evt) => {
    evt.preventDefault();
    const coordinate = map.getEventCoordinate(evt);
    const [lon, lat] = toLonLat(coordinate);

    // Set text for the first button
    coordButton1.innerText = `/tpll ${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    const minecraftCoords = fromGeo(lat, lon);

    // Set text for the second button
    coordButton2.innerText = `/tp @p ${minecraftCoords[0].toFixed(0)} y ${minecraftCoords[1].toFixed(0)}`;

    coordContainer.style.left = `${evt.clientX}px`;
    coordContainer.style.top = `${evt.clientY}px`;
    coordContainer.style.display = "flex";
  });

  coordButton1.addEventListener("click", () => {
    const coordsText = coordButton1.innerText;
    navigator.clipboard
      .writeText(coordsText)
      .then(() => {
        coordContainer.style.display = "none";
      })
      .catch((err) => alert("Error copying to clipboard: " + err));
  });

  coordButton2.addEventListener("click", () => {
    const coordsText = coordButton2.innerText;
    navigator.clipboard
      .writeText(coordsText)
      .then(() => {
        coordContainer.style.display = "none";
      })
      .catch((err) => alert("Error copying to clipboard: " + err));
  });
}

// Initializes the map
export function initializeMap(target: HTMLElement) {
  const savedState = restoreMapState();
  
  map = new OLMap({
    target: target,
    layers: [
      mapTileLayers[MapTileLayer.OSM], // Default to OSM layer instead of blank
    ],
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

  // // Define the extent of the image in map coordinates (in this case, EPSG:3857)
  // const imageExtent: Extent = [0, 0, 1024, 968]; // Define your image extent here

  // // Create an ImageStatic source to load the image
  // const imageSource = new ImageStatic({
  //   url: "https://cdn.britannica.com/34/235834-050-C5843610/two-different-breeds-of-cats-side-by-side-outdoors-in-the-garden.jpg", // Image URL
  //   imageExtent: imageExtent,
  // });

  // // Create an ImageLayer using the ImageStatic source
  // const imageLayer = new ImageLayer({
  //   source: imageSource,
  // });

  // map.addLayer(imageLayer);
}

// Change the map's tile layer
export function changeMapTileLayer(layer: MapTileLayer) {
  const baseLayer = mapTileLayers[layer];
  if (baseLayer) {
    const layers = map.getLayers();
    const layersArray = layers.getArray();
    const markerAndVectorLayers = layersArray.slice(1); // Keep all layers except the first base layer
    layers.clear(); // Clear existing layers
    layers.push(baseLayer); // Add the new base layer
    markerAndVectorLayers.forEach((existingLayer) =>
      layers.push(existingLayer)
    ); // Add remaining layers
  } else {
    alert(`Layer with key '${layer}' does not exist.`);
  }
}

// Enables drawing on the active layer
export function enableDrawing(
  type: "Polygon" | "Circle" | "LineString" | "Point" | "Box"
) {
  disableDrawing();
  disableFeatureSelection();

  if (doubleClickZoomInteraction) {
    map.removeInteraction(doubleClickZoomInteraction);
  }

  const activeLayer = getActiveLayer();
  if (!activeLayer) {
    alert("No active layer to draw on.");
    return;
  }

  drawInteraction = new Draw({
    source: activeLayer.getSource() as VectorSource,
    type: type === "Box" ? "Circle" : type,
    geometryFunction: type === "Box" ? createBox() : undefined,
  });

  drawInteraction.on("drawend", (event) => {
    const feature = event.feature;

    feature.setId("feature-" + generateUniqueId());

    // Check if the feature's geometry type is 'LineString'
    if (feature.getGeometry()?.getType() === "LineString") {
      // Add the 'test' property only for LineString features
      feature.set("elevationStart", 0);
      feature.set("elevationEnd", 0);
    } else {
      feature.set("elevation", 0);
    }

    // TODO: Add height
    // feature.set("height", 1);
    feature.set("block", "diamond_block");

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
    enableMoveMode();
  });
  selectedFeatures.on("remove", () =>
    selectionChangeCallback(selectedFeatures)
  );

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

  // Determine the centroid of the copied features
  const centroid = (copiedFeatures[0].getGeometry() as Polygon)
    .getInteriorPoint()
    .getCoordinates();

  // Translate and paste each feature so that its centroid matches the center of the map view
  copiedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry && centroid) {
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
