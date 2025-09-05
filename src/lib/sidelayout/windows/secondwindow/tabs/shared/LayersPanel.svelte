<script lang="ts">
  import WindowButton from "$lib/common/WindowButton.svelte";
  import Modal from "$lib/common/Modal.svelte";

  interface Layer {
    id: string;
    name: string;
    visible: boolean;
  }

  export let layers: Layer[] = [];
  export let selectedLayerId: string | null = null;
  export let showDeleteConfirm: boolean = false;
  export let showModal: boolean = false;
  export let selectedOption: string = "Schematic";
  export let selectedVersion: string = "2";
  export let exportLength: number = 0;
  export let exportWidth: number = 0;
  export let exportHeight: number = 0;
  export let isOffsetEnabled: boolean = false;
  export let showImportConfirm: boolean = false;
  export let showImportProgress: boolean = false;
  export let importErrorMessage: string | null = null;
  export let blockName: string = "diamond_block";
  export let elevationValue: string = "0";
  export let onElevationChange: (value: string) => void = () => {};

  export let pendingImportFileName: string = "";
  export let pendingImportFileSize: number = 0;
  export let disabled: boolean = false;
  export let showImportButton: boolean = true;
  export let showExportButton: boolean = true;
  export let enableDrag: boolean = false;

  export let onExportClick: () => void = () => {};
  export let onSelectLayer: (id: string) => void = () => {};
  export let onToggleVisibility: (layer: Layer, e: Event) => void = () => {};
  export let onAddLayer: () => void = () => {};
  export let onShowDelete: () => void = () => {};
  export let onCancelDelete: () => void = () => {};
  export let onDelete: () => void = () => {};
  export let onNameInputClick: (e: any) => void = () => {};
  export let onNameInput: (e: any) => void = () => {};
  export let onNameBlur: (id: string) => void = () => {};
  export let onHandleImport: (e: Event) => void = () => {};
  export let onCloseImportConfirm: () => void = () => {};
  export let onConfirmImport: () => void = () => {};
  export let onToggleModal: () => void = () => {};
  export let onSelectOption: (opt: string) => void = () => {};
  export let onVersionChange: (e: any) => void = () => {};
  export let onToggleOffset: () => void = () => {};
  export let onDownloadGeojson: () => void = () => {};
  export let onCreateSchematic: () => void = () => {};
  export let onCloseImportError: () => void = () => {};
  export let onReorder: (fromIndex: number, toIndex: number) => void = () => {};
  
  // Opacity-related props
  export let showOpacitySlider: boolean = false;
  export let opacity: number = 1;
  export let onOpacityChange: (opacity: number) => void = () => {};

  let fileInput: HTMLInputElement;
  function triggerFileInput() {
    if (disabled) return;
    if (fileInput) fileInput.click();
  }

  function handleFileChange(e: Event) {
    onHandleImport(e);
    const input = e.target as HTMLInputElement | null;
    if (input) input.value = "";
  }

  let dragIndex: number | null = null;
</script>

