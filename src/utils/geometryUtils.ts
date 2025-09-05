import Feature from "ol/Feature";
import { Polygon, MultiPolygon, Geometry } from "ol/geom";
import { getSelectInteraction } from "./mapUtils";
import { getActiveLayer } from "./vectorLayerUtils";
import { generateUniqueId } from "./mapUtils";

/**
 * Combines multiple polygon/multipolygon features using UNION operation
 * This function takes selected features and creates a single combined feature
 */
export function unionSelectedFeatures(): boolean {
  const select = getSelectInteraction();
  if (!select) {
    console.warn("No select interaction available");
    return false;
  }

  const selectedFeatures = select.getFeatures();
  if (selectedFeatures.getLength() < 2) {
    console.warn("Need at least 2 features selected for union operation");
    return false;
  }

  const activeLayer = getActiveLayer();
  if (!activeLayer) {
    console.warn("No active layer available");
    return false;
  }

  const vectorSource = activeLayer.getSource();
  if (!vectorSource) {
    console.warn("No vector source available");
    return false;
  }

  // Filter to only polygon/multipolygon features
  const polygonFeatures: Feature<Polygon | MultiPolygon>[] = [];
  selectedFeatures.forEach((feature: Feature) => {
    const geometry = feature.getGeometry();
    if (geometry && (geometry instanceof Polygon || geometry instanceof MultiPolygon)) {
      polygonFeatures.push(feature as Feature<Polygon | MultiPolygon>);
    }
  });

  if (polygonFeatures.length < 2) {
    console.warn("Need at least 2 polygon/multipolygon features for union operation");
    return false;
  }

  try {
    // For now, we'll create a multipolygon that contains all the selected polygons
    // This is a simplified approach - true geometric union would require more complex operations
    
    const allPolygons: Polygon[] = [];
    
    // Extract all polygons from features (including from multipolygons)
    polygonFeatures.forEach(feature => {
      const geometry = feature.getGeometry()!;
      if (geometry instanceof Polygon) {
        allPolygons.push(geometry.clone());
      } else if (geometry instanceof MultiPolygon) {
        // Extract individual polygons from multipolygon
        const coordinates = geometry.getCoordinates();
        coordinates.forEach(polyCoords => {
          allPolygons.push(new Polygon(polyCoords));
        });
      }
    });

    if (allPolygons.length < 2) {
      console.warn("Failed to extract enough polygons for union operation");
      return false;
    }

    // Create a multipolygon containing all the polygons
    const multiPolygonCoords = allPolygons.map(poly => poly.getCoordinates());
    const combinedGeometry = new MultiPolygon(multiPolygonCoords);

    // Validate the combined geometry
    if (!combinedGeometry || !combinedGeometry.getCoordinates || combinedGeometry.getCoordinates().length === 0) {
      console.error("Failed to create valid combined geometry");
      return false;
    }

    // Create a new feature with the combined geometry
    const unionFeature = new Feature({
      geometry: combinedGeometry,
    });

    // Copy properties from the first feature (you might want to merge properties instead)
    const firstFeature = polygonFeatures[0];
    const properties = firstFeature.getProperties();
    Object.keys(properties).forEach(key => {
      if (key !== 'geometry') {
        unionFeature.set(key, properties[key]);
      }
    });

    // Set a unique ID
    unionFeature.setId("feature-" + generateUniqueId());

    // Remove the original features
    polygonFeatures.forEach(feature => {
      vectorSource.removeFeature(feature);
    });

    // Add the union feature
    vectorSource.addFeature(unionFeature);

    // Clear selection
    select.getFeatures().clear();

    console.log(`Successfully combined ${polygonFeatures.length} features into 1 multipolygon`);
    return true;
  } catch (error) {
    console.error("Error performing union operation:", error);
    return false;
  }
}

/**
 * Checks if the selected features can be combined (all are polygons/multipolygons)
 */
export function canCombineSelectedFeatures(): boolean {
  const select = getSelectInteraction();
  if (!select) return false;

  const selectedFeatures = select.getFeatures();
  if (selectedFeatures.getLength() < 2) return false;

  let polygonCount = 0;
  selectedFeatures.forEach((feature: Feature) => {
    const geometry = feature.getGeometry();
    if (geometry && (geometry instanceof Polygon || geometry instanceof MultiPolygon)) {
      polygonCount++;
    }
  });

  return polygonCount >= 2;
}
