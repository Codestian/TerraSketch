import type OLMap from "ol/Map";
import type { Extent } from "ol/extent";
import { generateUniqueId, getMap } from "./mapUtils";
import GeoImageSource from "ol-ext/source/GeoImage";
import GeoImageLayer from "ol-ext/layer/GeoImage";
import { fromLonLat } from "ol/proj";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { 
  storeImageLayer, 
  retrieveAllImageLayers, 
  deleteImageLayerById, 
  storeImageLayerOrder, 
  retrieveImageLayerOrder 
} from "./saveLayers";

export let imageLayers: { [key: string]: GeoImageLayer } = {};
export let activeImageLayerId: string | null = null;

// Debounced auto-save system
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DELAY = 500; // Save 500ms after last change

function debouncedAutoSave() {
  // Clear existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  // Set new timeout
  saveTimeout = setTimeout(() => {
    storeAllImageLayers().catch(err => {
      console.error('Failed to auto-save after transformation:', err);
    });
    saveTimeout = null;
  }, SAVE_DELAY);
}

export type ImageLayerContext = {
  map: OLMap;
  fileData?: string; // Base64 encoded file data for persistence
};

export type CreateImageLayerOptions = {
  url: string; // Image URL
  fileData?: string; // Base64 encoded file data for persistence
  extent?: Extent; // Image extent in map projection (e.g., EPSG:3857)
  opacity?: number; // 0..1
};

/**
 * Creates a static image layer and adds it to the map.
 * The layer will be inserted right after the last TileLayer so it renders
 * between basemap tiles and vector layers.
 */
export function createImageLayer(
  name: string,
  ctx: ImageLayerContext,
  options: CreateImageLayerOptions
) {
  const { url, extent, opacity = 1 } = options;

  const uniqueId = generateUniqueId();
  const imageLayerId = `imageLayer-${uniqueId}`;

  const center = ctx.map.getView().getCenter() || fromLonLat([0, 0]);
  const newImageLayer: GeoImageLayer = new GeoImageLayer({
    source: new GeoImageSource({
      url,
      imageCenter: center,
      imageScale: [1, 1],
      imageRotate: 0,
    }),
  });

  newImageLayer.setOpacity(opacity);
  newImageLayer.set("id", imageLayerId);
  newImageLayer.set("name", name);
  
  // Store the file data for persistence
  if (options.fileData) {
    newImageLayer.set("fileData", options.fileData);
    console.log(`Created image layer ${imageLayerId} with fileData:`, {
      name,
      hasFileData: !!options.fileData,
      fileDataLength: options.fileData.length,
      fileDataStart: options.fileData.substring(0, 100)
    });
  } else {
    console.warn(`Created image layer ${imageLayerId} WITHOUT fileData:`, {
      name,
      options: Object.keys(options)
    });
  }

  imageLayers[imageLayerId] = newImageLayer;
  activeImageLayerId = imageLayerId;

  const layers = ctx.map.getLayers();
  const arr = layers.getArray();
  let insertIndex = arr.findIndex((l) => l instanceof VectorLayer);
  if (insertIndex === -1) {
    let lastTile = -1;
    arr.forEach((l, i) => {
      if (l instanceof TileLayer) lastTile = i;
    });
    insertIndex = lastTile + 1;
  }
  layers.insertAt(insertIndex, newImageLayer);

  return newImageLayer;


}

