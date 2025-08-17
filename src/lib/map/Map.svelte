<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { initializeMap } from "../../utils/mapUtils";
  import {
    initializeKeyboardListeners,
    removeKeyboardListeners,
  } from "../../utils/keyboardUtils";
  import { storeLayers } from "../../utils/saveLayers";
  import { attributionText } from "../../utils/mapUtils";

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
        <table class="shortcuts-table">
          <tr>
            <td class="key">Alt + 🖱️</td>
            <td class="description">Rotate freely</td>
          </tr>
          <tr>
            <td class="key">Alt + Q/E</td>
            <td class="description">Rotate 90°</td>
          </tr>
          <tr>
            <td class="key">Alt + W/S</td>
            <td class="description">Flip vertically</td>
          </tr>
          <tr>
            <td class="key">Alt + A/D</td>
            <td class="description">Flip horizontally</td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .map-container {
    flex: 1;
    height: 100%;
    position: relative;

    .info {
      position: absolute;
      bottom: 0;
      left: 0;
      z-index: 5;
      margin: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      background: rgba(255, 255, 255, 0.8);
      padding: 12px;

        .keyboard-shortcuts {
          .shortcuts-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.8rem;

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
                border-radius: 3px;
                font-family: "Courier New", monospace;
                font-weight: 600;
                color: #333;
                min-width: 80px;
                text-align: center;
                margin-right: 8px;
              }

              &.description {
                color: #555;
                padding-left: 8px;
              }
            }
          }
        }
      
    }

    .save {
      position: absolute;
      z-index: 5;
      top: 0;
      left: 0;
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
