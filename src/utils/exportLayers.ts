import { transform } from "ol/proj";
import pako from "pako";
import { writeUncompressed, type NBT, TagType } from "prismarine-nbt";
import type { FeatureExport } from "./iFeatureExprt";
import { fromGeo } from "@bte-germany/terraconvert";



/**
 * Transforms coordinates from one spatial reference system to another.
 * @param flatCoords - Flat array of coordinates.
 * @param sourceProj - Source projection system. Default is "EPSG:3857".
 * @param destProj - Destination projection system. Default is "EPSG:4326".
 * @param stride - Number of elements per coordinate. Default is 2.
 * @returns An array of transformed coordinates in Latitude/Longitude order.
 */
export function transformToLatLng(
  flatCoords: number[],
  sourceProj: string = "EPSG:3857",
  destProj: string = "EPSG:4326",
  stride: number = 2
): [number, number][] {
  const coordinatePairs = getCoordinatePairs(flatCoords, stride);
  return coordinatePairs.map((coord) => {
    const [longitude, latitude] = transform(coord, sourceProj, destProj);
    const coords = fromGeo(latitude, longitude);
    return [Math.round(coords[0]), Math.round(coords[1])];
  });
}

/**
 * Converts a flat array of coordinates into an array of coordinate pairs.
 * @param flatCoords - Flat array of coordinates.
 * @param stride - Number of elements representing a single coordinate. Default is 2.
 * @returns An array of coordinate pairs.
 */
function getCoordinatePairs(
  flatCoords: number[],
  stride: number = 2
): [number, number][] {
  const coordinates: [number, number][] = [];
  for (let i = 0; i < flatCoords.length; i += stride) {
    coordinates.push([flatCoords[i], flatCoords[i + 1]]);
  }
  return coordinates;
}

/**
 * Generates vertices for a circle given its center and a point on its circumference.
 * @param points - Array containing two points: the center and a point on the circumference.
 * @param numberOfSides - Number of vertices to approximate the circle.
 * @returns An array of vertices representing the circle.
 */
export function generateCircleVertices(
  points: [[number, number], [number, number]],
  numberOfSides: number
): [number, number][] {
  const [centerX, centerY] = points[0];
  const [circumferenceX, circumferenceY] = points[1];

  // Calculate the radius as the distance between the center and the circumference point
  const dx = circumferenceX - centerX;
  const dy = circumferenceY - centerY;
  const radius = Math.sqrt(dx * dx + dy * dy);

  const vertices: [number, number][] = [];

  for (let i = 0; i < numberOfSides; i++) {
    const angle = (i * 2 * Math.PI) / numberOfSides; // Calculate angle for each vertex
    const x = centerX + radius * Math.cos(angle); // Calculate x coordinate
    const y = centerY + radius * Math.sin(angle); // Calculate y coordinate
    vertices.push([x, y]);
  }

  return vertices;
}

// Define the type for a block as a number
type BlockID = number;



export function getDimensions(features: FeatureExport[]) {
  const xCoordinates = features.flatMap((feature) =>
    feature.coords.map((coord) => coord[0])
  );
  const zCoordinates = features.flatMap((feature) =>
    feature.coords.map((coord) => coord[1])
  );

  // Find the minimum and maximum X values
  const minX = xCoordinates.reduce((min, val) => Math.min(min, val), Infinity);
  const maxX = xCoordinates.reduce((max, val) => Math.max(max, val), -Infinity);
  const minZ = zCoordinates.reduce((min, val) => Math.min(min, val), Infinity);
  const maxZ = zCoordinates.reduce((max, val) => Math.max(max, val), -Infinity);

  // Set default height since elevation is no longer used
  const minY = 0;
  const maxY = 0;

  const length = maxX - minX;
  const width = maxZ - minZ;
  const height = 1; // Fixed height since elevation is removed

  return { length, height, width };
}

