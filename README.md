<div align="center">

# TerrasEdit 🗺️⛏️

## Create and export outlines for the BuildTheEarth project

## [**🌍 Start Using TerrasEdit Now!**](https://app.TerrasEdit.codestian.com/) 

## Setup

1. Ensure you are using NodeJS 20+.
2. Run `npm install`.
3. To run in development mode, run `npm run dev`.
4. To generate static files, run `npm run build`.

## Features

- Categorize and save your work outlining with layers.
- Draw lines, polygons and rectangles.
- Load map tiles directly from sources such as MapBox, OSM or OneMap. (Right now only OSM or OneMap)
- Customize properties of outlines such as elevation and block type when importing in game.
- Transform, rotate and copy easily for similar outlines.
- Modify outlines faster.
- Import .geojson files and modify them.
- Export outlines to either .schem or .geojson.
- Move the map to lat lng location.
- Paste coordinates to a list and generate outlines.
- Right click on map canvas to teleport either by /tpll or /minecraft:tp.

### Supported map tiles

The following regions support loading satellite map tiles onto TerrasEdit. You can directly trace the outlines over. For other regions, use Polygon Creator alongside Google Maps. 

 - Singapore 
 - Hong Kong
 - Taiwan + Taipei
 - Japan
 - Korea

## Why was it made?

TerrasEdit was created to semi automate the building process of the Minecraft BuildTheEarth project, by allowing builders to draw outlines that span huge areas. 

This saves a lot of time and allows builders to focus more on detailing their builds than manually referencing map sources to draw the outlines, which can take hours. This also means non minecrafters could also contribute by helping to outline from a top down perspective. 

For most countries, copying and pasting latlng coordinates is still needed, while BTE teams that include Singapore, Taiwan or Hong Kong can use their own sourced satellite map tiles to draw on.

## Technologies used

### Frontend Frameworks and Libraries
1. **SvelteKit** - A modern framework for building web applications with Svelte.
2. **Vite** - A fast build tool and development server for modern web projects.
3. **TypeScript** - A superset of JavaScript that adds static typing.

### Styling
1. **Sass** - A CSS preprocessor that adds power and elegance to the basic language.
2. **Custom design** - All UI designs are custom made.

### Node Modules
1. **OpenLayers** - A library for displaying map data in web browsers.
2. **Prismarine-NBT** - A library for parsing and writing NBT (Named Binary Tag) data, for exporting to `.schem` format.
3. **Pako** - A fast zlib port to JavaScript for compression and decompression.
4. **GeoJSON** - A format for encoding geographic data structures.
5. **FortAwesome** - FontAwesome integration for scalable vector icons.
6. **@bte-germany/terraconvert** - Conversion from latlng to minecraft coordinates

</div>