export function scaleActiveImageLayer(factor: number) {
  if (!activeImageLayerId) return;
  const layer = imageLayers[activeImageLayerId];
  if (!layer) return;
  const src = layer.getSource() as GeoImageSource | null;
  if (!src) return;
  
  // Get current map zoom level to adjust scaling
  const map = getMap();
  if (!map) return;
  const view = map.getView();
  const currentZoom = view.getZoom() || 1;
  
  // Calculate zoom-based scaling factor
  // Higher zoom levels (closer view) result in smaller scaling steps
  // Base zoom level of 3 is used as reference point
  const baseZoom = 3;
  const zoomFactor = Math.pow(0.8, currentZoom - baseZoom);
  const adjustedFactor = Math.pow(factor, zoomFactor);
  
  const current = src.getScale() as number[] | number;
  const [sx, sy] = Array.isArray(current) ? current : [current, current];
  const nx = Math.max(0.01, sx * adjustedFactor);
  const ny = Math.max(0.01, sy * adjustedFactor);
  src.setScale([nx, ny]);
  
  // Debounced auto-save after scaling
  debouncedAutoSave();
}

export function rotateActiveImageLayer(deltaDeg: number) {
  if (!activeImageLayerId) return;
  const layer = imageLayers[activeImageLayerId];
  if (!layer) return;
  const src = layer.getSource() as GeoImageSource | null;
  if (!src) return;
  
  // Get current map zoom level to adjust rotation sensitivity
  const map = getMap();
  if (!map) return;
  const view = map.getView();
  const currentZoom = view.getZoom() || 1;
  
  // Calculate zoom-based rotation factor
  // Higher zoom levels (closer view) result in smaller rotation steps
  // Base zoom level of 3 is used as reference point
  const baseZoom = 3;
  const zoomFactor = Math.pow(0.8, currentZoom - baseZoom);
  const adjustedDeltaDeg = deltaDeg * zoomFactor;
  
  const current = src.getRotation();
  const deltaRad = (adjustedDeltaDeg * Math.PI) / 180;
  src.setRotation(current + deltaRad);
  
  // Debounced auto-save after rotating
  debouncedAutoSave();
}

export function moveActiveImageLayer(deltaXMu: number, deltaYMu: number) {
  if (!activeImageLayerId) return;
  const layer = imageLayers[activeImageLayerId];
  if (!layer) return;
  const src = layer.getSource() as GeoImageSource | null;
  if (!src) return;
  const center = src.getCenter();
  if (!center) return;
  src.setCenter([center[0] + deltaXMu, center[1] + deltaYMu]);
  
  // Debounced auto-save after moving
  debouncedAutoSave();
}

export function nudgeActiveImageLayerByPixels(deltaXPx: number, deltaYPx: number) {
  const map = getMap();
  if (!map) return;
  const view = map.getView();
  const res = view.getResolution() || 1;
  const rot = view.getRotation() || 0;
  // Convert pixel deltas to map units, accounting for screen Y down and view rotation
  const dxMu = deltaXPx * res;
  const dyMuScreenUp = -deltaYPx * res;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const dx = dxMu * cos - dyMuScreenUp * sin;
  const dy = dxMu * sin + dyMuScreenUp * cos;
  moveActiveImageLayer(dx, dy);
}

export function setImageLayerOpacity(id: string, opacity: number) {
  const layer = imageLayers[id];
  if (!layer) return;
  const clamped = Math.max(0, Math.min(1, opacity));
  layer.setOpacity(clamped);
  
  // Debounced auto-save after changing opacity
  debouncedAutoSave();
}

export function setActiveImageLayerOpacity(opacity: number) {
  if (!activeImageLayerId) return;
  setImageLayerOpacity(activeImageLayerId, opacity);
}

export function getActiveImageLayerOpacity(): number | null {
  if (!activeImageLayerId) return null;
  const layer = imageLayers[activeImageLayerId];
  return layer ? layer.getOpacity() : null;
}


export function setActiveImageLayer(id: string) {
  if (imageLayers[id]) {
    activeImageLayerId = id;
  }
}

export function setImageLayerVisibility(id: string, visible: boolean) {
  const layer = imageLayers[id];
  if (!layer) return;
  layer.setVisible(visible);
  
  // Debounced auto-save after changing visibility
  debouncedAutoSave();
}