/**
 * Bresenham line algorithm for 2D coordinates
 * @param x1 - Starting x coordinate
 * @param y1 - Starting y coordinate
 * @param x2 - Ending x coordinate
 * @param y2 - Ending y coordinate
 * @returns Array of [x, y] coordinate pairs representing the line
 */
export function bresenhamLine(x1: number, y1: number, x2: number, y2: number): [number, number][] {
  const points: [number, number][] = [];
  
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  
  let err = dx - dy;
  let x = x1;
  let y = y1;
  
  while (true) {
    points.push([x, y]);
    
    if (x === x2 && y === y2) break;
    
    const e2 = 2 * err;
    
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  
  return points;
}

/**
 * 3D Bresenham line algorithm for coordinates with elevation
 * @param x1 - Starting x coordinate
 * @param y1 - Starting y coordinate (elevation)
 * @param z1 - Starting z coordinate
 * @param x2 - Ending x coordinate
 * @param y2 - Ending y coordinate (elevation)
 * @param z2 - Ending z coordinate
 * @returns Array of [x, y, z] coordinate triplets representing the line
 */
export function bresenhamLine3D(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): [number, number, number][] {
  const points: [number, number, number][] = [];
  
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const dz = Math.abs(z2 - z1);
  
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  const sz = z1 < z2 ? 1 : -1;
  
  let x = x1;
  let y = y1;
  let z = z1;
  
  // Determine which axis has the largest difference
  if (dx >= dy && dx >= dz) {
    // X is the driving axis
    let err1 = 2 * dy - dx;
    let err2 = 2 * dz - dx;
    
    for (let i = 0; i <= dx; i++) {
      points.push([x, y, z]);
      
      if (err1 > 0) {
        y += sy;
        err1 -= 2 * dx;
      }
      
      if (err2 > 0) {
        z += sz;
        err2 -= 2 * dx;
      }
      
      err1 += 2 * dy;
      err2 += 2 * dz;
      x += sx;
    }
  } else if (dy >= dx && dy >= dz) {
    // Y is the driving axis
    let err1 = 2 * dx - dy;
    let err2 = 2 * dz - dy;
    
    for (let i = 0; i <= dy; i++) {
      points.push([x, y, z]);
      
      if (err1 > 0) {
        x += sx;
        err1 -= 2 * dy;
      }
      
      if (err2 > 0) {
        z += sz;
        err2 -= 2 * dy;
      }
      
      err1 += 2 * dx;
      err2 += 2 * dz;
      y += sy;
    }
  } else {
    // Z is the driving axis
    let err1 = 2 * dx - dz;
    let err2 = 2 * dy - dz;
    
    for (let i = 0; i <= dz; i++) {
      points.push([x, y, z]);
      
      if (err1 > 0) {
        x += sx;
        err1 -= 2 * dz;
      }
      
      if (err2 > 0) {
        y += sy;
        err2 -= 2 * dz;
      }
      
      err1 += 2 * dx;
      err2 += 2 * dy;
      z += sz;
    }
  }
  
  return points;
}

export async function saveGeoJsonFile(jsonString: string, filename: string = 'export.geojson') {
  // Parse the JSON string
  const jsonObject = JSON.parse(jsonString);

  // Convert the JSON object to a Blob
  const blob = new Blob([JSON.stringify(jsonObject, null, 2)], { type: 'application/geo+json' });

  // Use the traditional download method for immediate download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename; // Use the provided filename
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(link.href);
}

export async function saveKmlFile(jsonString: string, filename: string = 'export.kml') {
  try {
    // Parse the JSON string to get the GeoJSON object
    const geojsonObject = JSON.parse(jsonString);

    // Convert GeoJSON to KML using custom function
    const kmlString = convertGeoJSONToKML(geojsonObject);

    // Create a Blob with the KML content
    const blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml' });

    // Use the traditional download method for immediate download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(link.href);

  } catch (error) {
    console.error('Error converting to KML:', error);
    throw new Error('Failed to convert GeoJSON to KML format');
  }
}

/**
 * Converts GeoJSON features to FeatureExport format
 * @param geojsonObject - GeoJSON object containing features
 * @returns Array of FeatureExport objects
 */
export function convertGeoJSONToFeatureExport(geojsonObject: any): FeatureExport[] {
  const featureExports: FeatureExport[] = [];

  if (!geojsonObject || !geojsonObject.features || !Array.isArray(geojsonObject.features)) {
    return featureExports;
  }

  for (const feature of geojsonObject.features) {
    if (!feature || !feature.geometry) continue;

    const geometryType = feature.geometry.type;
    const coordinates = feature.geometry.coordinates;
    const properties = feature.properties || {};

    // Extract shape type from geometry
    let shape: string;
    switch (geometryType) {
      case 'Point':
        shape = 'point';
        break;
      case 'LineString':
        shape = 'line';
        break;
      case 'Polygon':
        shape = 'polygon';
        break;
      case 'MultiPolygon':
        shape = 'multipolygon';
        break;
      default:
        shape = geometryType.toLowerCase();
    }

    // Extract coordinates based on geometry type
    let coords: [number, number, number][] = [];

    // Helper function to convert 2D or 3D coordinates to 3D with elevation using fromGeo transformation
    const convertTo3DCoords = (coord: number[]): [number, number, number] => {
      const lng = coord[0];  // First value is longitude
      const lat = coord[1];  // Second value is latitude
      const elevation = coord.length > 2 ? coord[2] : (properties.elevation || properties.height || 0);

      // Transform lng/lat to the target coordinate system using fromGeo
      // fromGeo expects (lat, lng) as separate parameters
      const [x, z] = fromGeo(lat, lng);

      return [Math.round(x), elevation, Math.round(z)];
    };

    if (geometryType === 'Point') {
      // Point: coordinates = [lon, lat] or [lon, lat, elevation]
      coords = [convertTo3DCoords(coordinates)];
    } else if (geometryType === 'LineString') {
      // LineString: coordinates = [[lon1, lat1], [lon2, lat2], ...] or [[lon1, lat1, elevation1], ...]
      coords = coordinates.map(convertTo3DCoords);
    } else if (geometryType === 'Polygon') {
      // Polygon: coordinates = [[[lon1, lat1], [lon2, lat2], ...]] or [[[lon1, lat1, elevation1], ...]]
      // Process exterior ring and interior rings (holes) separately
      const exteriorRing = coordinates[0];
      const interiorRings = coordinates.slice(1); // All rings after the first are holes
      
      // Convert exterior ring
      const exteriorCoords = exteriorRing.map(convertTo3DCoords);
      
      // Extract height, block, and innerBlock from properties, with defaults
      const height = properties.height || properties.elevation || 0;
      const block = properties.block || properties.material || 'stone';
      const innerBlock = properties.innerBlock || 'dirt';
      
      // Add exterior polygon
      featureExports.push({
        shape: 'polygon',
        coords: exteriorCoords,
        height,
        block,
        innerBlock
      });
      
      // Add interior rings as "hole" polygons (these will be filled with air)
      for (const interiorRing of interiorRings) {
        const interiorCoords = interiorRing.map(convertTo3DCoords);
        featureExports.push({
          shape: 'polygon_hole', // Special shape for holes
          coords: interiorCoords,
          height,
          block: 'air', // Holes are filled with air
          innerBlock: 'air'
        });
      }
      
      continue; // Skip the general processing below since we handled Polygon specially
    } else if (geometryType === 'MultiPolygon') {
      // MultiPolygon: coordinates = [[[[lon1, lat1], [lon2, lat2], ...]], ...] or [[[[lon1, lat1, elevation1], ...]], ...]
      // Process each polygon separately
      for (const polygon of coordinates) {
        if (polygon && polygon.length > 0) {
          // Take the first ring (exterior ring) of each polygon
          const exteriorRing = polygon[0];
          const polygonCoords = exteriorRing.map(convertTo3DCoords);

          // Extract height, block, and innerBlock from properties, with defaults
          const height = properties.height || properties.elevation || 0;
          const block = properties.block || properties.material || 'stone';
          const innerBlock = properties.innerBlock || 'dirt';

          featureExports.push({
            shape: 'polygon', // Each individual polygon is treated as a polygon
            coords: polygonCoords,
            height,
            block,
            innerBlock
          });
        }
      }
      continue; // Skip the general processing below since we handled MultiPolygon specially
    }

    // Extract height, block, and innerBlock from properties, with defaults
    const height = properties.height || properties.elevation || 0;
    const block = properties.block || properties.material || 'stone';
    const innerBlock = properties.innerBlock || 'dirt';

    featureExports.push({
      shape,
      coords,
      height,
      block,
      innerBlock
    });
  }

  return featureExports;
}

/**
 * Simple polygon filling using point-in-polygon test
 * @param coords - Array of 3D coordinates representing the polygon
 * @param blockId - Block ID to fill with
 * @param grid - 3D grid array to fill
 * @param skipNonZero - If true, skip points that are already filled (not 0)
 * @param targetY - Specific Y level to fill at (if not provided, fills at all Y levels)
 */
function fillPolygonSimple(
  coords: [number, number, number][], 
  blockId: BlockID, 
  grid: BlockID[][][],
  skipNonZero: boolean = false,
  targetY?: number
): void {
  if (coords.length < 3) return;
  
  // Get 2D coordinates for polygon filling
  const polygon2D = coords.map(([x, y, z]) => [x, z] as [number, number]);
  
  // Find bounding box
  const minX = Math.min(...polygon2D.map(([x]) => x));
  const maxX = Math.max(...polygon2D.map(([x]) => x));
  const minZ = Math.min(...polygon2D.map(([, z]) => z));
  const maxZ = Math.max(...polygon2D.map(([, z]) => z));
  
  // Check every point in the bounding box
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      if (isPointInPolygonSimple(x, z, polygon2D)) {
        if (targetY !== undefined) {
          // Fill only at the specific Y level
          if (grid[targetY] && grid[targetY][z] && grid[targetY][z][x] !== undefined) {
            // Skip if skipNonZero is true and the point is already filled (not air)
            if (skipNonZero && grid[targetY][z][x] !== 0) {
              continue;
            }
            grid[targetY][z][x] = blockId;
          }
        } else {
          // Fill at all Y levels (original behavior)
          for (let y = 0; y < grid.length; y++) {
            if (grid[y] && grid[y][z] && grid[y][z][x] !== undefined) {
              // Skip if skipNonZero is true and the point is already filled (not air)
              if (skipNonZero && grid[y][z][x] !== 0) {
                continue;
              }
              grid[y][z][x] = blockId;
            }
          }
        }
      }
    }
  }
}

