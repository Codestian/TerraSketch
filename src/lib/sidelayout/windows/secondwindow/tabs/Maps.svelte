<script lang="ts">
  import { onMount } from "svelte";
  import { createMapLayer, mapLayers, removeMapLayer, renameMapLayer, setMapLayerVisibility, setMapLayerOpacity, getMapLayerOpacity, initMapLayersFromDBOnce } from "../../../../../utils/mapLayerUtils";
  import { getMap } from "../../../../../utils/mapUtils";
  import LayersPanel from "./shared/LayersPanel.svelte";
  import Modal from "$lib/common/Modal.svelte";
  import { storeMapLayer, deleteMapLayerById, storeMapLayerOrder, retrieveMapLayerOrder } from "../../../../../utils/saveLayers";
  type Layer = { id: string; name: string; visible: boolean };

  let layers: Layer[] = [];
  let selectedLayerId: string | null = null;
  let opacity: number = 1;

  let showDeleteConfirm = false;
  let inputValue = "";

  // Add-map modal state
  let showAddMapModal = false;
  /** "templates" = preset URLs; "manual" = custom XYZ URL form */
  let xyzAddTab: "templates" | "manual" = "templates";
  let selectedTemplateId = "osm";
  let newMapName = "";
  let newMapUrl = "";
  let newMapMaxZoom = "18";
  const xyzUrlPlaceholder = "https://.../{z}/{x}/{y}.png";

  /** Persisted order is bottom → top; UI list is top → bottom (newest first). */
  function mapLayerOrderForStorage(uiTopFirst: Layer[]): string[] {
    return [...uiTopFirst].reverse().map((l) => l.id);
  }

  const XYZ_TILE_TEMPLATES = [
    {
      id: "osm",
      label: "OpenStreetMap",
      detail: "Global map · max zoom 18",
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      maxZoom: 18,
      defaultName: "OpenStreetMap",
    },
    {
      id: "onemap",
      label: "OneMap Default",
      detail: "Singapore · max zoom 19",
      url: "https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png",
      maxZoom: 19,
      defaultName: "OneMap",
    },
    {
      id: "onemap-satellite",
      label: "OneMap Satellite",
      detail: "Singapore · max zoom 19",
      url: "https://www.onemap.gov.sg/maps/tiles/Satellite/{z}/{x}/{y}.png",
      maxZoom: 19,
      defaultName: "OneMap Satellite",
    },
  ] as const;

  onMount(async () => {
    await initMapLayersFromDBOnce();
    const ids = Object.keys(mapLayers);
    const savedOrder = await retrieveMapLayerOrder().catch(() => null);
    const orderedIds = Array.isArray(savedOrder) && savedOrder.length ? savedOrder.filter((id) => ids.includes(id)) : ids;
    // Append any new ids not present in saved order
    const missing = ids.filter((id) => !orderedIds.includes(id));
    const finalIds = [...orderedIds, ...missing];
    const bottomToTop = finalIds;
    layers = [...bottomToTop].reverse().map((id) => ({
      id,
      name: (mapLayers[id] as any).get("name") ?? id,
      visible: mapLayers[id].getVisible(),
    }));
    selectedLayerId = layers[0]?.id ?? null;
    if (selectedLayerId) {
      opacity = getMapLayerOpacity(selectedLayerId);
    }
  });

  function handleSelectLayer(id: string) {
    selectedLayerId = id;
    opacity = getMapLayerOpacity(id);
  }

  function createMap() {
    xyzAddTab = "templates";
    selectedTemplateId = "osm";
    newMapName = `Basemap ${layers.length + 1}`;
    newMapUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    newMapMaxZoom = "18";
    showAddMapModal = true;
  }

  function cancelAddMap() {
    showAddMapModal = false;
  }

  function confirmAddMap() {
    let url: string;
    let maxZoom: number;
    let name: string;

    if (xyzAddTab === "templates") {
      const t = XYZ_TILE_TEMPLATES.find((x) => x.id === selectedTemplateId);
      if (!t) return;
      url = t.url;
      maxZoom = t.maxZoom;
      name = t.defaultName;
    } else {
      url = (newMapUrl || "").trim();
      const parsed = parseInt(newMapMaxZoom, 10);
      maxZoom = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 24)) : 18;
      name = (newMapName || "").trim() || `Basemap ${layers.length + 1}`;
    }

    if (!url) {
      return;
    }

    const layer = createMapLayer(name, { map: getMap() }, { url, maxZoom, opacity: 1 });
    const id = layer.get("id") as string;
    layers = [{ id, name, visible: true }, ...layers];
    selectedLayerId = id;
    opacity = 1;
    // persist
    storeMapLayer(layer).catch(() => {});
    storeMapLayerOrder(mapLayerOrderForStorage(layers)).catch(() => {});
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
      opacity = getMapLayerOpacity(selectedLayerId);
    } else {
      selectedLayerId = null;
      opacity = 1;
    }
    storeMapLayerOrder(mapLayerOrderForStorage(layers)).catch(() => {});
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

  /** `newOrderIds` is top → bottom (same as UI). */
  function applyTileOrderOnMap(newOrderIds: string[]) {
    const map = getMap();
    const olLayers = map.getLayers();
    newOrderIds.forEach((id) => {
      const layer = mapLayers[id];
      if (layer) olLayers.remove(layer);
    });
    newOrderIds.forEach((id) => {
      const layer = mapLayers[id];
      if (layer) olLayers.insertAt(0, layer);
    });
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    layers = moveItem(layers, fromIndex, toIndex);
    applyTileOrderOnMap(layers.map((l) => l.id));
    storeMapLayerOrder(mapLayerOrderForStorage(layers)).catch(() => {});
  }
