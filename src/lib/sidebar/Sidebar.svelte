<script lang="ts">
  import { onMount } from "svelte";
  import Button from "../common/Button.svelte";
  import Modal from "../common/Modal.svelte"; // Ensure the correct path to the Modal component
  import {
    enableDrawing,
    enableMoveMode,
    enableModifyMode,
    onSelectionChange,
    deleteSelectedFeatures,
    initializeMap,
    moveToLocation,
    attributionText,
    map,
  } from "../../utils/mapUtils"; // Adjust path to the utils file

  import { changeMapTileLayer } from "../../utils/mapUtils"; // Import the function
  import { MapTileLayer } from "../../utils/mapTileUtils"; // Import the enum
  import TileLayer from "ol/layer/Tile";
  import XYZ from "ol/source/XYZ";

  let showModal = false;
  let mapContainer: HTMLElement;
  let featuresSelected = false; // Track if features are selected
  let isMoveMode = true; // Track if the move mode is active
  let isModifyMode = false; // Track if the modify mode is active

  let mapUrl = ""; // Variable to hold the input value

  function toggleModal() {
    showModal = !showModal;
  }

  function toggleMoveMode() {
    enableMoveMode();
    isMoveMode = true;
    isModifyMode = false;
  }

  function toggleModifyMode() {
    enableModifyMode();
    isMoveMode = false;
    isModifyMode = true;
  }

  // Functions to switch drawing modes
  function drawPolygon() {
    enableDrawing("Polygon");
  }

  function drawCircle() {
    enableDrawing("Circle");
  }

  function drawRectangle() {
    enableDrawing("Box"); // Use 'Box' for rectangles
  }

  function drawLineString() {
    enableDrawing("LineString");
  }

  function drawPoint() {
    enableDrawing("Point");
  }

  function deleteFeature() {
    deleteSelectedFeatures();
  }

  // Function to change the map's tile layer
  function changeToOSM() {
    changeMapTileLayer(MapTileLayer.OSM);
    attributionText.set("OpenStreetMap contributors");
  }

  function changeToSingaporeOneMap() {
    changeMapTileLayer(MapTileLayer.SgOneMap);
    attributionText.set("Singapore Land Authority");
  }

  function changeToHongKongGeodata() {
    changeMapTileLayer(MapTileLayer.HkGeoData);
    attributionText.set("Hong Kong Geodata");
  }

  function changeToTaiwanNlsc() {
    changeMapTileLayer(MapTileLayer.TwNlsc);
    attributionText.set("Taiwan NLSC");
  }

  function changeToTaiwanTaipeiUdd() {
    changeMapTileLayer(MapTileLayer.TwTpeUdd);
    attributionText.set("Taipei UDD");
  }

  function changeToJapanGsi() {
    changeMapTileLayer(MapTileLayer.JpGsi);
    attributionText.set("Japan GSI");
  }

  function changeToKoreaNaver() {
    changeMapTileLayer(MapTileLayer.KrNaver);
    attributionText.set("Korea Naver Maps");
  }

  function changeToBlank() {
    changeMapTileLayer(MapTileLayer.Blank);
    attributionText.set("TerrasEdit");
  }

  function changeToCustom(mapUrl: string) {
    if(mapUrl !== '') {
      const customLayer: TileLayer<XYZ> = new TileLayer({
        source: new XYZ({
          url: mapUrl,
          maxZoom: 20,
        }),
      });

      const layers = map.getLayers();
      const layersArray = layers.getArray();
      const markerAndVectorLayers = layersArray.slice(1); // Keep all layers except the first base layer
      layers.clear(); // Clear existing layers
      layers.push(customLayer); // Add the new base layer
      markerAndVectorLayers.forEach((existingLayer) =>
        layers.push(existingLayer)
      ); // Add remaining layers
      
      attributionText.set("Custom");
    }
    else {
      alert('Type in the XYZ url');
    }
  }

  onMount(() => {
    if (mapContainer) {
      initializeMap(mapContainer); // Initialize map with the container
    }
    // Set up selection change listener
    onSelectionChange((selectedFeatures) => {
      featuresSelected = selectedFeatures.getLength() > 0;
      if (!featuresSelected) {
        toggleMoveMode(); // Ensure move mode is active if no features are selected
      }
    });
  });
</script>

<aside class="sidebar">
  <div class="top-buttons">
    {#if !featuresSelected}
      <!-- <Button iconClass="far fa-circle-dot" label="" onClick={drawPoint} /> -->
      <Button iconClass="fas fa-slash" label="" onClick={drawLineString} />
      <Button iconClass="fas fa-draw-polygon" label="" onClick={drawPolygon} />
      <Button iconClass="far fa-square" label="" onClick={drawRectangle} />
      <!-- <Button iconClass="far fa-circle" label="" onClick={drawCircle} /> -->
    {/if}
    {#if featuresSelected}
      <Button
        iconClass="fas fa-arrows-alt"
        label=""
        onClick={toggleMoveMode}
        bordered={isMoveMode}
      />
      <Button
        iconClass="fas fa-pen-fancy"
        label=""
        onClick={toggleModifyMode}
        bordered={isModifyMode}
      />
      <Button
        iconClass="fas fa-trash-can"
        label=""
        onClick={deleteFeature}
        danger
      />
    {/if}
  </div>
  <div class="bottom-buttons">
    <Button iconClass="fas fa-info" label="" />
    <Button iconClass="fas fa-cog" label="" onClick={toggleModal} />
  </div>
</aside>

<Modal title="Settings" show={showModal} on:close={toggleModal}>
  <h3>Map tiles</h3>
  <div class="tiles-container">
    <button class="settings-tile" on:click={changeToBlank}>blank</button>
    <button class="settings-tile" on:click={changeToOSM}>OSM</button>
    <button class="settings-tile" on:click={changeToSingaporeOneMap}
      >Singapore</button
    >
    <button class="settings-tile" on:click={changeToHongKongGeodata}
      >Hong Kong</button
    >
    <button class="settings-tile" on:click={changeToTaiwanNlsc}>Taiwan</button>
    <button class="settings-tile" on:click={changeToTaiwanTaipeiUdd}
      >Taiwan (Taipei)</button
    >
    <button class="settings-tile" on:click={changeToJapanGsi}>Japan</button>
    <button class="settings-tile" on:click={changeToKoreaNaver}>Korea</button>
    <input type="text" id="mapUrl" bind:value={mapUrl} placeholder="Type in url..." />

    <button
      on:click={() => {
        changeToCustom(mapUrl);
      }}>set map</button
    >
  </div>
</Modal>

<style lang="scss">
  .sidebar {
    width: 48px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: rgb(23, 25, 26);
    padding: calc((48px - 36px) / 2) 0;
  }

  .top-buttons,
  .bottom-buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc((48px - 36px) / 2); // space between buttons
  }

  h3 {
    padding-left: 4px;
    padding-bottom: 8px;
    font-weight: bold;
    font-size: 0.8rem;
  }

  .tiles-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    .settings-tile {
      padding: 8px;
      height: 84px;
      width: 84px;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 0.8rem;
    }
  }
</style>
