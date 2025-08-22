<script lang="ts">
  import { onMount } from "svelte";
  import { createMapLayer, mapLayers, removeMapLayer, renameMapLayer, setMapLayerVisibility, initMapLayersFromDBOnce } from "../../../../../utils/mapLayerUtils";
  import { getMap } from "../../../../../utils/mapUtils";
  import LayersPanel from "./shared/LayersPanel.svelte";
  import Modal from "$lib/common/Modal.svelte";
  import { storeMapLayer, deleteMapLayerById, storeMapLayerOrder, retrieveMapLayerOrder } from "../../../../../utils/saveLayers";
  type Layer = { id: string; name: string; visible: boolean };

  let layers: Layer[] = [];
  let selectedLayerId: string | null = null;

  let showDeleteConfirm = false;
  let inputValue = "";

  // Add-map modal state
  let showAddMapModal = false;
  let newMapName = "";
  let newMapUrl = "";
  let newMapMaxZoom = "18";
  const xyzUrlPlaceholder = "https://.../{z}/{x}/{y}.png";

  onMount(async () => {
    await initMapLayersFromDBOnce();
    const ids = Object.keys(mapLayers);
    const savedOrder = await retrieveMapLayerOrder().catch(() => null);
    const orderedIds = Array.isArray(savedOrder) && savedOrder.length ? savedOrder.filter((id) => ids.includes(id)) : ids;
    // Append any new ids not present in saved order
    const missing = ids.filter((id) => !orderedIds.includes(id));
    const finalIds = [...orderedIds, ...missing];
    layers = finalIds.map((id) => ({
      id,
      name: (mapLayers[id] as any).get("name") ?? id,
      visible: mapLayers[id].getVisible(),
    }));
    selectedLayerId = layers[0]?.id ?? null;
  });

  function handleSelectLayer(id: string) {
    selectedLayerId = id;
  }

  function createMap() {
    const fallbackName = `Basemap ${layers.length + 1}`;
    newMapName = fallbackName;
    newMapUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    newMapMaxZoom = "18";
    showAddMapModal = true;
  }

  function cancelAddMap() {
    showAddMapModal = false;
  }

  function confirmAddMap() {
    const name = (newMapName || "").trim() || `Basemap ${layers.length + 1}`;
    const url = (newMapUrl || "").trim();
    const parsed = parseInt(newMapMaxZoom, 10);
    const maxZoom = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 24)) : 18;

    if (!url) {
      return;
    }

    const layer = createMapLayer(name, { map: getMap() }, { url, maxZoom });
    const id = layer.get("id") as string;
    layers = [...layers, { id, name, visible: true }];
    selectedLayerId = id;
    // persist
    storeMapLayer(layer).catch(() => {});
    storeMapLayerOrder(layers.map((l) => l.id)).catch(() => {});
    showAddMapModal = false;
  }

  function toggleVisibility(layer: Layer, event: Event) {
    event.stopPropagation();
    const nextVisible = !layer.visible;
    setMapLayerVisibility(layer.id, nextVisible);
    layers = layers.map((l) => (l.id === layer.id ? { ...l, visible: nextVisible } : l));
  }

  function handleInput(event: any) {
    inputValue = event.target.value;
  }

  function handleBlur(id: string) {
    const newName = inputValue.trim();
    if (!newName) return;
    renameMapLayer(id, newName);
    layers = layers.map((l) => (l.id === id ? { ...l, name: newName } : l));
    // persist rename
    const layer = mapLayers[id];
    if (layer) {
      storeMapLayer(layer).catch(() => {});
    }
  }

  function deleteLayer() {
    if (!selectedLayerId) return;
    const currentIndex = layers.findIndex((l) => l.id === selectedLayerId);
    // delete from DB then remove from map
    deleteMapLayerById(selectedLayerId).catch(() => {});
    removeMapLayer(selectedLayerId, { map: getMap() });
    layers = layers.filter((l) => l.id !== selectedLayerId);
    if (layers.length > 0) {
      const nextIndex = Math.min(currentIndex, layers.length - 1);
      selectedLayerId = layers[nextIndex].id;
    } else {
      selectedLayerId = null;
    }
    storeMapLayerOrder(layers.map((l) => l.id)).catch(() => {});
    showDeleteConfirm = false;
  }

  const showDelete = () => (showDeleteConfirm = true);
  const cancelDelete = () => (showDeleteConfirm = false);
  const handleInputClick = (e: any) => e.stopPropagation();

  function moveItem<T>(arr: T[], from: number, to: number): T[] {
    const next = arr.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  function applyTileOrderOnMap(newOrderIds: string[]) {
    const map = getMap();
    const olLayers = map.getLayers();
    newOrderIds.forEach((id) => {
      const layer = mapLayers[id];
      if (layer) olLayers.remove(layer);
    });
    [...newOrderIds].reverse().forEach((id) => {
      const layer = mapLayers[id];
      if (layer) olLayers.insertAt(0, layer);
    });
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    layers = moveItem(layers, fromIndex, toIndex);
    applyTileOrderOnMap(layers.map((l) => l.id));
    storeMapLayerOrder(layers.map((l) => l.id)).catch(() => {});
  }
</script>

<LayersPanel
  {layers}
  {selectedLayerId}
  {showDeleteConfirm}
  showImportButton={false}
  showExportButton={false}
  onSelectLayer={handleSelectLayer}
  onToggleVisibility={(l, e) => toggleVisibility(l, e)}
  onAddLayer={createMap}
  onShowDelete={showDelete}
  onCancelDelete={cancelDelete}
  onDelete={deleteLayer}
  onNameInputClick={handleInputClick}
  onNameInput={handleInput}
  onNameBlur={(id) => handleBlur(id)}
  enableDrag={true}
  onReorder={handleReorder}
/>

<Modal title="Add XYZ Tile Layer" show={showAddMapModal} on:close={cancelAddMap}>
  <div class="import-confirm">
    <div class="field">
      <label for="map-name">Name</label>
      <input id="map-name" type="text" bind:value={newMapName} />
    </div>
    <div class="field">
      <label for="map-url">XYZ URL</label>
      <input id="map-url" type="text" bind:value={newMapUrl} placeholder={xyzUrlPlaceholder} />
    </div>
    <div class="field">
      <label for="map-maxzoom">Max zoom</label>
      <input id="map-maxzoom" type="number" min="0" max="24" bind:value={newMapMaxZoom} />
    </div>
    <div class="actions">
      <button class="cancel" on:click={cancelAddMap}>Cancel</button>
      <button class="confirm" on:click={confirmAddMap}>Create</button>
    </div>
  </div>
</Modal>

<style lang="scss">
  :global(.window .content) {
    overflow: hidden;
  }
</style>
