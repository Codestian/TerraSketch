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

export function createSchematic(
  features: FeatureExport[],
  versionNo: number,
  isOffsetEnabled: boolean,
): void {
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

  // Extract all elevation values (both start and end)
  const elevations = features.flatMap((feature) => [
    feature.elevationStart,
    feature.elevationEnd,
  ]);

  // Calculate the minimum and maximum elevation values
  const minY = Math.min(...elevations);
  const maxY = Math.max(...elevations);

  const length = maxX - minX;
  const width = maxZ - minZ;
  const height = maxY - minY;

  // Step 3: Transform the coordinates by shifting them to the origin (0, 0)
  const transformedFeatures = features.map((feature) => ({
    ...feature, // Copy other properties like elevationStart, elevationEnd, height, block
    elevationStart: feature.elevationStart - minY,
    elevationEnd: feature.elevationEnd - minY,
    coords: feature.coords.map(([x, z]) => [x - minX, z - minZ]),
  }));

  // Create a palette based on the 'block' key from features
  const palette: Record<string, { type: TagType.Int; value: number }> = {
    "minecraft:air": { type: TagType.Int, value: 0 },
  };
  const blockSet = new Set<string>();
  for (const feature of features) {
    blockSet.add("minecraft:" + feature.block);
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

  // Adds in elevation to coordinate array based on feature type

  for (const feature of transformedFeatures) {
    const featureXYZ = feature.coords.map((innerList, index, array) => {
      const increment =
        (feature.elevationEnd - feature.elevationStart) / (array.length - 1);
      const elevation = feature.elevationStart + index * increment;

      return [
        Math.round(elevation), // Calculated elevation
        Math.round(innerList[1]), // The second coordinate from innerList
        Math.round(innerList[0]), // The first coordinate from innerList
      ];
    });

    if (feature.shape == "Circle") {
      // TODO: Support for circles
      console.log(featureXYZ);
    }

    for (let i = 0; i < featureXYZ.length - 1; i++) {
      let listOfPoints = Bresenham3D(
        featureXYZ[i] as [number, number, number],
        featureXYZ[i + 1] as [number, number, number]
      );
      listOfPoints.forEach((point) => {
        grid[point[0]][point[1]][point[2]] =
          palette["minecraft:" + feature.block].value;
      });
    }
  }

  const spaceCount = 0;
  for (let index = 0; index < spaceCount; index++) {
    grid.push(
      Array.from({ length: width + 1 }, () =>
        Array.from({ length: length + 1 }, () => 0)
      )
    );
  }

  const blockData: Uint8Array = new Uint8Array(grid.flat().flat());

  // Build the schematic object with dynamic width, height, and length
  const schematic: NBT = {
    type: TagType.Compound,
    name: "Schematic",
    value: {
      DataVersion: { type: TagType.Int, value: 3700 },
      Version: { type: TagType.Int, value: versionNo },
      Width: { type: TagType.Short, value: length + 1 },
      Height: { type: TagType.Short, value: height + 1 + spaceCount },
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
        value: [isOffsetEnabled ? Math.ceil(minX) + -13379008 : Math.ceil(minX), Math.ceil(minY), isOffsetEnabled ? Math.ceil(minZ) + 2727648 : Math.ceil(minZ)],
      },
    },
  };

  // Write the NBT data to a Buffer
  const nbtBuffer = writeUncompressed(schematic);

  // Compress the NBT data using pako
  const compressed = pako.gzip(nbtBuffer);

  // Create a Blob from the compressed data
  const blob = new Blob([compressed], { type: "application/octet-stream" });

  // Create a link to download the Blob as a .schem file
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "TerrasEdit.schem";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

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

  // Extract all elevation values (both start and end)
  const elevations = features.flatMap((feature) => [
    feature.elevationStart,
    feature.elevationEnd,
  ]);

  // Calculate the minimum and maximum elevation values
  const minY = Math.min(...elevations);
  const maxY = Math.max(...elevations);

  const length = maxX - minX;
  const width = maxZ - minZ;
  const height = maxY - minY;

  return {length, height, width};
}

function Bresenham3D(
  start: [number, number, number],
  end: [number, number, number],
  maxIterations: number = 10000
) {
  let [x1, y1, z1] = start;
  const [x2, y2, z2] = end;
  let ListOfPoints: [number, number, number][] = [];
  ListOfPoints.push([x1, y1, z1]);

  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  let dz = Math.abs(z2 - z1);
  let xs, ys, zs;

  if (x2 > x1) {
    xs = 1;
  } else {
    xs = -1;
  }
  if (y2 > y1) {
    ys = 1;
  } else {
    ys = -1;
  }
  if (z2 > z1) {
    zs = 1;
  } else {
    zs = -1;
  }

  let iterations = 0;

  if (dx >= dy && dx >= dz) {
    let p1 = 2 * dy - dx;
    let p2 = 2 * dz - dx;
    while (x1 !== x2 && iterations < maxIterations) {
      x1 += xs;
      if (p1 >= 0) {
        y1 += ys;
        p1 -= 2 * dx;
      }
      if (p2 >= 0) {
        z1 += zs;
        p2 -= 2 * dx;
      }
      p1 += 2 * dy;
      p2 += 2 * dz;
      ListOfPoints.push([x1, y1, z1]);
      iterations++;
    }
  } else if (dy >= dx && dy >= dz) {
    let p1 = 2 * dx - dy;
    let p2 = 2 * dz - dy;
    while (y1 !== y2 && iterations < maxIterations) {
      y1 += ys;
      if (p1 >= 0) {
        x1 += xs;
        p1 -= 2 * dy;
      }
      if (p2 >= 0) {
        z1 += zs;
        p2 -= 2 * dy;
      }
      p1 += 2 * dx;
      p2 += 2 * dz;
      ListOfPoints.push([x1, y1, z1]);
      iterations++;
    }
  } else {
    let p1 = 2 * dy - dz;
    let p2 = 2 * dx - dz;
    while (z1 !== z2 && iterations < maxIterations) {
      z1 += zs;
      if (p1 >= 0) {
        y1 += ys;
        p1 -= 2 * dz;
      }
      if (p2 >= 0) {
        x1 += xs;
        p2 -= 2 * dz;
      }
      p1 += 2 * dy;
      p2 += 2 * dx;
      ListOfPoints.push([x1, y1, z1]);
      iterations++;
    }
  }

  if (iterations >= maxIterations) {
    console.error("Maximum iterations reached, exiting to prevent crash.");
  }

  return ListOfPoints;
}

export async function saveGeoJsonFile(jsonString: string) {
  // Parse the JSON string
  const jsonObject = JSON.parse(jsonString);

  // Convert the JSON object to a Blob
  const blob = new Blob([JSON.stringify(jsonObject, null, 2)], { type: 'application/geo+json' });

  // Check if the File System Access API is available
  if ('showSaveFilePicker' in window) {
      try {
          // Open the file save dialog and let the user choose a file name and location
          const fileHandle = await (window as any).showSaveFilePicker({
              suggestedName: 'file.geojson',
              types: [
                  {
                      description: 'GeoJSON Files',
                      accept: {
                          'application/geo+json': ['.geojson'],
                      },
                  },
              ],
          });

          // Create a writable stream
          const writableStream = await fileHandle.createWritable();

          // Write the Blob to the file
          await writableStream.write(blob);

          // Close the file stream
          await writableStream.close();

          alert('File saved successfully!');
      } catch (err) {
        alert('File save failed: ' + err);
      }
  } else {
      // Fallback: Use the traditional download method if File System Access API is not supported
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'file.geojson'; // Fallback file name
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }
}