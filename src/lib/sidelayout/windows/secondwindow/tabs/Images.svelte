<script lang="ts">
  import LayersPanel from "./shared/LayersPanel.svelte";
  import { onMount } from "svelte";
  import { getMap } from "../../../../../utils/mapUtils";
  import {
    createImageLayer,
    getActiveImageLayerOpacity,
    setActiveImageLayerOpacity,
    imageLayers,
    activeImageLayerId,
    setActiveImageLayer,
    setImageLayerVisibility,
    reorderImageLayers,
    storeAllImageLayers,
    restoreAllImageLayers,
    deleteImageLayer,
  } from "../../../../../utils/imageLayerUtils";
  import { imagesTabActive } from "../../../../../stores/uiStore";

  type Layer = { id: string; name: string; visible: boolean };

  let layers: Layer[] = [];
  let selectedLayerId: string | null = null;
  let fileInput: HTMLInputElement;
  let opacity: number = getActiveImageLayerOpacity() ?? 1;
  let showDeleteConfirm = false;

  function refreshLayersList() {
    const map = getMap();
    if (!map) return;
    
    // Get layers in their actual map order
    const mapLayers = map.getLayers().getArray();
    const orderedImageLayers = mapLayers.filter(layer => 
      Object.values(imageLayers).includes(layer as any)
    );
    
    layers = orderedImageLayers.map((layer) => {
      const ol = layer as any;
      const id = ol.get("id");
      return {
        id,
        name: ol?.get?.("name") ?? id,
        visible: ol.getVisible(),
      };
    });
    selectedLayerId = activeImageLayerId;
  }

  onMount(() => {
    refreshLayersList();
    imagesTabActive.set(true);
    
    // Auto-restore is now handled at the app level in SecondWindow
  });

  // When component is destroyed (tab switched), mark as inactive
  import { onDestroy } from "svelte";
  onDestroy(() => {
    imagesTabActive.set(false);
  });

  function addLayer() {
    fileInput?.click();
  }

  function onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const okTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!okTypes.includes(file.type)) {
      alert("Unsupported file type. Please select png, jpeg, jpg, or webp.");
      input.value = "";
      return;
    }
    
    // Convert file to base64 for persistence
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      console.log('File converted to base64:', {
        originalFile: file.name,
        fileSize: file.size,
        fileType: file.type,
        base64Length: base64Data.length,
        base64Start: base64Data.substring(0, 100)
      });
      
      const url = URL.createObjectURL(file);
      
      createImageLayer(
        `Image: ${file.name}`,
        { map: getMap(), fileData: base64Data },
        { url, fileData: base64Data, opacity: 1 },
      );
      opacity = 1;
      refreshLayersList();
      input.value = "";
      
      // Auto-save after adding a layer (immediate save for new layers)
      storeAllImageLayers().catch(err => {
        console.error('Failed to auto-save after adding layer:', err);
      });
    };
    
    reader.onerror = () => {
      alert("Failed to read the file. Please try again.");
      input.value = "";
    };
    
    reader.readAsDataURL(file);
  }

  function handleSelectLayer(id: string) {
    setActiveImageLayer(id);
    selectedLayerId = id;
    opacity = getActiveImageLayerOpacity() ?? 1;
  }

  function handleToggleVisibility(layer: Layer, e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    setImageLayerVisibility(layer.id, checked);
    refreshLayersList();
    
    // Auto-save is now handled by setImageLayerVisibility function
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    reorderImageLayers(fromIndex, toIndex);
    refreshLayersList();
    
    // Auto-save is now handled by reorderImageLayers function
  }

  async function deleteLayer() {
    if (!selectedLayerId) return;
    try {
      await deleteImageLayer(selectedLayerId);
      refreshLayersList();
      opacity = getActiveImageLayerOpacity() ?? 1;
    } catch (error) {
      console.error('Failed to delete image layer:', error);
      alert('Failed to delete image layer. Check console for details.');
    }
    showDeleteConfirm = false;
  }

  const showDelete = () => (showDeleteConfirm = true);
  const cancelDelete = () => (showDeleteConfirm = false);


</script>

<input
  type="file"
  bind:this={fileInput}
  accept="image/png, image/jpeg, image/jpg, image/webp"
  on:change={onFileChange}
  style="display: none"
/>

<LayersPanel
  {layers}
  {selectedLayerId}
  {showDeleteConfirm}
  showImportButton={false}
  showExportButton={false}
  enableDrag={true}
  showOpacitySlider={true}
  {opacity}
  onOpacityChange={(newOpacity) => {
    setActiveImageLayerOpacity(newOpacity);
    // Auto-save is now handled by setActiveImageLayerOpacity function
  }}
  onAddLayer={addLayer}
  onSelectLayer={handleSelectLayer}
  onToggleVisibility={handleToggleVisibility}
  onReorder={handleReorder}
  onShowDelete={showDelete}
  onCancelDelete={cancelDelete}
  onDelete={deleteLayer}
/>

<!-- Removed opacity slider - now handled by LayersPanel -->