<div class="layers-manager">
  {#if showImportButton || showExportButton}
    <div class="row">
      {#if showImportButton}
        <WindowButton
          onClick={triggerFileInput}
          iconClass="fas fa-download"
          label="Import"
          width="auto"
          flexGrow={true}
        />
      {/if}
      {#if showExportButton}
        <WindowButton
          onClick={() => { if (!disabled) onExportClick(); }}
          iconClass="fas fa-upload"
          label="Export"
          width="auto"
          flexGrow={true}
        />
      {/if}
      {#if showImportButton}
        <input
          type="file"
          accept=".geojson"
          on:change={handleFileChange}
          bind:this={fileInput}
          style="display: none;"
          disabled={disabled}
        />
      {/if}
    </div>
  {/if}
  <div class="list {showDeleteConfirm ? 'dimmed' : ''}">
    {#each layers as layer, index (layer.id)}
      <div
        class="layer-item {selectedLayerId === layer.id ? 'selected' : ''}"
        draggable={enableDrag && !disabled}
        on:dragstart={(e) => {
          if (disabled || !enableDrag) return;
          dragIndex = index;
          e.dataTransfer?.setData('text/plain', String(index));
        }}
        on:dragover={(e) => { if (enableDrag && !disabled) e.preventDefault(); }}
        on:drop={(e) => {
          if (!enableDrag || disabled) return;
          e.preventDefault();
          const toIndex = index;
          if (dragIndex !== null && dragIndex !== toIndex) {
            onReorder(dragIndex, toIndex);
          }
          dragIndex = null;
        }}
        on:dragend={() => { dragIndex = null; }}
        on:click={() => onSelectLayer(layer.id)}
        on:keydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); onSelectLayer(layer.id); } }}
        role="button"
        tabindex="0"
      >
        <input
          class="layer-name-input"
          type="text"
          value={layer.name}
          on:click={onNameInputClick}
          on:blur={() => onNameBlur(layer.id)}
          on:input={onNameInput}
          readonly={disabled}
        />
        <div class="right-controls">
          <input
            type="checkbox"
            on:click={(event) => {
              event.stopPropagation();
              if (!disabled) onToggleVisibility(layer, event);
            }}
            checked={layer.visible}
            disabled={disabled}
          />
          {#if enableDrag}
            <button class="drag-handle" title="Drag to reorder" aria-label="Drag" tabindex="-1" on:mousedown={(e) => e.stopPropagation()}>
              <i class="fas fa-grip-vertical"></i>
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
  
  {#if showOpacitySlider}
    <div class="opacity-control">
      <label for="layer-opacity">Layer Opacity: {opacity.toFixed(2)}</label>
      <input
        id="layer-opacity"
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={opacity}
        on:input={() => onOpacityChange(+opacity)}
        style="width: 100%;"
      />
    </div>
  {/if}
  
  <div class="controls">
    <button on:click={() => { if (!disabled) onAddLayer(); }} disabled={disabled}><i class="fas fa-plus"></i></button>
    
    <div class="delete-container">
      <div class="delete-confirmation {showDeleteConfirm ? 'show' : ''}">
        <span class="confirm-text">Confirm delete layer?</span>
        <div class="confirm-buttons">
          <button class="confirm-yes" on:click={onDelete}>Yes</button>
          <button class="confirm-no" on:click={onCancelDelete}>No</button>
        </div>
      </div>
      
      <button 
        on:click={onShowDelete} 
        disabled={disabled || !selectedLayerId}
        class="delete-btn"
      >
        <i class="fas fa-trash-can"></i>
      </button>
    </div>
  </div>
</div>

{#if showExportButton}
<Modal title="Export" show={showModal} on:close={onToggleModal}>
  <div class="export-row">
    <div
      class="option {selectedOption === 'Schematic' ? 'selected' : ''}"
      on:click={() => onSelectOption("Schematic")}
      on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectOption('Schematic'); } }}
      role="button"
      tabindex="0"
      aria-pressed={selectedOption === 'Schematic'}
    >
      Schematic
    </div>
    <div
      class="option {selectedOption === 'GeoJSON' ? 'selected' : ''}"
      on:click={() => onSelectOption("GeoJSON")}
      on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectOption('GeoJSON'); } }}
      role="button"
      tabindex="0"
      aria-pressed={selectedOption === 'GeoJSON'}
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
          on:change={onVersionChange}
          disabled={disabled}
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
      </div>
      <div>
        <label for="asean-offset">ASEAN offset</label>
        <input
          id="asean-offset"
          type="checkbox"
          checked={isOffsetEnabled}
          on:click={(e) => { e.stopPropagation(); if (!disabled) onToggleOffset(); }}
          disabled={disabled}
        />
      </div>
      <button on:click={onCreateSchematic} class="export-btn" disabled={disabled}>Export</button>
    {/if}

    {#if selectedOption === "GeoJSON"}
      <button on:click={onDownloadGeojson} class="export-btn" disabled={disabled}>Export</button>
    {/if}

    {#if !selectedOption}
      <p>Please select an option above to see the content.</p>
    {/if}
  </div>
</Modal>
{/if}

{#if showImportButton}
<Modal title="Import GeoJSON" show={showImportConfirm} on:close={onCloseImportConfirm}>
  <div class="import-confirm">
    <p>Do you want to import the file:</p>
    <p class="filename">{pendingImportFileName}</p>
    <p class="filesize">
      Size: {pendingImportFileSize ? (pendingImportFileSize / (1024 * 1024)).toFixed(2) : '0'} MB
    </p>
    <div class="field">
      <label for="default-block">Default block</label>
      <input id="default-block" type="text" bind:value={blockName} disabled={disabled} />
    </div>
    <div class="field">
      <label for="default-elevation">Default elevation (for 2D coordinates)</label>
      <input 
        id="default-elevation" 
        type="number" 
        step="0.1" 
        bind:value={elevationValue} 
        on:input={() => onElevationChange(elevationValue)}
        disabled={disabled} 
      />
    </div>

    <div class="actions">
      <button class="cancel" on:click={onCloseImportConfirm}>Cancel</button>
      <button class="confirm" on:click={onConfirmImport} disabled={disabled}>Import</button>
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
  <Modal title="Import Error" show={true} on:close={onCloseImportError}>
    <div class="import-error">
      <p>{importErrorMessage}</p>
      <div class="actions">
        <button class="confirm" on:click={onCloseImportError}>Close</button>
      </div>
    </div>
  </Modal>
{/if}
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

        .right-controls {
          display: flex;
          align-items: center;
          gap: 6px;

          .drag-handle {
            background: rgba(0, 0, 0, 0.4);
            border: none;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            cursor: grab;
            padding: 0;
          }
          .drag-handle:active {
            cursor: grabbing;
          }

          input[type="checkbox"] {
            cursor: pointer;
            appearance: none;
            width: 24px;
            height: 24px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(0, 0, 0, 0.05);
            position: relative;

            &:checked {
              background: green;
            }

            &:checked:before {
              content: "";
              position: absolute;
              top: 3px;
              left: 8px;
              width: 4px;
              height: 12px;
              border: solid white;
              border-width: 0 2px 2px 0;
              transform: rotate(45deg);
              opacity: 1;
            }
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

  .opacity-control {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 12px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: white;
    font-size: 0.7rem;
    font-weight: bold;
    text-transform: uppercase;

    label {
      margin-bottom: 4px;
    }

    input[type="range"] {
      -webkit-appearance: none;
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      outline: none;
      cursor: pointer;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        background: green;
        border-radius: 50%;
        margin-top: -6px;
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.2);
      }

      &::-moz-range-thumb {
        width: 20px;
        height: 20px;
        background: green;
        border-radius: 50%;
        box-shadow: 0 0 2px rgba(0, 0, 0, 0.2);
      }
    }
  }
</style>


