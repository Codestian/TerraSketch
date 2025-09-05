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
  elevation?: number;
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
      console.log('Raw GeoJSON data:', geoJsonData.substring(0, 500) + '...');
      
      const format = new GeoJSON();
      const features = format.readFeatures(geoJsonData, {
        featureProjection: ctx.map.getView().getProjection(),
      });

      const { block, elevation = 0 } = options;
      
      console.log('Importing GeoJSON with options:', { block, elevation });
      console.log('Number of features to process:', features.length);
      console.log('Map projection:', ctx.map.getView().getProjection().getCode());

      features.forEach((feature: Feature, index: number) => {
        feature.set("block", block);
        
        // Apply elevation to 2D coordinates if elevation is provided
        if (elevation !== 0) {
          const geometry = feature.getGeometry();
          if (geometry) {
            console.log(`Feature ${index}: Geometry type: ${geometry.getType()}`);
            console.log(`Feature ${index}: Geometry extent:`, geometry.getExtent());
            
            try {
              // For Point geometry
              if (geometry.getType() === 'Point') {
                const pointGeom = geometry as any;
                const coords = pointGeom.getCoordinates();
                console.log(`Feature ${index}: Point coordinates before:`, coords);
                console.log(`Feature ${index}: Point coordinates length:`, coords ? coords.length : 'undefined');
                if (coords && coords.length === 2) {
                  const newCoords = [coords[0], coords[1], elevation];
                  pointGeom.setCoordinates(newCoords);
                  console.log(`Feature ${index}: Point coordinates after elevation:`, newCoords);
                } else if (coords && coords.length === 3) {
                  console.log(`Feature ${index}: Point already has 3D coordinates:`, coords);
                }
              }
              // For LineString geometry
              else if (geometry.getType() === 'LineString') {
                const lineGeom = geometry as any;
                const coords = lineGeom.getCoordinates();
                console.log(`Feature ${index}: LineString coordinates before:`, coords);
                if (coords && coords.length > 0) {
                  console.log(`Feature ${index}: First coord length:`, coords[0] ? coords[0].length : 'undefined');
                  if (coords[0].length === 2) {
                    const newCoords = coords.map((coord: any) => [coord[0], coord[1], elevation]);
                    lineGeom.setCoordinates(newCoords);
                    console.log(`Feature ${index}: LineString coordinates after elevation:`, newCoords);
                  } else if (coords[0].length === 3) {
                    console.log(`Feature ${index}: LineString already has 3D coordinates`);
                  }
                }
              }
              // For Polygon geometry
              else if (geometry.getType() === 'Polygon') {
                const polyGeom = geometry as any;
                const coords = polyGeom.getCoordinates();
                console.log(`Feature ${index}: Polygon coordinates before:`, coords);
                if (coords && coords.length > 0 && coords[0].length > 0) {
                  console.log(`Feature ${index}: First ring first coord length:`, coords[0][0] ? coords[0][0].length : 'undefined');
                  if (coords[0][0].length === 2) {
                    const newCoords = coords.map((ring: any) => 
                      ring.map((coord: any) => [coord[0], coord[1], elevation])
                    );
                    polyGeom.setCoordinates(newCoords);
                    console.log(`Feature ${index}: Polygon coordinates after elevation:`, newCoords);
                  } else if (coords[0][0].length === 3) {
                    console.log(`Feature ${index}: Polygon already has 3D coordinates`);
                  }
                }
              }
              // For MultiPolygon geometry
              else if (geometry.getType() === 'MultiPolygon') {
                const multiPolyGeom = geometry as any;
                const coords = multiPolyGeom.getCoordinates();
                console.log(`Feature ${index}: MultiPolygon coordinates before:`, coords);
                if (coords && coords.length > 0 && coords[0].length > 0 && coords[0][0].length > 0) {
                  console.log(`Feature ${index}: First polygon first ring first coord length:`, coords[0][0][0] ? coords[0][0][0].length : 'undefined');
                  if (coords[0][0][0].length === 2) {
                    const newCoords = coords.map((polygon: any) => 
                      polygon.map((ring: any) => 
                        ring.map((coord: any) => [coord[0], coord[1], elevation])
                      )
                    );
                    multiPolyGeom.setCoordinates(newCoords);
                    console.log(`Feature ${index}: MultiPolygon coordinates after elevation:`, newCoords);
                  } else if (coords[0][0][0].length === 3) {
                    console.log(`Feature ${index}: MultiPolygon already has 3D coordinates`);
                  }
                }
              }
            } catch (error) {
              console.warn(`Error applying elevation to feature ${index}:`, error);
            }
          } else {
            console.log(`Feature ${index}: No geometry found`);
          }
        } else {
          console.log(`Feature ${index}: No elevation to apply (elevation = ${elevation})`);
        }
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

      console.log('Import completed successfully');
      resolve();
    };

    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}