/**
 * Reorders image layers by moving a layer from one position to another
 * @param fromIndex - The current index of the layer to move
 * @param toIndex - The target index where the layer should be moved
 */
export function reorderImageLayers(fromIndex: number, toIndex: number) {
  const map = getMap();
  if (!map) return;
  
  const layers = map.getLayers();
  const layerArray = layers.getArray();
  
  // Get all image layers in their current order
  const imageLayerArray = layerArray.filter(layer => 
    Object.values(imageLayers).includes(layer as any)
  );
  
  if (fromIndex < 0 || fromIndex >= imageLayerArray.length || 
      toIndex < 0 || toIndex >= imageLayerArray.length) {
    return;
  }
  
  // Create a new array with the reordered image layers
  const reorderedImageLayers = [...imageLayerArray];
  const [movedLayer] = reorderedImageLayers.splice(fromIndex, 1);
  reorderedImageLayers.splice(toIndex, 0, movedLayer);
  
  // Remove all image layers from the map
  imageLayerArray.forEach(layer => {
    map.removeLayer(layer);
  });
  
  // Find the insertion point (after tile layers)
  let insertIndex = layerArray.findIndex((l) => l instanceof VectorLayer);
  if (insertIndex === -1) {
    let lastTile = -1;
    layerArray.forEach((l, i) => {
      if (l instanceof TileLayer) lastTile = i;
    });
    insertIndex = lastTile + 1;
  }
  
  // Re-add all image layers in the new order
  reorderedImageLayers.forEach(layer => {
    layers.insertAt(insertIndex, layer);
    insertIndex++;
  });
  
  // Debounced auto-save after reordering
  debouncedAutoSave();
}

/**
 * Store all image layers to IndexedDB
 */
export async function storeAllImageLayers() {
  console.log('Starting to store all image layers...');
  console.log('Current image layers:', imageLayers);
  
  const promises = Object.values(imageLayers).map(layer => {
    const layerId = layer.get('id');
    console.log(`Storing layer ${layerId}:`, {
      id: layer.get('id'),
      name: layer.get('name'),
      hasFileData: !!layer.get('fileData'),
      opacity: layer.getOpacity(),
      visible: layer.getVisible()
    });
    
    return storeImageLayer(layer).catch(err => {
      console.error(`Failed to store image layer ${layerId}:`, err);
      return null;
    });
  });
  
  await Promise.all(promises);
  
  // Store the current order
  const map = getMap();
  if (map) {
    const layerArray = map.getLayers().getArray();
    const imageLayerArray = layerArray.filter(layer => 
      Object.values(imageLayers).includes(layer as any)
    );
    const orderIds = imageLayerArray.map(layer => layer.get('id'));
    console.log('Storing layer order:', orderIds);
    
    await storeImageLayerOrder(orderIds).catch(err => {
      console.error('Failed to store image layer order:', err);
    });
  }
  
  console.log('Finished storing all image layers');
}

/**
 * Restore image layers from IndexedDB
 */
