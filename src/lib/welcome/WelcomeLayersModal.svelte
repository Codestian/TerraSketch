<script lang="ts">
  import "@fortawesome/fontawesome-free/css/all.css";
  import Modal from "../common/Modal.svelte";
  import {
    layers,
    vectorLayersHydrated,
    addEmptyVectorLayer,
  } from "../../stores/layersStore";
  import { openImportConfirm } from "../../stores/geoImportConfirmStore";

  /** In-memory only: reload clears this so the prompt can show again when there are no layers. */
  let dismissed = false;
  /**
   * Once the user has had at least one layer this page load (from DB or created),
   * do not show welcome again if they delete all layers — only a full refresh with an empty list should show it.
   */
  let hadLayersThisSession = false;
  let fileInput: HTMLInputElement;

  $: if ($layers.length > 0) {
    hadLayersThisSession = true;
  }

  function dismiss() {
    dismissed = true;
  }

  function onCreateLayer() {
    addEmptyVectorLayer();
  }

  function triggerImport() {
    fileInput?.click();
  }

  function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      dismiss();
      openImportConfirm(file);
    }
    input.value = "";
  }

  $: showModal =
    $vectorLayersHydrated &&
    $layers.length === 0 &&
    !dismissed &&
    !hadLayersThisSession;
</script>

<Modal title="Get started" show={showModal} on:close={dismiss}>
  <div class="welcome-body">
    <p class="welcome-text">
      Create a new layer to start drawing, or import GeoJSON or KML.
    </p>
    <div class="welcome-actions">
      <button type="button" class="welcome-tile" on:click={onCreateLayer}>
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        <span>New layer</span>
      </button>
      <button type="button" class="welcome-tile" on:click={triggerImport}>
        <i class="fas fa-download" aria-hidden="true"></i>
        <span>Import</span>
      </button>
      <input
        type="file"
        accept=".geojson,.json,.kml,.kmz,application/geo+json,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
        bind:this={fileInput}
        on:change={onFileChange}
        style="display: none;"
        aria-hidden="true"
      />
    </div>
  </div>
</Modal>

<style lang="scss">
  .welcome-body {
    padding: 16px;
    color: white;
  }

  .welcome-text {
    margin: 0 0 16px;
    font-size: 0.85rem;
    line-height: 1.4;
    opacity: 0.9;
  }

  .welcome-actions {
    width: 100%;
    display: flex;
    flex-direction: row;
    justify-content: space-around;
    gap: 12px;
    user-select: none;
  }

  /* Match LayersPanel Import / Export (WindowButton) look; 2:3 width:height tiles, side by side */
  .welcome-tile {
    flex: 1 1 0;
    min-width: 0;
    aspect-ratio: 2 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 8px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 0.7rem;
    cursor: pointer;
    transition: background-color 0.3s ease;

    i {
      font-size: 1.35rem;
    }

    span {
      text-align: center;
      line-height: 1.2;
    }

    &:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
  }

</style>
