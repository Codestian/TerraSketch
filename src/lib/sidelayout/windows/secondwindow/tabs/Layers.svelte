<script lang="ts">
  import { onMount } from "svelte";
  import { getMap, getVectorLayerContext } from "../../../../../utils/mapUtils";
  import {
    removeVectorLayer,
    setActiveLayer,
    importGeoJSON,
    renameLayer,
    DEFAULT_IMPORT_PROPERTY_ROWS,
    type ImportPropertyRow,
  } from "../../../../../utils/vectorLayerUtils";
  import { layers as layersStore, selectedLayerId as selectedLayerIdStore, addEmptyVectorLayer } from "../../../../../stores/layersStore";
  import type { Layer } from "../../../../../stores/layersStore";
  import {
    pendingImportFile,
    showImportConfirm,
    openImportConfirm,
    closeImportConfirm,
  } from "../../../../../stores/geoImportConfirmStore";
  import { get } from "svelte/store";
  import LayersPanel from "./shared/LayersPanel.svelte";
  import Modal from "../../../../common/Modal.svelte";
  import Button from "../../../../common/Button.svelte";
  import type { Vector as VectorLayer } from "ol/layer";
  import type { Feature } from "ol";
  import Geometry from "ol/geom/Geometry";
  import Vector from "ol/source/Vector";
  import Circle from "ol/geom/Circle";
  import {
    generateCircleVertices,
    getDimensions,
    saveGeoJsonFile,
    saveKmlFile,
    transformToLatLng,
    convertGeoJSONToKML,
    saveSchematicFile,
    convertGeoJSONToFeatureExport,
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

  // New state for export modal
  let showExportModal = false;
  let selectedExportTab = "GeoJSON";
  let showFeatureTypes = true;
  let customFilename = "terrasedit";
  
  // Schematic export parameters
  let schematicVersion = 2;
  let schematicFillPolygons = false;
  let schematicOffsetX = 0;
  let schematicOffsetZ = 0;
  let selectedOffsetPreset = "Default";
  let isInitialized = false; // Flag to prevent saving during initialization
  let saveTimeout: ReturnType<typeof setTimeout> | null = null; // For debouncing saves

  // Load schematic settings from localStorage on component mount
  function loadSchematicSettings() {
    try {
      const savedSettings = localStorage.getItem('schematicSettings');
      console.log('Raw localStorage data:', savedSettings);
      
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        console.log('Parsed settings:', settings);
        
        schematicVersion = settings.version || 2;
        schematicFillPolygons = settings.fillPolygons !== undefined ? settings.fillPolygons : false;
        schematicOffsetX = settings.offsetX || 0;
        schematicOffsetZ = settings.offsetZ || 0;
        selectedOffsetPreset = settings.offsetPreset || "Default";
        
        console.log('Applied schematic settings:', {
          version: schematicVersion,
          fillPolygons: schematicFillPolygons,
          offsetX: schematicOffsetX,
          offsetZ: schematicOffsetZ,
          offsetPreset: selectedOffsetPreset
        });
      } else {
        console.log('No saved schematic settings found, using defaults');
      }
    } catch (error) {
      console.warn('Failed to load schematic settings from localStorage:', error);
    }
    // Mark as initialized after loading
    isInitialized = true;
    console.log('Schematic settings initialization complete');
  }

  // Save schematic settings to localStorage
  function saveSchematicSettings() {
    if (!isInitialized) return; // Don't save during initialization
    
    try {
      const settings = {
        version: schematicVersion,
        fillPolygons: schematicFillPolygons,
        offsetX: schematicOffsetX,
        offsetZ: schematicOffsetZ,
        offsetPreset: selectedOffsetPreset
      };
      localStorage.setItem('schematicSettings', JSON.stringify(settings));
      console.log('Saved schematic settings:', settings);
    } catch (error) {
      console.warn('Failed to save schematic settings to localStorage:', error);
    }
  }

  // Debounced save function to prevent multiple rapid saves
  function debouncedSave() {
    if (!isInitialized) return;
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
      saveSchematicSettings();
      saveTimeout = null;
    }, 100); // 100ms delay
  }
  
  // Offset presets
  const offsetPresets = [
    { name: "Default", offsetX: 0, offsetZ: 0 },
    { name: "ASEAN", offsetX: -13379008, offsetZ: 2727648 }
  ];

  // Single reactive statement to save settings when any of them change (only after initialization)
  $: if (isInitialized && 
          schematicVersion !== undefined && 
          schematicFillPolygons !== undefined && 
          schematicOffsetX !== undefined && 
          schematicOffsetZ !== undefined && 
          selectedOffsetPreset !== undefined) {
    debouncedSave();
  }


  function toggleExportModal() {
    showExportModal = !showExportModal;
  }

  function selectExportTab(tab: string) {
    selectedExportTab = tab;
  }

  function handleOffsetPresetChange() {
    const preset = offsetPresets.find(p => p.name === selectedOffsetPreset);
    if (preset) {
      schematicOffsetX = preset.offsetX;
      schematicOffsetZ = preset.offsetZ;
    }
    // The reactive statement will handle saving automatically
  }

  function handleExport() {
    if (!$selectedLayerIdStore) {
      alert('Please select a layer to export.');
      return;
    }
    
    if (selectedExportTab === 'GeoJSON') {
      // Export as GeoJSON
      const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);
      if (features && features.length > 0) {
        const geojsonFormat = new GeoJSON();
        const obj: any = geojsonFormat.writeFeaturesObject(features, {
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
        
        saveGeoJsonFile(JSON.stringify(obj), customFilename);
      } else {
        alert('No features found in the selected layer.');
      }
    } else if (selectedExportTab === 'KML') {
      // Export as KML
      const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);
      if (features && features.length > 0) {
        const geojsonFormat = new GeoJSON();
        const obj: any = geojsonFormat.writeFeaturesObject(features, {
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
        
        saveKmlFile(JSON.stringify(obj), customFilename);
      } else {
        alert('No features found in the selected layer.');
      }
    } 
    
    else if (selectedExportTab === 'Schematic') {
      const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);
      if (features && features.length > 0) {
        const geojsonFormat = new GeoJSON();
        const obj: any = geojsonFormat.writeFeaturesObject(features, {
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
        
        // Convert GeoJSON to FeatureExport format
        const featureExports = convertGeoJSONToFeatureExport(obj);
        
        saveSchematicFile(featureExports, schematicVersion, customFilename, schematicFillPolygons, schematicOffsetX, schematicOffsetZ);
      } else {
        alert('No features found in the selected layer.');
      }
    } else {
      alert('Invalid export tab.');
    }
  }

  // Computed values for feature types
  $: featureTypeSummary = (() => {
    if (!$selectedLayerIdStore) return 'None';
    
    const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);
    if (!features || features.length === 0) return 'None';
    
    const typeCounts: Record<string, number> = {};
    features.forEach(feature => {
      const geometry = feature.getGeometry();
      if (geometry) {
        const type = geometry.getType();
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      }
    });
    
    const summary = Object.entries(typeCounts)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');
    
    return summary || 'Unknown';
  })();

  $: featureTypeBreakdown = (() => {
    if (!$selectedLayerIdStore) return [];
    
    const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);
    if (!features || features.length === 0) return [];
    
    const typeCounts: Record<string, number> = {};
    features.forEach(feature => {
      const geometry = feature.getGeometry();
      if (geometry) {
        const type = geometry.getType();
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      }
    });
    
    return Object.entries(typeCounts);
  })();

  // Function to get preview GeoJSON with limited coordinates
  function getPreviewGeoJSON() {
    if (!$selectedLayerIdStore) return 'No layer selected';
    
    const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);
    if (!features || features.length === 0) return 'No features to preview';
    
    const firstFeature = features[0];
    const geojsonFormat = new GeoJSON();
    const obj = geojsonFormat.writeFeatureObject(firstFeature, {
      featureProjection: "EPSG:3857",
      dataProjection: "EPSG:4326",
    });
    
    // Limit coordinates to first 2 for preview
    try {
      const geoObj = obj as any;
      if (geoObj.geometry && geoObj.geometry.coordinates) {
        const coords = geoObj.geometry.coordinates;
        
        // Handle different geometry types
        if (geoObj.geometry.type === 'Point') {
          // Point: [lon, lat] - keep as is (single coordinate)
          geoObj.geometry.coordinates = coords.slice(0, 2);
        } else if (geoObj.geometry.type === 'LineString') {
          // LineString: [[lon1, lat1], [lon2, lat2], ...] - keep first and last
          if (coords.length === 1) {
            geoObj.geometry.coordinates = coords;
          } else if (coords.length === 2) {
            geoObj.geometry.coordinates = coords;
          } else {
            geoObj.geometry.coordinates = [coords[0], '...', coords[coords.length - 1]];
          }
        } else if (geoObj.geometry.type === 'Polygon') {
          // Polygon: [[[lon1, lat1], [lon2, lat2], ...]] - keep first and last of first ring
          if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
            const ring = coords[0];
            if (ring.length === 1) {
              geoObj.geometry.coordinates[0] = ring;
            } else if (ring.length === 2) {
              geoObj.geometry.coordinates[0] = ring;
            } else {
              geoObj.geometry.coordinates[0] = [ring[0], '...', ring[ring.length - 1]];
            }
          }
        } else if (geoObj.geometry.type === 'MultiPolygon') {
          // MultiPolygon: [[[[lon1, lat1], [lon2, lat2], ...]]] - keep first and last of first polygon
          if (Array.isArray(coords[0]) && Array.isArray(coords[0][0]) && Array.isArray(coords[0][0][0])) {
            const ring = coords[0][0];
            if (ring.length === 1) {
              geoObj.geometry.coordinates[0][0] = ring;
            } else if (ring.length === 2) {
              geoObj.geometry.coordinates[0][0] = ring;
            } else {
              geoObj.geometry.coordinates[0][0] = [ring[0], '...', ring[ring.length - 1]];
            }
          }
        }
      }
    } catch (e) {
      console.log('Coordinate limiting failed:', e);
    }
    
    return JSON.stringify(obj, null, 2);
  }

  // Function to get preview KML with limited coordinates
  function getPreviewKML() {
    if (!$selectedLayerIdStore) return 'No layer selected';
    
    const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);
    if (!features || features.length === 0) return 'No features to preview';
    
    const firstFeature = features[0];
    const geojsonFormat = new GeoJSON();
    const obj = geojsonFormat.writeFeatureObject(firstFeature, {
      featureProjection: "EPSG:3857",
      dataProjection: "EPSG:4326",
    });
    
    // Limit coordinates to first and last for preview (similar to GeoJSON preview)
    let geoObj = obj as any;
    try {
      if (geoObj.geometry && geoObj.geometry.coordinates) {
        const coords = geoObj.geometry.coordinates;
        
        // Handle different geometry types
        if (geoObj.geometry.type === 'Point') {
          // Point: [lon, lat] - keep as is (single coordinate)
          geoObj.geometry.coordinates = coords.slice(0, 2);
        } else if (geoObj.geometry.type === 'LineString') {
          // LineString: [[lon1, lat1], [lon2, lat2], ...] - keep first and last
          if (coords.length === 1) {
            geoObj.geometry.coordinates = coords;
          } else if (coords.length === 2) {
            geoObj.geometry.coordinates = coords;
          } else {
            geoObj.geometry.coordinates = [coords[0], '...', coords[coords.length - 1]];
          }
        } else if (geoObj.geometry.type === 'Polygon') {
          // Polygon: [[[lon1, lat1], [lon2, lat2], ...]] - keep first and last of first ring
          if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
            const ring = coords[0];
            if (ring.length === 1) {
              geoObj.geometry.coordinates[0] = ring;
            } else if (ring.length === 2) {
              geoObj.geometry.coordinates[0] = ring;
            } else {
              geoObj.geometry.coordinates[0] = [ring[0], '...', ring[ring.length - 1]];
            }
          }
        } else if (geoObj.geometry.type === 'MultiPolygon') {
          // MultiPolygon: [[[[lon1, lat1], [lon2, lat2], ...]]] - keep first and last of first polygon
          if (Array.isArray(coords[0]) && Array.isArray(coords[0][0]) && Array.isArray(coords[0][0][0])) {
            const ring = coords[0][0];
            if (ring.length === 1) {
              geoObj.geometry.coordinates[0][0] = ring;
            } else if (ring.length === 2) {
              geoObj.geometry.coordinates[0][0] = ring;
            } else {
              geoObj.geometry.coordinates[0][0] = [ring[0], '...', ring[ring.length - 1]];
            }
          }
        }
      }
    } catch (e) {
      console.log('Coordinate limiting failed:', e);
    }
    
    // Create a simplified GeoJSON object for KML conversion
    const simplifiedGeoJSON = {
      type: "FeatureCollection",
      features: [geoObj]
    };
    
    // Convert to KML using the custom function
    try {
      const kmlString = convertGeoJSONToKML(simplifiedGeoJSON);
      
      // For preview, limit the KML to show structure but not overwhelming content
      // Split into lines and limit to first few lines
      const lines = kmlString.split('\n');
      if (lines.length > 20) {
        // Show first 15 lines, then ellipsis, then last 5 lines
        const previewLines = [
          ...lines.slice(0, 15),
          '    <!-- ... more content ... -->',
          ...lines.slice(-5)
        ];
        return previewLines.join('\n');
      }
      
      return kmlString;
    } catch (e) {
      console.log('KML conversion failed:', e);
      return 'Error generating KML preview';
    }
  }

  // New state for delete confirmation
  let showDeleteConfirm = false;

  // Import confirmation state is shared via geoImportConfirmStore (Layers tab + welcome modal)
  let showImportProgress = false;
  let importErrorMessage: string | null = null;

  /** Default properties applied to each feature on GeoJSON import (key-value table in UI). */
  let importPropertyRows: ImportPropertyRow[] = DEFAULT_IMPORT_PROPERTY_ROWS.map((r) => ({
    ...r,
  }));

  function setImportPropertyRows(rows: ImportPropertyRow[]) {
    importPropertyRows = rows;
  }

  /** Reset the import property table whenever the modal opens (not while editing). */
  let prevShowImportConfirm = false;
  $: {
    if ($showImportConfirm && !prevShowImportConfirm) {
      importPropertyRows = DEFAULT_IMPORT_PROPERTY_ROWS.map((r) => ({ ...r }));
    }
    prevShowImportConfirm = $showImportConfirm;
  }

  // Consider files larger than 5MB as big
  const LARGE_FILE_BYTES = 5 * 1024 * 1024;

  async function confirmImport() {
    const file = get(pendingImportFile);
    if (!file) return;
    showImportConfirm.set(false);

    if (file.size > LARGE_FILE_BYTES) {
      showImportProgress = true;
    }

    try {
      const importFileName = file?.name ?? "Imported.geojson";
      await importGeoJSON(
        file,
        { propertyRows: importPropertyRows },
        getVectorLayerContext()
      );
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
      pendingImportFile.set(null);
    }
  }

  // Initialization of layers list is handled by SecondWindow via layersStore

  // Function to add a new layer
  function addLayer() {
    addEmptyVectorLayer(newLayerName);
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
    loadSchematicSettings();
    
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

  function onhandleExport() {
    // Check if a layer is selected before opening the modal
    if (!$selectedLayerIdStore) {
      alert("Please select a layer to export.");
      return;
    }
    // show export modal
    toggleExportModal();
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

  // function convertAndGetDimensions() {
  //   if ($selectedLayerIdStore) {
  //     const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);

  //     // List to store final coordinates
  //     let newFinalList: FeatureExport[] = [];

  //     if (features) {
  //       // Process each feature in the featureList
  //       features.forEach((feature) => {
  //         // Get the geometry from the feature
  //         const geometry = feature.getGeometry();

  //         const block = feature.get("block");

  //         // Define and populate FeatureExport object
  //         const featureExport: FeatureExport = {
  //           shape: feature.getGeometry()?.getType() ?? "unknown",
  //           coords: [],
  //           height: 1,
  //           block: block,
  //         };

  //         if (geometry) {
  //           // Check if geometry is not undefined
  //           if (geometry instanceof Circle) {
  //             // If the geometry is a Circle
  //             const flatCoordinates = geometry.getFlatCoordinates();
  //             const latLngCoordinates = transformToLatLng(flatCoordinates);

  //             // Ensure that we have exactly two points: center and a point on the circumference
  //             if (latLngCoordinates.length >= 2) {
  //               const circleVertices = generateCircleVertices(
  //                 [latLngCoordinates[0], latLngCoordinates[1]],
  //                 100,
  //               );
  //               featureExport.coords = circleVertices;
  //             }
  //           } else if (
  //             geometry instanceof LineString ||
  //             geometry instanceof Polygon
  //           ) {
  //             // If the geometry is a LineString or Polygon
  //             const flatCoordinates = geometry.getFlatCoordinates();
  //             const latLngCoordinates = transformToLatLng(flatCoordinates);

  //             featureExport.coords = latLngCoordinates;
  //           } else if ("getFlatCoordinates" in geometry) {
  //             // Use a type guard to check if geometry has getFlatCoordinates method
  //             const flatCoordinates = (geometry as any).getFlatCoordinates(); // Use type assertion to bypass errors
  //             const latLngCoordinates = transformToLatLng(flatCoordinates);
  //             latLngCoordinates.pop();

  //             featureExport.coords = latLngCoordinates;
  //           }
  //         }

  //         newFinalList.push(featureExport);
  //       });
  //     }

  //     if (newFinalList.length == 0) {
  //       exportLength = 0;
  //       exportHeight = 0;
  //       exportWidth = 0;
  //     } else {
  //       const dimensions = getDimensions(newFinalList);

  //       exportLength = dimensions.length;
  //       exportHeight = dimensions.height;
  //       exportWidth = dimensions.width;
  //     }

  //     schematicFeatureList = newFinalList;
  //     toggleModal();
  //   } else {
  //     alert("No layer selected.");
  //   }
  // }

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
    // createSchematic(schematicFeatureList, parseInt(selectedVersion), isOffsetEnabled);
  }
</script>

<style lang="scss">
  .export-modal-content {
    display: flex;
    min-height: 400px;
    gap: 0;
  }

  .export-sidebar {
    width: 120px;
    background-color: rgba(255, 255, 255, 0.05);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    padding: 0;
  }

  .sidebar-tab {
    background: none;
    border: none;
    color: white;
    padding: 12px 16px;
    text-align: left;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    border-left: 3px solid rgba(255, 255, 255, 0.1);

    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    &.active {
      background-color: rgba(255, 255, 255, 0.15);
      border-left: 3px solid green;
    }
  }

  .export-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100%;
    color: white;
  }

  .scrollable-content {
    flex: 1;
    padding: 12px;
    color: white;
    min-height: 300px; /* Ensure minimum content height */
  }

  .export-button-container {
    padding: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background-color: rgba(255, 255, 255, 0.05);
    display: flex;
    justify-content: flex-end;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    
    &:last-child {
      border-bottom: none;
    }
  }

  .detail-label {
    color: rgba(255, 255, 255, 0.7);
    font-weight: 500;
    font-size: 0.9rem;
  }

  .detail-value {
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
    text-align: right;
  }

  .feature-types-toggle {
    background: none;
    border: none;
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    
    &:hover {
      color: rgba(255, 255, 255, 0.8);
    }
    
    i {
      font-size: 0.7rem;
      transition: transform 0.2s ease;
    }
  }

  .feature-types-breakdown {
    margin: 12px 0;
    padding: 0px 12px;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .feature-type-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    
    &:last-child {
      border-bottom: none;
    }
  }

  .feature-type-name {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.85rem;
    text-transform: capitalize;
  }

  .feature-type-count {
    color: white;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .geojson-preview {
    margin-bottom: 20px;
  }

  .kml-preview {
    margin-bottom: 20px;
  }

  .preview-content {
    margin-top: 8px;
    max-height: 200px;
    overflow-y: auto;
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 12px;
  }

  .json-preview {
    margin: 0;
    color: #e6e6e6;
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .kml-preview .json-preview {
    color: #90EE90; /* Light green for KML content */
  }

  .no-preview {
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
    font-size: 0.9rem;
  }

  .filename-input {
    width: 100%;
    padding: 8px 12px;
    margin-top: 8px;
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 0.9rem;
    
    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
    
    &:focus {
      outline: none;
      border-color: green;
      background-color: rgba(255, 255, 255, 0.15);
    }
  }

  select.filename-input {
    cursor: pointer;
    
    option {
      background-color: #2a2a2a;
      color: white;
    }
  }

  .schematic-export {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .schematic-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .option-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .offset-group {
    margin-top: 8px;
  }

  #offset-preset {
    margin-bottom: 12px;
  }

  .offset-row {
    display: flex;
    gap: 12px;
  }

  .offset-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .filename-input-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .filename-input-container .filename-input {
    margin-top: 8px;
    padding-right: 60px; /* Make space for the extension */
  }

  .filename-extension {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
    pointer-events: none;
    margin-top: 4px; /* Match the input's margin-top */
  }


</style>


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
  showImportConfirm={$showImportConfirm}
  {showImportProgress}
  {importErrorMessage}
  {importPropertyRows}
  onImportPropertyRowsChange={setImportPropertyRows}

  pendingImportFileName={$pendingImportFile?.name ?? ""}
  pendingImportFileSize={$pendingImportFile?.size ?? 0}
  onExportClick={onhandleExport}
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

<Modal
  show={showExportModal}
  title="Export"
  on:close={toggleExportModal}
>
  <div class="export-modal-content">
    <div class="export-sidebar">
      <button 
        class="sidebar-tab {selectedExportTab === 'GeoJSON' ? 'active' : ''}"
        on:click={() => selectExportTab('GeoJSON')}
      >
        GeoJSON
      </button>
      <button 
        class="sidebar-tab {selectedExportTab === 'KML' ? 'active' : ''}"
        on:click={() => selectExportTab('KML')}
      >
        KML
      </button>

      <button 
        class="sidebar-tab {selectedExportTab === 'Schematic' ? 'active' : ''}"
        on:click={() => selectExportTab('Schematic')}
      >
        Schematic
      </button>
    </div>
    <div class="export-content">
      <div class="scrollable-content">        
                {#if selectedExportTab === 'GeoJSON'}
          <div class="geojson-preview">
            <div class="detail-label">Preview (First Feature):</div>
            <div class="preview-content">
              {#if $selectedLayerIdStore}
                {#if (() => {
                  const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);
                  return features && features.length > 0;
                })()}
                  <pre class="json-preview">{getPreviewGeoJSON()}</pre>
                {:else}
                  <span class="no-preview">No features to preview</span>
                {/if}
              {:else}
                <span class="no-preview">No layer selected</span>
              {/if}
            </div>
          </div>
          
          <label for="filename-input" class="detail-label">Filename:</label>
          <div class="filename-input-container">
            <input 
              id="filename-input"
              type="text" 
              bind:value={customFilename}
              placeholder="Enter filename (e.g., terrasedit)"
              class="filename-input"
            />
            <span class="filename-extension">.geojson</span>
          </div>
          
          <div class="layer-details">
            <div class="detail-row">
              <span class="detail-label">Total Features:</span>
              <span class="detail-value">
                {#if $selectedLayerIdStore}
                  {getFeaturesOfSelectedLayer($selectedLayerIdStore)?.length || 0}
                {:else}
                  0
                {/if}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Feature Types:</span>
              <span class="detail-value">
                {#if $selectedLayerIdStore}
                  <button 
                    class="feature-types-toggle"
                    on:click={() => showFeatureTypes = !showFeatureTypes}
                  >
                    <i class="fas fa-chevron-{showFeatureTypes ? 'up' : 'down'}"></i>
                  </button>
                {:else}
                  None
                {/if}
              </span>
            </div>
            
            {#if showFeatureTypes && $selectedLayerIdStore && featureTypeBreakdown.length > 0}
              <div class="feature-types-breakdown">
                {#each featureTypeBreakdown as [type, count]}
                  <div class="feature-type-item">
                    <span class="feature-type-name">{type}</span>
                    <span class="feature-type-count">{count}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {:else if selectedExportTab === 'KML'}
          <div class="kml-preview">
            <div class="detail-label">Preview (First Feature):</div>
            <div class="preview-content">
              {#if $selectedLayerIdStore}
                {#if (() => {
                  const features = getFeaturesOfSelectedLayer($selectedLayerIdStore);
                  return features && features.length > 0;
                })()}
                  <pre class="json-preview">{getPreviewKML()}</pre>
                {:else}
                  <span class="no-preview">No features to preview</span>
                {/if}
              {:else}
                <span class="no-preview">No layer selected</span>
              {/if}
            </div>
          </div>
          
          <label for="filename-input" class="detail-label">Filename:</label>
          <div class="filename-input-container">
            <input 
              id="filename-input"
              type="text" 
              bind:value={customFilename}
              placeholder="Enter filename (e.g., terrasedit)"
              class="filename-input"
            />
            <span class="filename-extension">.kml</span>
          </div>
          
          <div class="layer-details">
            <div class="detail-row">
              <span class="detail-label">Total Features:</span>
              <span class="detail-value">
                {#if $selectedLayerIdStore}
                  {getFeaturesOfSelectedLayer($selectedLayerIdStore)?.length || 0}
                {:else}
                  0
                {/if}
              </span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Feature Types:</span>
              <span class="detail-value">
                {#if $selectedLayerIdStore}
                  <button 
                    class="feature-types-toggle"
                    on:click={() => showFeatureTypes = !showFeatureTypes}
                  >
                    <i class="fas fa-chevron-{showFeatureTypes ? 'up' : 'down'}"></i>
                  </button>
                {:else}
                  None
                {/if}
              </span>
            </div>
            
            {#if showFeatureTypes && $selectedLayerIdStore && featureTypeBreakdown.length > 0}
              <div class="feature-types-breakdown">
                {#each featureTypeBreakdown as [type, count]}
                  <div class="feature-type-item">
                    <span class="feature-type-name">{type}</span>
                    <span class="feature-type-count">{count}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {:else if selectedExportTab === 'Schematic'}
          <div class="schematic-export">
            <div class="schematic-options">
              <div class="option-group">
                <label for="version-input" class="detail-label">Version:</label>
                <select 
                  id="version-input"
                  bind:value={schematicVersion}
                  class="filename-input"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
              
              <div class="option-group">
                <label for="filename-schematic" class="detail-label">Filename:</label>
                <div class="filename-input-container">
                  <input 
                    id="filename-schematic"
                    type="text" 
                    bind:value={customFilename}
                    placeholder="Enter filename (e.g., terrasedit)"
                    class="filename-input"
                  />
                  <span class="filename-extension">.schem</span>
                </div>
              </div>
              
              <div class="option-group">
                <label for="fill-polygons-checkbox" class="detail-label">
                  <input 
                    id="fill-polygons-checkbox"
                    type="checkbox" 
                    bind:checked={schematicFillPolygons}
                    style="margin-right: 8px;"
                  />
                  Fill Polygons
                </label>
              </div>
              
              <div class="offset-group">
                <div class="option-group">
                  <label for="offset-preset" class="detail-label">Offset Preset:</label>
                  <select 
                    id="offset-preset"
                    bind:value={selectedOffsetPreset}
                    on:change={handleOffsetPresetChange}
                    class="filename-input"
                  >
                    {#each offsetPresets as preset}
                      <option value={preset.name}>{preset.name}</option>
                    {/each}
                  </select>
                </div>
                
                <div class="offset-row">
                  <div class="offset-field">
                    <label for="offset-x" class="detail-label">Offset X:</label>
                    <input 
                      id="offset-x"
                      type="number" 
                      bind:value={schematicOffsetX}
                      placeholder="0"
                      class="filename-input"
                    />
                  </div>
                  <div class="offset-field">
                    <label for="offset-z" class="detail-label">Offset Z:</label>
                    <input 
                      id="offset-z"
                      type="number" 
                      bind:value={schematicOffsetZ}
                      placeholder="0"
                      class="filename-input"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div class="layer-details">
              <div class="detail-row">
                <span class="detail-label">Total Features:</span>
                <span class="detail-value">
                  {#if $selectedLayerIdStore}
                    {getFeaturesOfSelectedLayer($selectedLayerIdStore)?.length || 0}
                  {:else}
                    0
                  {/if}
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Feature Types:</span>
                <span class="detail-value">
                  {#if $selectedLayerIdStore}
                    <button 
                      class="feature-types-toggle"
                      on:click={() => showFeatureTypes = !showFeatureTypes}
                    >
                      <i class="fas fa-chevron-{showFeatureTypes ? 'up' : 'down'}"></i>
                    </button>
                  {:else}
                    None
                  {/if}
                </span>
              </div>
              
              {#if showFeatureTypes && $selectedLayerIdStore && featureTypeBreakdown.length > 0}
                <div class="feature-types-breakdown">
                  {#each featureTypeBreakdown as [type, count]}
                    <div class="feature-type-item">
                      <span class="feature-type-name">{type}</span>
                      <span class="feature-type-count">{count}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <p>Content for {selectedExportTab} export will go here.</p>
        {/if}
      </div>
      
      <div class="export-button-container">
        <Button 
          iconClass="fas fa-download"
          label="Export"
          onClick={handleExport}
          width="120px"
          height="36px"
        />
      </div>
    </div>
  </div>
</Modal>


