import Feature from "ol/Feature";
import { Polygon, MultiPolygon, LineString, MultiLineString, Geometry } from "ol/geom";
import { getSelectInteraction } from "./mapUtils";
import { getActiveLayer } from "./vectorLayerUtils";
import { generateUniqueId } from "./mapUtils";

/**
 * Combines multiple polygon/multipolygon or linestring/multilinestring features
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

  // Filter features by type
  const polygonFeatures: Feature<Polygon | MultiPolygon>[] = [];
  const lineStringFeatures: Feature<LineString | MultiLineString>[] = [];
  
  selectedFeatures.forEach((feature: Feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      if (geometry instanceof Polygon || geometry instanceof MultiPolygon) {
        polygonFeatures.push(feature as Feature<Polygon | MultiPolygon>);
      } else if (geometry instanceof LineString || geometry instanceof MultiLineString) {
        lineStringFeatures.push(feature as Feature<LineString | MultiLineString>);
      }
    }
  });

  // Handle polygon combination
  if (polygonFeatures.length >= 2) {
    try {
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

      // Copy properties from the first feature
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

  // Handle linestring combination
  if (lineStringFeatures.length >= 2) {
    try {
      const allLineStrings: LineString[] = [];
      
      // Extract all linestrings from features (including from multilinestrings)
      lineStringFeatures.forEach(feature => {
        const geometry = feature.getGeometry()!;
        if (geometry instanceof LineString) {
          allLineStrings.push(geometry.clone());
        } else if (geometry instanceof MultiLineString) {
          // Extract individual linestrings from multilinestring
          const coordinates = geometry.getCoordinates();
          coordinates.forEach(lineCoords => {
            allLineStrings.push(new LineString(lineCoords));
          });
        }
      });

      if (allLineStrings.length < 2) {
        console.warn("Failed to extract enough linestrings for union operation");
        return false;
      }

      // Create a multilinestring containing all the linestrings
      const multiLineStringCoords = allLineStrings.map(line => line.getCoordinates());
      const combinedGeometry = new MultiLineString(multiLineStringCoords);

      // Validate the combined geometry
      if (!combinedGeometry || !combinedGeometry.getCoordinates || combinedGeometry.getCoordinates().length === 0) {
        console.error("Failed to create valid combined geometry");
        return false;
      }

      // Create a new feature with the combined geometry
      const unionFeature = new Feature({
        geometry: combinedGeometry,
      });

      // Copy properties from the first feature
      const firstFeature = lineStringFeatures[0];
      const properties = firstFeature.getProperties();
      Object.keys(properties).forEach(key => {
        if (key !== 'geometry') {
          unionFeature.set(key, properties[key]);
        }
      });

      // Set a unique ID
      unionFeature.setId("feature-" + generateUniqueId());

      // Remove the original features
      lineStringFeatures.forEach(feature => {
        vectorSource.removeFeature(feature);
      });

      // Add the union feature
      vectorSource.addFeature(unionFeature);

      // Clear selection
      select.getFeatures().clear();

      console.log(`Successfully combined ${lineStringFeatures.length} features into 1 multilinestring`);
      return true;
    } catch (error) {
      console.error("Error performing union operation:", error);
      return false;
    }
  }

  console.warn("Need at least 2 polygon/multipolygon or linestring/multilinestring features for union operation");
  return false;
}

/**
 * Checks if the selected features can be combined (all are polygons/multipolygons or linestrings/multilinestrings)
 */
export function canCombineSelectedFeatures(): boolean {
  const select = getSelectInteraction();
  if (!select) return false;

  const selectedFeatures = select.getFeatures();
  if (selectedFeatures.getLength() < 2) return false;

  let polygonCount = 0;
  let lineStringCount = 0;
  
  selectedFeatures.forEach((feature: Feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      if (geometry instanceof Polygon || geometry instanceof MultiPolygon) {
        polygonCount++;
      } else if (geometry instanceof LineString || geometry instanceof MultiLineString) {
        lineStringCount++;
      }
    }
  });

  return polygonCount >= 2 || lineStringCount >= 2;
}
