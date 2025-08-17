<script lang="ts">
  import { onMount } from "svelte";
  import {
    createVectorLayer,
    removeVectorLayer,
    setActiveLayer,
    getMap,
    importGeoJSON,
    vectorLayers,
    map,
    renameLayer,
  } from "../../../../../utils/mapUtils";
  import WindowButton from "$lib/common/WindowButton.svelte";
  import type { Vector as VectorLayer } from "ol/layer";
  import type { Feature } from "ol";
  import Geometry from "ol/geom/Geometry";
  import Vector from "ol/source/Vector";
  import Circle from "ol/geom/Circle";
  import {
    createSchematic,
    generateCircleVertices,
    getDimensions,
    saveGeoJsonFile,
    transformToLatLng,
  } from "../../../../../utils/exportLayers";
  import LineString from "ol/geom/LineString";
  import Polygon from "ol/geom/Polygon";
  import type { FeatureExport } from "../../../../../utils/iFeatureExprt";
  import {
    deleteVectorLayerById,
    retrieveAllVectorLayers,
  } from "../../../../../utils/saveLayers";
  import Modal from "$lib/common/Modal.svelte";
  import GeoJSON from "ol/format/GeoJSON";

  interface Layer {
    id: string; // Unique ID
    name: string; // Display name
    visible: boolean;
  }

  let layers: Layer[] = [];
  let newLayerName: string = "";
  let selectedLayerId: string | null = null;
  let fileInput: HTMLInputElement;

  let showModal = false;

  function toggleModal() {
    showModal = !showModal;
  }

  // New state for delete confirmation
  let showDeleteConfirm = false;

  // New state for import confirmation and progress
  let showImportConfirm = false;
  let showImportProgress = false;
  let pendingImportFile: File | null = null;
  let importErrorMessage: string | null = null;

  // Default values for import options
  let blockName: string = "diamond_block";
  let elevationStartInput: string = "0";
  let elevationEndInput: string = "0";
  let elevationInput: string = "0";

  // Consider files larger than 5MB as big
  const LARGE_FILE_BYTES = 5 * 1024 * 1024;

  function openImportConfirm(file: File) {
    pendingImportFile = file;
    showImportConfirm = true;
  }

  function closeImportConfirm() {
    showImportConfirm = false;
    pendingImportFile = null;
  }

  async function confirmImport() {
    if (!pendingImportFile) return;
    showImportConfirm = false;

    if (pendingImportFile.size > LARGE_FILE_BYTES) {
      showImportProgress = true;
    }

    try {
      const elevationStart = parseFloat(elevationStartInput) || 0;
      const elevationEnd = parseFloat(elevationEndInput) || 0;
      const elevation = parseFloat(elevationInput) || 0;

      await importGeoJSON(pendingImportFile, {
        block: blockName || "diamond_block",
        elevationStart,
        elevationEnd,
        elevation,
      });
      const newLayer = getMap()
        .getLayers()
        .getArray()
        .slice(-1)[0] as VectorLayer;
      const newLayerId = newLayer.get("id") as string;

      layers.push({ id: newLayerId, name: pendingImportFile.name, visible: true });
      setActiveLayer(newLayerId);
      selectedLayerId = newLayerId;
    } catch (error: any) {
      importErrorMessage = `Error importing GeoJSON file: ${error}`;
    } finally {
      showImportProgress = false;
      pendingImportFile = null;
    }
  }

  onMount(() => {
    retrieveAllVectorLayers()
      .then((listOfLayers) => {
        let firstId = "";

        Object.keys(listOfLayers).forEach((id, index) => {
          if (listOfLayers.hasOwnProperty(id)) {
            vectorLayers[id] = listOfLayers[id].layer;

            vectorLayers[id].set("id", id); // Set a unique ID for each layer
            vectorLayers[id].set("name", listOfLayers[id].name);
            map.addLayer(listOfLayers[id].layer);

            if (index === 0) {
              layers.push({
                id: id,
                name: listOfLayers[id].name,
                visible: true,
              });
              firstId = id;
            } else {
              layers.push({
                id: id,
                name: listOfLayers[id].name,
                visible: true,
              });
            }
          }
        });

        setActiveLayer(firstId);
        selectedLayerId = firstId;
      })
      .catch(() => {});
  });

  // Function to add a new layer
  function addLayer() {
    const name = newLayerName.trim() || `Layer ${layers.length + 1}`;
    const newLayer = createVectorLayer(name);
    const newLayerId = newLayer.get("id");

    layers.push({ id: newLayerId, name: name, visible: true });
    setActiveLayer(newLayerId);
    selectedLayerId = newLayerId;

    newLayerName = ""; // Clear the input field
  }

  // Function to delete the selected layer
  function deleteLayer() {
    if (selectedLayerId) {
      const currentIndex = layers.findIndex(layer => layer.id === selectedLayerId);
      
      deleteVectorLayerById(selectedLayerId).then(() => {
        removeVectorLayer(selectedLayerId!);
        layers = layers.filter((layer) => layer.id !== selectedLayerId);
        
        // Auto-select next layer or no layer if none left
        if (layers.length > 0) {
          // If we deleted the last layer, select the new last layer
          // Otherwise, select the next layer in the list
          const nextIndex = Math.min(currentIndex, layers.length - 1);
          selectedLayerId = layers[nextIndex].id;
          setActiveLayer(selectedLayerId);
        } else {
          // No layers left, clear selection
          selectedLayerId = null;
        }
        
        showDeleteConfirm = false; // Hide confirmation after deletion
      });
    }
  }

  // Function to show delete confirmation
  function showDeleteConfirmation() {
    showDeleteConfirm = true;
  }

  // Function to cancel delete confirmation
  function cancelDelete() {
    showDeleteConfirm = false;
  }

  // Function to handle clicks outside the confirmation popup
  function handleClickOutside(event: MouseEvent) {
    if (showDeleteConfirm) {
      const target = event.target as HTMLElement;
      if (!target.closest('.delete-container')) {
        showDeleteConfirm = false;
      }
    }
  }

  // Add click event listener when component mounts
  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  // Function to select a layer by its unique ID
  function selectLayer(layerId: string) {
    if (selectedLayerId !== layerId) {
      setActiveLayer(layerId);
      selectedLayerId = layerId;
    } else {
    }
  }

  // Function to toggle the visibility of a layer
  function toggleVisibility(layer: Layer, event: Event) {
    event.stopPropagation(); // Prevent the click event from bubbling up
    layer.visible = !layer.visible;
    const mapLayer = getMap()
      .getLayers()
      .getArray()
      .find((l) => l.get("id") === layer.id) as VectorLayer;
    if (mapLayer) {
      mapLayer.setVisible(layer.visible);
    }
  }

  // Function to handle GeoJSON file import
  async function handleImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      // Open confirmation modal instead of importing immediately
      openImportConfirm(file);
    }

    // Clear the file input so the same file can be selected again
    input.value = "";
  }

  function downloadGeojson() {
    if (selectedLayerId) {
      const features = getFeaturesOfSelectedLayer(selectedLayerId);
      const geojsonFormat = new GeoJSON();
      const obj: any = geojsonFormat.writeFeaturesObject(features!, {
        featureProjection: "EPSG:3857",
        dataProjection: "EPSG:4326",
      });
      if (obj && Array.isArray(obj.features)) {
        for (const f of obj.features) {
          if (f && f.properties == null) {
            f.properties = {};
          }
        }
      }
      saveGeoJsonFile(JSON.stringify(obj));
    } else {
      alert("No layer selected.");
    }
  }

  function convertAndGetDimensions() {
    if (selectedLayerId) {
      const features = getFeaturesOfSelectedLayer(selectedLayerId);

      // List to store final coordinates
      let newFinalList: FeatureExport[] = [];

      if (features) {
        // Process each feature in the featureList
        features.forEach((feature) => {
          // Get the geometry from the feature
          const geometry = feature.getGeometry();

          // Retrieve 'elevation' if it exists, otherwise fallback to 'elevationStart'

          // Retrieve 'elevation' and 'elevationEnd', with fallbacks
          const elevation = feature.get("elevation");
          const elevationStart = feature.get("elevationStart");
          const elevationEnd = feature.get("elevationEnd");
          const block = feature.get("block");

          // Define and populate FeatureExport object
          const featureExport: FeatureExport = {
            shape: feature.getGeometry()?.getType() ?? "unknown",
            coords: [],
            elevationStart:
              elevation != null ? elevation : (elevationStart ?? 0),
            elevationEnd: elevation != null ? elevation : (elevationEnd ?? 0),
            height: 1,
            block: block,
          };

          if (geometry) {
            // Check if geometry is not undefined
            if (geometry instanceof Circle) {
              // If the geometry is a Circle
              const flatCoordinates = geometry.getFlatCoordinates();
              const latLngCoordinates = transformToLatLng(flatCoordinates);

              // Ensure that we have exactly two points: center and a point on the circumference
              if (latLngCoordinates.length >= 2) {
                const circleVertices = generateCircleVertices(
                  [latLngCoordinates[0], latLngCoordinates[1]],
                  100,
                );
                featureExport.coords = circleVertices;
              }
            } else if (
              geometry instanceof LineString ||
              geometry instanceof Polygon
            ) {
              // If the geometry is a LineString or Polygon
              const flatCoordinates = geometry.getFlatCoordinates();
              const latLngCoordinates = transformToLatLng(flatCoordinates);

              featureExport.coords = latLngCoordinates;
            } else if ("getFlatCoordinates" in geometry) {
              // Use a type guard to check if geometry has getFlatCoordinates method
              const flatCoordinates = (geometry as any).getFlatCoordinates(); // Use type assertion to bypass errors
              const latLngCoordinates = transformToLatLng(flatCoordinates);
              latLngCoordinates.pop();

              featureExport.coords = latLngCoordinates;
            }
          }

          newFinalList.push(featureExport);
        });
      }

      if (newFinalList.length == 0) {
        exportLength = 0;
        exportHeight = 0;
        exportWidth = 0;
      } else {
        const dimensions = getDimensions(newFinalList);

        exportLength = dimensions.length;
        exportHeight = dimensions.height;
        exportWidth = dimensions.width;
      }

      schematicFeatureList = newFinalList;
      toggleModal();
    } else {
      alert("No layer selected.");
    }
  }

  // Function to get features of the selected layer
  function getFeaturesOfSelectedLayer(
    layerId: string,
  ): Feature<Geometry>[] | null {
    const map = getMap();
    const layer = map
      .getLayers()
      .getArray()
      .find((l) => l.get("id") === layerId) as VectorLayer;

    if (layer) {
      const source = layer.getSource();
      if (source && source instanceof Vector) {
        return source.getFeatures();
      }
    }
    return null;
  }

  // Function to trigger the file input click
  function triggerFileInput() {
    if (fileInput) {
      fileInput.click();
    }
  }

  let inputValue = "";

  function handleInputClick(event: any) {
    // Prevent click event from bubbling up to the parent div
    event.stopPropagation();
  }

  function handleInput(event: any) {
    inputValue = event.target.value;
  }

  function handleBlur(id: string) {
    renameLayer(id, inputValue);
  }

  let selectedOption: string = "Schematic";
  let selectedVersion: string = "2";

  let exportLength: number = 0;
  let exportHeight: number = 0;
  let exportWidth: number = 0;

  let schematicFeatureList: FeatureExport[] = [];

  // Function to select an option
  function selectOption(option: any) {
    selectedOption = option;
  }

  function handleVersionChange(event: any) {
    selectedVersion = event.target.value;
  }

  let isOffsetEnabled:boolean = false;

  function createSchematicWithOffset() {
    createSchematic(schematicFeatureList, parseInt(selectedVersion), isOffsetEnabled);
  }