/**
 * Simple point-in-polygon test using ray casting
 * @param x - X coordinate of the point
 * @param z - Z coordinate of the point
 * @param polygon - Array of [x, z] coordinates representing the polygon
 * @returns true if the point is inside the polygon
 */
function isPointInPolygonSimple(x: number, z: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export async function saveSchematicFile(features: FeatureExport[], versionNo: number, filename: string = 'terrasedit', fillPolygons: boolean, offsetX: number, offsetZ: number) {


  const xCoordinates = features.flatMap((feature) =>
    feature.coords.map((coord) => coord[0])
  );
  const yCoordinates = features.flatMap((feature) =>
    feature.coords.map((coord) => coord[1])
  );
  const zCoordinates = features.flatMap((feature) =>
    feature.coords.map((coord) => coord[2])
  );

  // Find the minimum and maximum X values
  const minX = xCoordinates.reduce((min, val) => Math.min(min, val), Infinity);
  const maxX = xCoordinates.reduce((max, val) => Math.max(max, val), -Infinity);
  const minY = yCoordinates.reduce((min, val) => Math.min(min, val), Infinity);
  const maxY = yCoordinates.reduce((max, val) => Math.max(max, val), -Infinity);
  const minZ = zCoordinates.reduce((min, val) => Math.min(min, val), Infinity);
  const maxZ = zCoordinates.reduce((max, val) => Math.max(max, val), -Infinity);


  const length = maxX - minX;
  const height = maxY - minY;
  const width = maxZ - minZ;

  // Transform the coordinates to the new coordinate system
  const transformedFeatures = features.map((feature) => ({
    ...feature,
    coords: feature.coords.map(([x, y, z]) => [x - minX, y - minY, z - minZ]),
  }));

  // Create a palette based on the 'block' and 'innerBlock' keys from features
  const palette: Record<string, { type: TagType.Int; value: number }> = {
    "minecraft:air": { type: TagType.Int, value: 0 },
    "minecraft:redstone_block": { type: TagType.Int, value: 1 }, // For hole outlines
  };
  const blockSet = new Set<string>();
  for (const feature of features) {
    blockSet.add("minecraft:" + feature.block);
    blockSet.add("minecraft:" + feature.innerBlock);
  }
  // Assign indices to each block type
  let nextIndex = 1; // Start after air
  for (const block of blockSet) {
    if (!palette[block]) {
      palette[block] = { type: TagType.Int, value: nextIndex++ };
    }
  }
  const paletteMax = Object.keys(palette).length;

  // Initialize the 3D array with 0 (representing minecraft:air)
  const grid: BlockID[][][] = Array.from({ length: height + 1 }, () =>
    Array.from({ length: width + 1 }, () =>
      Array.from({ length: length + 1 }, () => 0)
    )
  );

  // Loop through each feature and add the blocks to the grid
  for (const feature of transformedFeatures) {
    const blockId = palette["minecraft:" + feature.block].value;
    const innerBlockId = palette["minecraft:" + feature.innerBlock].value;

    if (feature.shape === 'polygon' || feature.shape === 'multipolygon') {
      // Draw the outline by connecting all consecutive points
      for (let index = 0; index < feature.coords.length; index++) {
        const coord = feature.coords[index];
        const nextCoord = feature.coords[(index + 1) % feature.coords.length]; // Wrap around to first point
        const line = bresenhamLine3D(coord[0], coord[1], coord[2], nextCoord[0], nextCoord[1], nextCoord[2]);
        line.forEach(([x, y, z]) => {
          grid[y][z][x] = blockId;
        });
      }
      
      // Fill the interior only if fillPolygons is true
      if (fillPolygons) {
        // Get the Y level from the first coordinate of the feature
        const targetY = feature.coords[0][1];
        fillPolygonSimple(feature.coords as [number, number, number][], innerBlockId, grid, true, targetY);
      }
    } else if (feature.shape === 'polygon_hole') {
      // Draw the outline for holes (using redstone block for visibility)
      const holeOutlineBlockId = palette["minecraft:redstone_block"].value;
      for (let index = 0; index < feature.coords.length; index++) {
        const coord = feature.coords[index];
        const nextCoord = feature.coords[(index + 1) % feature.coords.length]; // Wrap around to first point
        const line = bresenhamLine3D(coord[0], coord[1], coord[2], nextCoord[0], nextCoord[1], nextCoord[2]);
        line.forEach(([x, y, z]) => {
          grid[y][z][x] = holeOutlineBlockId; // Use redstone block for hole outlines
        });
      }
      
      // Fill the interior with air (0) to create empty space only if fillPolygons is true
      if (fillPolygons) {
        // Get the Y level from the first coordinate of the feature
        const targetY = feature.coords[0][1];
        fillPolygonSimple(feature.coords as [number, number, number][], 0, grid, false, targetY);
      }
    } else {
      // For lines and points, just draw the outline as before
      for (let index = 0; index < feature.coords.length; index++) {
        const coord = feature.coords[index];
        if (index < feature.coords.length - 1) {
          const nextCoord = feature.coords[index + 1];
          const line = bresenhamLine3D(coord[0], coord[1], coord[2], nextCoord[0], nextCoord[1], nextCoord[2]);
          line.forEach(([x, y, z]) => {
            grid[y][z][x] = blockId;
          });
        }
      }
    }
  }

  console.log("Grid:", JSON.parse(JSON.stringify(grid)));

  //create blockData
  const blockData: Uint8Array = new Uint8Array(grid.flat().flat());

  // Build the schematic object with dynamic width, height, and length
  const schematic: NBT = {
    type: TagType.Compound,
    name: "Schematic",
    value: {
      DataVersion: { type: TagType.Int, value: 3700 },
      Version: { type: TagType.Int, value: versionNo },
      Width: { type: TagType.Short, value: length + 1 },
      Height: { type: TagType.Short, value: height + 1 },
      Length: { type: TagType.Short, value: width + 1 },
      PaletteMax: { type: TagType.Int, value: paletteMax },
      Palette: { type: TagType.Compound, value: palette },
      BlockData: { type: TagType.ByteArray, value: Array.from(blockData) },
      BlockEntities: {
        type: TagType.List,
        value: { type: TagType.Compound, value: [] },
      },
      Entities: {
        type: TagType.List,
        value: { type: TagType.Compound, value: [] },
      },
      Metadata: { type: TagType.Compound, value: {} },
      Offset: {
        type: TagType.IntArray,
        value: [Math.ceil(minX) + offsetX, Math.ceil(minY), Math.ceil(minZ) + offsetZ],
      },
    },
  };

    // Write the NBT data to a Buffer
    const nbtBuffer = writeUncompressed(schematic);

    // Convert Buffer to Uint8Array for pako compatibility
    const nbtUint8Array = new Uint8Array(nbtBuffer);

    // Compress the NBT data using pako
    const compressed = pako.gzip(nbtUint8Array);
  
    // Create a Blob from the compressed data
    const blob = new Blob([compressed], { type: "application/octet-stream" });
  
    // Create a link to download the Blob as a .schem file
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.schem`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// Custom function to convert GeoJSON to KML
export function convertGeoJSONToKML(geojson: any): string {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Exported from TerraSketch</name>
    <description>Layer exported from TerraSketch application</description>`;

  if (geojson.features && Array.isArray(geojson.features)) {
    geojson.features.forEach((feature: any, index: number) => {
      const properties = feature.properties || {};
      const name = properties.name || `Feature ${index + 1}`;
      const description = properties.description || '';

      kml += `
    <Placemark>
      <name>${escapeXml(name)}</name>
      <description>${escapeXml(description)}</description>`;

      if (feature.geometry) {
        kml += convertGeometryToKML(feature.geometry);
      }

      kml += `
    </Placemark>`;
    });
  }

  kml += `
  </Document>
</kml>`;

  return kml;
}

// Helper function to convert geometry to KML
function convertGeometryToKML(geometry: any): string {
  const { type, coordinates } = geometry;

  switch (type) {
    case 'Point':
      return `
      <Point>
        <coordinates>${coordinates[0]},${coordinates[1]}</coordinates>
      </Point>`;

    case 'LineString':
      const lineCoords = coordinates.map((coord: number[]) => `${coord[0]},${coord[1]}`).join(' ');
      return `
      <LineString>
        <coordinates>${lineCoords}</coordinates>
      </LineString>`;

    case 'Polygon':
      const polygonCoords = coordinates[0].map((coord: number[]) => `${coord[0]},${coord[1]}`).join(' ');
      return `
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${polygonCoords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>`;

    default:
      return `
      <Point>
        <coordinates>0,0</coordinates>
      </Point>`;
  }
}

// Helper function to escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

