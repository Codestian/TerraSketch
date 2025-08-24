<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { initializeMap } from "../../utils/mapUtils";
  import {
    initializeKeyboardListeners,
    removeKeyboardListeners,
  } from "../../utils/keyboardUtils";
  import { storeLayers } from "../../utils/saveLayers";
  import { attributionText, hasSelectedFeatures } from "../../utils/mapUtils";
  import ContextMenu from "./ContextMenu.svelte";
  import FeatureContextMenu from "./FeatureContextMenu.svelte";

  let mapContainer: HTMLElement;

  onMount(() => {
    if (mapContainer) {
      initializeMap(mapContainer);
      initializeKeyboardListeners(); // Set up keyboard listeners
    }
  });

  onDestroy(() => {
    removeKeyboardListeners(); // Clean up keyboard listeners
  });
</script>

<div bind:this={mapContainer} class="map-container">
  <button on:click={storeLayers} class="save">Save</button>
  <div class="info">
    <div id="controls">
      <div class="keyboard-shortcuts">
        {#if $hasSelectedFeatures}
          <table class="shortcuts-table-selected">
            <tr>
              <td class="key">Right🖱️</td>
              <td class="description">Edit properties</td>
            </tr>
            <tr>
              <td class="key">Alt + Left🖱️</td>
              <td class="description">Rotate freely</td>
            </tr>
            <tr>
              <td class="key">Alt + Q/E</td>
              <td class="description">Rotate image</td>
            </tr>
            <tr>
              <td class="key">Alt + W/S</td>
              <td class="description">Scale image</td>
            </tr>
            <tr>
              <td class="key">W/A/S/D</td>
              <td class="description">Move image</td>
            </tr>
            <tr>
              <td class="key">Alt + A/D</td>
              <td class="description">Flip horizontally</td>
            </tr>
            <tr>
              <td class="key">Del</td>
              <td class="description">Delete feature</td>
            </tr>
            <tr>
              <td class="key">Shift + Left🖱️</td>
              <td class="description">Select multiple</td>
            </tr>
          </table>
        {:else}
          <table class="shortcuts-table-unselected">
            <tr>
              <td class="key">Left🖱️</td>
              <td class="description">Select one</td>
            </tr>
            <tr>
              <td class="key">Shift + Left🖱️</td>
              <td class="description">Select multiple</td>
            </tr>
            <tr>
              <td class="key">Right🖱️</td>
              <td class="description">Open context menu</td>
            </tr>
          </table>
        {/if}
      </div>
    </div>
  </div>
  <ContextMenu />
  <FeatureContextMenu />
</div>

<style lang="scss">
  .map-container {
    flex: 1;
    height: 100%;
    position: relative;

    .info {
      position: absolute;
      bottom: 0;
      left: 48px;
      z-index: 5;
      margin: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(16px);
      padding: 12px;


      .keyboard-shortcuts {
        table {
          width: 100%;
          border-collapse: collapse;

          tr {
            border-bottom: 1px solid #e0e0e0;

            &:last-child {
              border-bottom: none;
            }
          }

          td {
            padding: 4px 0;
            vertical-align: top;

            &.key {
              background: #f1f3f4;
              padding: 4px 8px;
              font-family: "Courier New", monospace;
              font-weight: bold;
              color: #333;
              min-width: 80px;
              text-align: center;
              margin-right: 8px;
              font-size: 0.9rem;
            }

            &.description {
              color: #555;
              padding-left: 8px;
              font-size: 0.9rem;
            }
          }
        }
      }
    }

    .save {
      position: absolute;
      z-index: 5;
      top: 0;
      left: 48px;
      margin: 12px;
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
</style>