</script>

<div class="layers-manager">
  <div class="row">
    <WindowButton
      onClick={triggerFileInput}
      iconClass="fas fa-download"
      label="Import"
      width="auto"
      flexGrow={true}
    />
    <WindowButton
      onClick={() => {
        convertAndGetDimensions();
      }}
      iconClass="fas fa-upload"
      label="Export"
      width="auto"
      flexGrow={true}
    />
    <input
      type="file"
      accept=".geojson"
      on:change={handleImport}
      bind:this={fileInput}
      style="display: none;"
    />
  </div>
  <div class="list {showDeleteConfirm ? 'dimmed' : ''}">
    {#each layers as layer (layer.id)}
      <div
        class="layer-item {selectedLayerId === layer.id ? 'selected' : ''}"
        on:click={() => selectLayer(layer.id)}
      >
        <input
          class="layer-name-input"
          type="text"
          value={layer.name}
          on:click={handleInputClick}
          on:blur={() => handleBlur(layer.id)}
          on:input={handleInput}
        />
        <input
          type="checkbox"
          on:click={(event) => {
            event.stopPropagation();
            toggleVisibility(layer, event);
          }}
          checked={layer.visible}
        />
      </div>
    {/each}
  </div>
  <div class="controls">
    <button on:click={addLayer}><i class="fas fa-plus"></i></button>
    
    <div class="delete-container">
      <div class="delete-confirmation {showDeleteConfirm ? 'show' : ''}">
        <span class="confirm-text">Confirm delete layer?</span>
        <div class="confirm-buttons">
          <button class="confirm-yes" on:click={deleteLayer}>Yes</button>
          <button class="confirm-no" on:click={cancelDelete}>No</button>
        </div>
      </div>
      
      <button 
        on:click={showDeleteConfirmation} 
        disabled={!selectedLayerId}
        class="delete-btn"
      >
        <i class="fas fa-trash-can"></i>
      </button>
    </div>
  </div>
</div>

<Modal title="Export" show={showModal} on:close={toggleModal}>
  <div class="export-row">
    <div
      class="option {selectedOption === 'Schematic' ? 'selected' : ''}"
      on:click={() => selectOption("Schematic")}
    >
      Schematic
    </div>
    <div
      class="option {selectedOption === 'GeoJSON' ? 'selected' : ''}"
      on:click={() => selectOption("GeoJSON")}
    >
      GeoJSON
    </div>
  </div>
  <div class="export-content">
    {#if selectedOption === "Schematic"}
      <div class="info">
        <label for="version">Version:</label>
        <select
          id="version"
          bind:value={selectedVersion}
          on:change={handleVersionChange}
        >
          <option value="" disabled>Select a version</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </div>
      <div class="info">
        <div class="measurement-container">
          <span class="measurement">Length: {exportLength}</span>
          <span class="measurement">Width: {exportWidth}</span>
          <span class="measurement">Height: {exportHeight}</span>
        </div>
        {#if exportHeight >= 5000 || exportWidth >= 5000 || exportLength >= 5000}
          <div class="warning">
            ⚠️ Warning: One or more dimensions exceed the 5000 limit.
          </div>
        {/if}
      </div>
      <div>
        <span>ASEAN offset</span>
        <input
          type="checkbox"
          on:click={(event) => {
            event.stopPropagation();
            isOffsetEnabled = !isOffsetEnabled;
          }}
          checked={isOffsetEnabled}
        />
      </div>
      <button
        on:click={() => {
          if (
            exportHeight >= 5000 ||
            exportWidth >= 5000 ||
            exportLength >= 5000
          ) {
            let userChoice = confirm(
              "Warning: Layer size is more than 5000 blocks. Try to reduce the size. This may crash your browser!",
            );

            if (userChoice) {
              createSchematicWithOffset();
            } else {
            }
          } else {
            createSchematicWithOffset();
          }
        }}
        class="export-btn">Export</button
      >
    {/if}

    {#if selectedOption === "GeoJSON"}
      <button
        on:click={() => {
          downloadGeojson();
        }}
        class="export-btn">Export</button
      >
    {/if}

    {#if !selectedOption}
      <p>Please select an option above to see the content.</p>
    {/if}
  </div>
</Modal>

<Modal title="Import GeoJSON" show={showImportConfirm} on:close={closeImportConfirm}>
  <div class="import-confirm">
    <p>Do you want to import the file:</p>
    <p class="filename">{pendingImportFile?.name}</p>
    <p class="filesize">
      Size: {pendingImportFile ? (pendingImportFile.size / (1024 * 1024)).toFixed(2) : '0'} MB
    </p>
    <div class="field">
      <label>Default block</label>
      <input type="text" bind:value={blockName} />
    </div>
    <div class="grid">
      <div class="field">
        <label>Line start elevation</label>
        <input type="number" bind:value={elevationStartInput} />
      </div>
      <div class="field">
        <label>Line end elevation</label>
        <input type="number" bind:value={elevationEndInput} />
      </div>
      <div class="field">
        <label>Other shapes elevation</label>
        <input type="number" bind:value={elevationInput} />
      </div>
    </div>
    {#if pendingImportFile && pendingImportFile.size > LARGE_FILE_BYTES}
      <p class="warning">This is a large file. Import may take a while.</p>
    {/if}
    <div class="actions">
      <button class="cancel" on:click={closeImportConfirm}>Cancel</button>
      <button class="confirm" on:click={confirmImport}>Import</button>
    </div>
  </div>
  </Modal>

<Modal title="Importing..." show={showImportProgress} on:close={() => {}}>
  <div class="import-progress">
    <div class="progress-bar">
      <div class="progress-bar-fill"></div>
    </div>
    <p>Please wait while the file is being imported.</p>
  </div>
</Modal>

{#if importErrorMessage}
  <Modal title="Import Error" show={true} on:close={() => (importErrorMessage = null)}>
    <div class="import-error">
      <p>{importErrorMessage}</p>
      <div class="actions">
        <button class="confirm" on:click={() => (importErrorMessage = null)}>Close</button>
      </div>
    </div>
  </Modal>
{/if}

<style lang="scss">
  .layers-manager {
    width: 100%;
    height: 100%;
    padding: 8px;
    display: flex;
    flex-direction: column;
    position: relative;

    .row {
      width: 100%;
      display: flex;
      justify-content: space-around;
      gap: 8px;
      padding-bottom: 8px;
      user-select: none;
    }

    .list {
      width: 100%;
      overflow-y: scroll;
      scrollbar-color: rgba(255, 255, 255, 0.4) rgba(255, 255, 255, 0.1);
      scrollbar-width: thin;
      height: 100%;
      position: relative;

      &.dimmed {
        opacity: 0.4;
        pointer-events: none;
      }

      .layer-item {
        padding: 4px;
        margin-bottom: 2px;
        margin-right: 8px;
        background: rgba(255, 255, 255, 0.1);
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: white;
        transition: background 0.3s;

        &:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        &.selected {
          background: rgba(255, 255, 255, 0.3);
        }

        input[type="checkbox"] {
          margin-left: 10px;
          cursor: pointer;
          appearance: none; /* Remove default checkbox appearance */
          width: 24px; /* Set width */
          height: 24px; /* Set height */
          border: 1px solid rgba(255, 255, 255, 0.2); /* Border color */
          background: rgba(0, 0, 0, 0.05); /* Default background */
          position: relative;

          &:checked {
            background: green; /* Background color when checked */
            background: green;
          }

          &:checked:before {
            content: "";
            position: absolute;
            top: 3px; /* Adjust based on your preference */
            left: 8px; /* Adjust based on your preference */
            width: 4px; /* Width of the checkmark */
            height: 12px; /* Height of the checkmark */
            border: solid white;
            border-width: 0 2px 2px 0;
            transform: rotate(45deg);
            opacity: 1; /* Show checkmark when checked */
          }
        }

        .layer-name-input {
          border: none;
          padding: 8px;
          background: rgba(0, 0, 0, 0.4);
          color: white;
          font-size: 0.7rem;
          outline: none;
        }
      }
    }

    .controls {
      width: 100%;
      height: 32px;
      background: rgba(255, 255, 255, 0.05);
      display: flex;
      justify-content: flex-end;

      button {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.05);
        cursor: pointer;
        font-weight: bold;
        text-transform: uppercase;

        i {
          font-size: 0.8rem;
        }

        &:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
      }

      .delete-btn {
        position: relative;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.05);
        cursor: pointer;
        font-weight: bold;
        text-transform: uppercase;

        i {
          font-size: 0.8rem;
        }

        &:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
      }

      .delete-container {
        position: relative;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .delete-confirmation {
        position: absolute;
        bottom: calc(100% + 8px);
        right: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: rgb(41, 41, 41);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
        z-index: 1000;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        opacity: 0;
        transform: scale(0.3);
        transform-origin: bottom right;
        transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
        visibility: hidden;

        &.show {
          opacity: 1;
          transform: scale(1);
          pointer-events: auto;
          visibility: visible;
        }
      }

      .delete-confirmation.show {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      .confirm-text {
        font-weight: bold;
        font-size: 0.8rem;
        white-space: nowrap;
      }

      .confirm-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 8px;

        button {
          width: auto;
          height: auto;
          padding: 6px 12px;
          background-color: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: bold;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.3s;
          font-size: 0.7rem;

          &:hover {
            background: rgba(255, 255, 255, 0.1);
          }

          &.confirm-yes {
            background-color: rgb(201, 13, 13);
            border-color: rgb(255, 0, 0);
          }

          &.confirm-no {
            background-color: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.1);
          }
        }
      }
    }
  }

  .export-row {
    width: 100%;
    display: flex;
    gap: 8px;
    margin-bottom: 8px;

    .option {
      flex: 1;
      background: rgba(255, 255, 255, 0.1);
      padding: 12px;
      text-align: center;
      font-size: 0.8rem;
      font-weight: bold;
      letter-spacing: 1px;
      cursor: pointer;
      transition: background 0.3s;
      user-select: none;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      &.selected {
        background: rgba(255, 255, 255, 0.2);
      }
    }
  }

  .export-content {
    display: flex;
    flex-direction: column;

    .info {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      p {
        margin: 0;
      }

      .measurement-container {
        display: flex;
        width: 100%;
        margin-top: 12px;
        margin-bottom: 12px;

        .measurement {
          flex: 1;
          text-align: center;
          padding: 0.5rem;
          font-size: 0.8rem;
          text-transform: uppercase;
          font-weight: bold;
          letter-spacing: 2px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      }

      .warning {
        font-size: 0.8rem;
        margin-bottom: 20px;
      }
    }

    button {
      cursor: pointer;
      padding: 8px 16px;
      background-color: green;
      border-top: 3px solid rgba(255, 255, 255, 0.1);
      border-left: 3px solid rgba(255, 255, 255, 0.1);
      border-bottom: 3px solid rgba(0, 0, 0, 0.3);
      border-right: 3px solid rgba(0, 0, 0, 0.3);
      font-size: 0.6rem;
      font-weight: bold;
      color: white;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
  }

  /* Import modal inputs */
  .import-confirm {
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 6px;
    }
    .grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 6px;
    }
    input[type="text"], input[type="number"] {
      padding: 6px;
      color: white;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
  }

  .import-confirm {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .filename {
      font-weight: bold;
      word-break: break-all;
    }

    .filesize {
      opacity: 0.8;
      font-size: 0.8rem;
    }

    .warning {
      color: orange;
      font-size: 0.8rem;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;

      button {
        cursor: pointer;
        padding: 8px 16px;
        background-color: green;
        border-top: 3px solid rgba(255, 255, 255, 0.1);
        border-left: 3px solid rgba(255, 255, 255, 0.1);
        border-bottom: 3px solid rgba(0, 0, 0, 0.3);
        border-right: 3px solid rgba(0, 0, 0, 0.3);
        font-size: 0.6rem;
        font-weight: bold;
        color: white;
        letter-spacing: 2px;
        text-transform: uppercase;
      }

      .cancel {
        background-color: rgba(255, 255, 255, 0.2);
      }
    }
  }

  .import-progress {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .progress-bar {
      position: relative;
      width: 100%;
      height: 10px;
      background: rgba(255, 255, 255, 0.1);
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.2);

      .progress-bar-fill {
        position: absolute;
        left: -40%;
        width: 40%;
        height: 100%;
        background: green;
        animation: progress-indeterminate 1s linear infinite;
      }
    }

    @keyframes progress-indeterminate {
      0% { left: -40%; }
      100% { left: 100%; }
    }
  }

  .import-error {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .actions {
      display: flex;
      justify-content: flex-end;

      .confirm {
        background: green;
        color: white;
      }
    }
  }



</style>