</script>

<LayersPanel
  {layers}
  {selectedLayerId}
  {showDeleteConfirm}
  showImportButton={false}
  showExportButton={false}
  showOpacitySlider={true}
  {opacity}
  onOpacityChange={(newOpacity) => {
    if (selectedLayerId) {
      setMapLayerOpacity(selectedLayerId, newOpacity);
      // Auto-save is now handled by setMapLayerOpacity function
    }
  }}
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
  <div class="xyz-add-modal">
    <div class="xyz-tabs" role="tablist" aria-label="Add basemap source">
      <button
        type="button"
        class="xyz-tab"
        class:xyz-tab-active={xyzAddTab === "templates"}
        role="tab"
        aria-selected={xyzAddTab === "templates"}
        id="xyz-tab-templates"
        aria-controls="xyz-panel-templates"
        on:click={() => (xyzAddTab = "templates")}
      >
        Templates
      </button>
      <button
        type="button"
        class="xyz-tab"
        class:xyz-tab-active={xyzAddTab === "manual"}
        role="tab"
        aria-selected={xyzAddTab === "manual"}
        id="xyz-tab-manual"
        aria-controls="xyz-panel-manual"
        on:click={() => (xyzAddTab = "manual")}
      >
        Manual
      </button>
    </div>

    {#if xyzAddTab === "templates"}
      <div
        class="xyz-tab-panel"
        id="xyz-panel-templates"
        role="tabpanel"
        aria-labelledby="xyz-tab-templates"
      >
        <p class="xyz-add-lead">
          Choose a preset tile source. More templates can be added later.
        </p>
        <ul class="xyz-template-list">
          {#each XYZ_TILE_TEMPLATES as t (t.id)}
            <li>
              <button
                type="button"
                class="xyz-template-option"
                class:xyz-template-option-selected={selectedTemplateId === t.id}
                on:click={() => {
                  selectedTemplateId = t.id;
                }}
              >
                <span class="xyz-template-option-main">
                  <span class="xyz-template-label">{t.label}</span>
                  <span class="xyz-template-detail">{t.detail}</span>
                </span>
                <span class="xyz-template-badge">max {t.maxZoom}</span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {:else}
      <div
        class="xyz-tab-panel"
        id="xyz-panel-manual"
        role="tabpanel"
        aria-labelledby="xyz-tab-manual"
      >
        <p class="xyz-add-lead">
          Add a raster tile basemap. The server must expose tiles using the standard
          <code>{'{z}'}</code>, <code>{'{x}'}</code>, <code>{'{y}'}</code> placeholders.
        </p>
        <div class="xyz-add-fields">
          <div class="xyz-field">
            <label for="map-name">Display name</label>
            <input
              id="map-name"
              type="text"
              class="xyz-input"
              bind:value={newMapName}
              placeholder="Basemap label in the list"
              autocomplete="off"
            />
          </div>
          <div class="xyz-field">
            <label for="map-url">Tile URL</label>
            <input
              id="map-url"
              type="text"
              class="xyz-input xyz-input-mono"
              bind:value={newMapUrl}
              placeholder={xyzUrlPlaceholder}
              spellcheck="false"
              autocomplete="off"
            />
          </div>
          <div class="xyz-field xyz-field-inline">
            <div class="xyz-field-grow">
              <label for="map-maxzoom">Max zoom</label>
              <input
                id="map-maxzoom"
                type="number"
                class="xyz-input"
                min="0"
                max="24"
                bind:value={newMapMaxZoom}
              />
            </div>
            <p class="xyz-field-inline-hint">
              Highest zoom level supported by the tile set (0–24).
            </p>
          </div>
        </div>
      </div>
    {/if}

    <div class="xyz-add-actions">
      <button type="button" class="xyz-btn xyz-btn-secondary" on:click={cancelAddMap}>
        Cancel
      </button>
      <button
        type="button"
        class="xyz-btn xyz-btn-primary"
        disabled={xyzAddTab === "manual" && !(newMapUrl || "").trim()}
        on:click={confirmAddMap}
      >
        Create layer
      </button>
    </div>
  </div>
</Modal>

<style lang="scss">
  :global(.window .content) {
    overflow: hidden;
  }

  /* Matches Import GeoJSON modal palette in LayersPanel (dark panel, green accent). */
  .xyz-add-modal {
    padding: 16px;
    color: #eaeaea;
    font-size: 0.8rem;
    line-height: 1.45;
    width: 100%;
    box-sizing: border-box;
  }

  .xyz-tabs {
    display: flex;
    gap: 0;
    margin: 0 0 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }

  .xyz-tab {
    flex: 1;
    margin: 0;
    padding: 10px 12px;
    font-size: 0.65rem;
    font-weight: bold;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition:
      color 0.2s ease,
      border-color 0.2s ease,
      background 0.2s ease;

    &:hover {
      color: rgba(255, 255, 255, 0.75);
      background: rgba(255, 255, 255, 0.04);
    }
  }

  .xyz-tab-active {
    color: #fff;
    border-bottom-color: green;
  }

  .xyz-tab-panel {
    min-height: 0;
  }

  .xyz-template-list {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;

    @media (max-width: 420px) {
      grid-template-columns: 1fr;
    }

    > li {
      min-width: 0;
    }
  }

  .xyz-template-option {
    width: 100%;
    height: 100%;
    min-height: 88px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 12px;
    text-align: left;
    color: inherit;
    font: inherit;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition:
      background 0.2s ease,
      border-color 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
    }
  }

  .xyz-template-option-selected {
    border-color: green;
    background: rgba(0, 128, 0, 0.12);
  }

  .xyz-template-option-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .xyz-template-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #fff;
  }

  .xyz-template-detail {
    font-size: 0.62rem;
    color: rgba(255, 255, 255, 0.45);
    letter-spacing: 0.3px;
  }

  .xyz-template-badge {
    align-self: flex-start;
    flex-shrink: 0;
    font-size: 0.55rem;
    font-weight: bold;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 4px 8px;
    color: rgba(255, 255, 255, 0.75);
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .xyz-add-lead {
    margin: 0 0 14px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.7rem;
    letter-spacing: 0.3px;

    code {
      font-size: 0.72rem;
      padding: 1px 5px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.9);
    }
  }

  .xyz-add-fields {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .xyz-field {
    display: flex;
    flex-direction: column;
    gap: 6px;

    label {
      margin: 0;
      font-size: 0.62rem;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.55);
    }
  }

  .xyz-field-inline {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px 16px;
  }

  .xyz-field-grow {
    flex: 0 0 auto;
    min-width: 96px;

    .xyz-input[type="number"] {
      max-width: 120px;
    }
  }

  .xyz-field-inline-hint {
    flex: 1 1 160px;
    margin: 0;
    padding-bottom: 2px;
    font-size: 0.62rem;
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.4);
  }

  .xyz-input {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 0.75rem;
    color: #fff;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.12);
    outline: none;
    transition: border-color 0.2s ease, background 0.2s ease;

    &::placeholder {
      color: rgba(255, 255, 255, 0.35);
    }

    &:focus {
      border-color: green;
      background: rgba(0, 0, 0, 0.45);
    }
  }

  .xyz-input-mono {
    font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace;
    font-size: 0.7rem;
  }

  .xyz-add-actions {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 22px;
    padding-top: 4px;
  }

  .xyz-btn {
    cursor: pointer;
    padding: 8px 16px;
    font-size: 0.65rem;
    font-weight: bold;
    letter-spacing: 2px;
    text-transform: uppercase;
    border: none;
    transition: background-color 0.2s ease, opacity 0.2s ease;
  }

  .xyz-btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.08);

    &:hover {
      background: rgba(255, 255, 255, 0.18);
    }
  }

  .xyz-btn-primary {
    background-color: green;
    color: #fff;
    border-top: 3px solid rgba(255, 255, 255, 0.1);
    border-left: 3px solid rgba(255, 255, 255, 0.1);
    border-bottom: 3px solid rgba(0, 0, 0, 0.3);
    border-right: 3px solid rgba(0, 0, 0, 0.3);

    &:hover:not(:disabled) {
      background-color: rgb(0, 83, 0);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }
</style>