export async function restoreAllImageLayers(ctx: ImageLayerContext) {
  try {
    console.log('Starting image layer restoration...');
    const savedLayers = await retrieveAllImageLayers();
    const savedOrder = await retrieveImageLayerOrder();
    
    console.log('Retrieved saved layers:', savedLayers);
    console.log('Retrieved saved order:', savedOrder);
    
    // Clear existing image layers
    Object.values(imageLayers).forEach(layer => {
      ctx.map.removeLayer(layer);
    });
    imageLayers = {};
    
    // Restore layers in saved order or default order
    const layerIds = savedOrder || Object.keys(savedLayers);
    console.log('Layer IDs to restore:', layerIds);
    
    for (const id of layerIds) {
      const savedData = savedLayers[id];
      if (!savedData) {
        console.warn(`No saved data found for layer ${id}`);
        continue;
      }
      
      console.log(`Restoring layer ${id}:`, savedData);
      
      try {
        console.log(`Creating GeoImageSource for layer ${id} with:`, {
          imageDataLength: savedData.imageData?.length || 0,
          imageDataStart: savedData.imageData?.substring(0, 50) || 'none',
          center: savedData.center,
          scale: savedData.scale,
          rotation: savedData.rotation
        });
        
        // Convert base64 data back to a blob URL for GeoImageSource
        const base64Data = savedData.imageData;
        const byteCharacters = atob(base64Data.split(',')[1]); // Remove data:image/...;base64, prefix
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' }); // Default to PNG, could be made dynamic
        const blobUrl = URL.createObjectURL(blob);
        
        console.log(`Created blob URL:`, blobUrl);
        
        // Create the image layer with the blob URL
        const imageLayer = new GeoImageLayer({
          source: new GeoImageSource({
            url: blobUrl,
            imageCenter: savedData.center || [0, 0],
            imageScale: savedData.scale || [1, 1],
            imageRotate: savedData.rotation || 0,
          }),
        });
        
        // Apply transformation properties to the source after creation
        const source = imageLayer.getSource() as any;
        if (source) {
          if (savedData.scale && Array.isArray(savedData.scale)) {
            source.setScale(savedData.scale);
            console.log(`Applied scale:`, savedData.scale);
          }
          if (savedData.rotation !== undefined) {
            source.setRotation(savedData.rotation);
            console.log(`Applied rotation:`, savedData.rotation);
          }
          if (savedData.center && Array.isArray(savedData.center)) {
            source.setCenter(savedData.center);
            console.log(`Applied center:`, savedData.center);
          }
        }
        
        console.log(`Created image layer:`, imageLayer);
        console.log(`Source:`, imageLayer.getSource());
        
        // Set properties
        imageLayer.setOpacity(savedData.opacity);
        imageLayer.set("id", savedData.id);
        imageLayer.set("name", savedData.name);
        imageLayer.setVisible(savedData.visible);
        
        // Store the file data for future persistence
        imageLayer.set("fileData", savedData.imageData);
        
        // Store in our tracking object
        imageLayers[savedData.id] = imageLayer;
        
        // Add to map at the correct position
        const layers = ctx.map.getLayers();
        let insertIndex = layers.getArray().findIndex((l) => l instanceof VectorLayer);
        if (insertIndex === -1) {
          let lastTile = -1;
          layers.getArray().forEach((l, i) => {
            if (l instanceof TileLayer) lastTile = i;
          });
          insertIndex = lastTile + 1;
        }
        layers.insertAt(insertIndex, imageLayer);
        
        console.log(`Successfully restored layer ${id} and added to map at index ${insertIndex}`);
        
      } catch (err) {
        console.error(`Failed to restore image layer ${savedData.id}:`, err);
      }
    }
    
    // Set the first layer as active if any exist
    if (Object.keys(imageLayers).length > 0) {
      const firstId = Object.keys(imageLayers)[0];
      activeImageLayerId = firstId;
      console.log(`Set active layer to: ${firstId}`);
    }
    
    console.log('Image layer restoration completed. Total layers:', Object.keys(imageLayers).length);
    
  } catch (err) {
    console.error('Failed to restore image layers:', err);
  }
}

/**
 * Delete an image layer by ID and remove from persistence
 */
export async function deleteImageLayer(id: string) {
  const layer = imageLayers[id];
  if (!layer) return;
  
  // Remove from map
  const map = getMap();
  if (map) {
    map.removeLayer(layer);
  }
  
  // Remove from tracking object
  delete imageLayers[id];
  
  // Remove from persistence
  await deleteImageLayerById(id).catch(err => {
    console.error(`Failed to delete image layer ${id} from persistence:`, err);
  });
  
  // Update active layer if needed
  if (activeImageLayerId === id) {
    const remainingIds = Object.keys(imageLayers);
    activeImageLayerId = remainingIds.length > 0 ? remainingIds[0] : null;
  }
}
