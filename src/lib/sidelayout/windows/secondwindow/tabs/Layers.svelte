<script lang="ts">
  import { onMount } from "svelte";
  import { getMap, getVectorLayerContext } from "../../../../../utils/mapUtils";
  import {
    createVectorLayer,
    removeVectorLayer,
    setActiveLayer,
    importGeoJSON,
    renameLayer,
  } from "../../../../../utils/vectorLayerUtils";
  import { layers as layersStore, selectedLayerId as selectedLayerIdStore } from "../../../../../stores/layersStore";
  import type { Layer } from "../../../../../stores/layersStore";
  import LayersPanel from "./shared/LayersPanel.svelte";
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
  } from "../../../../../utils/saveLayers";
  import GeoJSON from "ol/format/GeoJSON";
  

  let newLayerName: string = "";

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
      const importFileName = pendingImportFile?.name ?? "Imported.geojson";
      const elevationStart = parseFloat(elevationStartInput) || 0;
      const elevationEnd = parseFloat(elevationEndInput) || 0;
      const elevation = parseFloat(elevationInput) || 0;

      await importGeoJSON(pendingImportFile, {
        block: blockName || "diamond_block",
        elevationStart,
        elevationEnd,
        elevation,
      }, getVectorLayerContext());
      const newLayer = getMap()
        .getLayers()
        .getArray()
        .slice(-1)[0] as VectorLayer;
      const newLayerId = newLayer.get("id") as string;

      layersStore.update(arr => [...arr, { id: newLayerId, name: importFileName, visible: true }]);
      setActiveLayer(newLayerId, getVectorLayerContext());
      selectedLayerIdStore.set(newLayerId);
    } catch (error: any) {
      importErrorMessage = `Error importing GeoJSON file: ${error}`;
    } finally {
      showImportProgress = false;
      pendingImportFile = null;
    }
  }

  // Initialization of layers list is handled by SecondWindow via layersStore

  // Function to add a new layer
  function addLayer() {
    const name = newLayerName.trim() || `Layer ${$layersStore.length + 1}`;
    const newLayer = createVectorLayer(name, getVectorLayerContext());
    const newLayerId = newLayer.get("id");

    layersStore.update(arr => [...arr, { id: newLayerId, name: name, visible: true }]);
    setActiveLayer(newLayerId, getVectorLayerContext());
    selectedLayerIdStore.set(newLayerId);

    newLayerName = ""; // Clear the input field
  }

  // Function to delete the selected layer
  function deleteLayer() {
    if ($selectedLayerIdStore) {
      const currentIndex = $layersStore.findIndex(layer => layer.id === $selectedLayerIdStore);
      
      deleteVectorLayerById($selectedLayerIdStore).then(() => {
        removeVectorLayer($selectedLayerIdStore!, getVectorLayerContext());
        layersStore.update(arr => arr.filter((layer) => layer.id !== $selectedLayerIdStore));
        
        // Auto-select next layer or no layer if none left
        if ($layersStore.length > 0) {
          // If we deleted the last layer, select the new last layer
          // Otherwise, select the next layer in the list
          const nextIndex = Math.min(currentIndex, $layersStore.length - 1);
          const nextId = $layersStore[nextIndex].id;
          selectedLayerIdStore.set(nextId);
          setActiveLayer(nextId, getVectorLayerContext());
        } else {
          // No layers left, clear selection
          selectedLayerIdStore.set(null);
          try { localStorage.removeItem('activeLayerId'); } catch {}
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
    if ($selectedLayerIdStore !== layerId) {
      setActiveLayer(layerId, getVectorLayerContext());
      selectedLayerIdStore.set(layerId);
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
    layersStore.update(arr => arr.map(l => l.id === layer.id ? { ...l, visible: layer.visible } : l));
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
    if ($selectedLayerIdStore) {
      const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);
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
    if ($selectedLayerIdStore) {
      const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);

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

  // file input handled inside shared panel

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
    layersStore.update(arr => arr.map(l => l.id === id ? { ...l, name: inputValue } : l));
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


<LayersPanel
  layers={$layersStore}
  selectedLayerId={$selectedLayerIdStore}
  {showDeleteConfirm}
  {showModal}
  {selectedOption}
  {selectedVersion}
  {exportLength}
  {exportWidth}
  {exportHeight}
  {isOffsetEnabled}
  {showImportConfirm}
  {showImportProgress}
  {importErrorMessage}
  {blockName}
  {elevationStartInput}
  {elevationEndInput}
  {elevationInput}
  pendingImportFileName={pendingImportFile?.name ?? ""}
  pendingImportFileSize={pendingImportFile?.size ?? 0}
  onExportClick={convertAndGetDimensions}
  onSelectLayer={selectLayer}
  onToggleVisibility={(l, e) => toggleVisibility(l, e)}
  onAddLayer={addLayer}
  onShowDelete={showDeleteConfirmation}
  onCancelDelete={cancelDelete}
  onDelete={deleteLayer}
  onNameInputClick={handleInputClick}
  onNameInput={handleInput}
  onNameBlur={(id) => handleBlur(id)}
  onHandleImport={handleImport}
  onCloseImportConfirm={closeImportConfirm}
  onConfirmImport={confirmImport}
  onToggleModal={toggleModal}
  onSelectOption={selectOption}
  onVersionChange={handleVersionChange}
  onToggleOffset={() => (isOffsetEnabled = !isOffsetEnabled)}
  onDownloadGeojson={downloadGeojson}
  onCreateSchematic={createSchematicWithOffset}
  onCloseImportError={() => (importErrorMessage = null)}
/>


