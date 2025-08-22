import { Map as OlMap } from "ol";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Feature } from "ol";
import GeoJSON from "ol/format/GeoJSON";
import { vectorLayers } from "./vectorLayerUtils";
import type TileLayer from "ol/layer/Tile";

// Type definitions for storing and retrieving vector layers
interface VectorLayerData {
  id: string;
  name: string,
  geojson: string;
}

// Type definitions for storing and retrieving map (tile) layers
interface MapLayerData {
  id: string;
  name: string;
  url: string;
  maxZoom: number;
}

// Initialize IndexedDB
const DB_VERSION = 3;

function initDB(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Ensure both stores exist after upgrade
      if (!db.objectStoreNames.contains('vectorLayers')) {
        db.createObjectStore('vectorLayers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('mapLayers')) {
        db.createObjectStore('mapLayers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('mapLayerOrder')) {
        db.createObjectStore('mapLayerOrder', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export function storeLayers() {
  for (const key in vectorLayers) {
    // Get the strongly typed value with this name:
    const value = vectorLayers[key];
    storeVectorLayer(value);
  }
  alert('Saved!');
}

// Store a vector layer in IndexedDB
async function storeVectorLayer(
  vectorLayer: VectorLayer<VectorSource>,
  dbName: string = "myMapDB",
  storeName: string = "vectorLayers",
): Promise<string> {
  const db = await initDB(dbName, storeName);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    const vectorSource = vectorLayer.getSource();
    if (!vectorSource) {
      reject("Vector layer source is undefined");
      return;
    }

    const features: Feature[] = vectorSource.getFeatures();
    const geojsonFormat = new GeoJSON();
    // Write as object so we can normalize null properties to {}
    const geojsonObj: any = geojsonFormat.writeFeaturesObject(features, {
      featureProjection: "EPSG:3857",
      dataProjection: "EPSG:4326",
    });
    if (geojsonObj && Array.isArray(geojsonObj.features)) {
      for (const f of geojsonObj.features) {
        if (f && (f as any).properties == null) {
          (f as any).properties = {};
        }
      }
    }
    const geojson = JSON.stringify(geojsonObj);

    const data: VectorLayerData = {
      id: vectorLayer.get('id'),
      name: vectorLayer.get('name'),
      geojson: geojson,
    };

    const request = store.put(data);

    request.onsuccess = () => {
      resolve("Vector layer stored successfully");
    };

    request.onerror = (event) => {
      reject((event.target as IDBRequest).error);
    };
  });
}

// Retrieve all vector layers as an object where each key is the layer ID
export async function retrieveAllVectorLayers(
    dbName: string = 'myMapDB',
    storeName: string = 'vectorLayers'
): Promise<{ [id: string]: { layer: VectorLayer<VectorSource>, name: string } }> {
    const db = await initDB(dbName, storeName);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        const request = store.getAll();

        request.onsuccess = (event) => {
            const results = (event.target as IDBRequest<VectorLayerData[]>).result;

            if (results.length > 0) {
                const geojsonFormat = new GeoJSON();
                const vectorLayers: { [id: string]: { layer: VectorLayer<VectorSource>, name: string } } = {};

                results.forEach((data) => {
                    const features = geojsonFormat.readFeatures(data.geojson, {
                        featureProjection: 'EPSG:3857',
                        dataProjection: 'EPSG:4326'
                    });

                    const vectorSource = new VectorSource({
                        features: features
                    });

                    // Create the vector layer and set its name
                    const vectorLayer = new VectorLayer({
                        source: vectorSource
                    });

                    vectorLayer.set('name', data.name); // Set the name on the layer

                    // Store the layer along with its name in the object
                    vectorLayers[data.id] = {
                        layer: vectorLayer,
                        name: data.name
                    };
                });

                resolve(vectorLayers);
            } else {
                reject('No vector layers found in the database');
            }
        };

        request.onerror = (event) => {
            reject((event.target as IDBRequest).error);
        };
    });
}

export async function deleteVectorLayerById(
    layerId: string,
    dbName: string = 'myMapDB',
    storeName: string = 'vectorLayers'
): Promise<string> {
    const db = await initDB(dbName, storeName);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        const request = store.delete(layerId);

        request.onsuccess = () => {
            resolve(`Layer with ID ${layerId} deleted successfully`);
        };

        request.onerror = (event) => {
            reject((event.target as IDBRequest).error);
        };
    });
}

// Store a tile map layer in IndexedDB
export async function storeMapLayer(
  tileLayer: TileLayer,
  dbName: string = "myMapDB",
  storeName: string = "mapLayers"
): Promise<string> {
  const db = await initDB(dbName, storeName);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    const id = tileLayer.get("id");
    const name = tileLayer.get("name") ?? id;
    const url = tileLayer.get("xyzUrl") ?? "";
    const maxZoom = tileLayer.get("maxZoom") ?? 18;

    const data: MapLayerData = { id, name, url, maxZoom } as MapLayerData;

    const request = store.put(data);

    request.onsuccess = () => resolve("Map layer stored successfully");
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

// Retrieve all map layers metadata (to be reconstructed by utils)
export async function retrieveAllMapLayers(
  dbName: string = 'myMapDB',
  storeName: string = 'mapLayers'
): Promise<{ [id: string]: MapLayerData }> {
  const db = await initDB(dbName, storeName);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    const request = store.getAll();

    request.onsuccess = (event) => {
      const results = (event.target as IDBRequest<MapLayerData[]>).result;
      const out: { [id: string]: MapLayerData } = {};
      results.forEach((item) => {
        out[item.id] = item;
      });
      resolve(out);
    };

    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

export async function deleteMapLayerById(
  layerId: string,
  dbName: string = 'myMapDB',
  storeName: string = 'mapLayers'
): Promise<string> {
  const db = await initDB(dbName, storeName);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);

    const request = store.delete(layerId);

    request.onsuccess = () => resolve(`Map layer with ID ${layerId} deleted successfully`);
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

// Persist and retrieve map layer order
export async function storeMapLayerOrder(
  orderIds: string[],
  dbName: string = 'myMapDB',
  storeName: string = 'mapLayerOrder'
): Promise<void> {
  const db = await initDB(dbName, storeName);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put({ id: 'order', order: orderIds });
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}

export async function retrieveMapLayerOrder(
  dbName: string = 'myMapDB',
  storeName: string = 'mapLayerOrder'
): Promise<string[] | null> {
  const db = await initDB(dbName, storeName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get('order');
    req.onsuccess = (e) => {
      const val = (e.target as IDBRequest<any>).result;
      resolve(val ? (val.order as string[]) : null);
    };
    req.onerror = (e) => reject((e.target as IDBRequest).error);
  });
}