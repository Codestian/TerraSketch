<script lang="ts">
  import "@fortawesome/fontawesome-free/css/all.css";
  import {
    featureContextMenuState,
    hideFeatureContextMenu,
  } from "../../stores/featureContextMenuStore";
  import { tick } from "svelte";
  import { vectorLayers } from "../../utils/vectorLayerUtils";
  import type VectorLayer from "ol/layer/Vector";

  function onBackgroundClick() {
    hideFeatureContextMenu();
  }

  function onBackgroundKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      hideFeatureContextMenu();
    }
  }

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  function parseValue(input: string): unknown {
    const trimmed = input.trim();
    if (trimmed === "") return "";
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (
      !Number.isNaN(Number(trimmed)) &&
      trimmed.match(/^[-+]?(?:\d+\.?\d*|\d*\.\d+)$/)
    ) {
      return Number(trimmed);
    }
    try {
      const json = JSON.parse(trimmed);
      if (typeof json === "object") return json;
    } catch {}
    return input;
  }

  function rebuildPropertiesFromFeature() {
    const f = $featureContextMenuState.feature;
    if (!f) return;
    const props = { ...(f as any).getProperties() } as Record<string, unknown>;
    delete (props as any).geometry;
    featureContextMenuState.update((s) => ({ ...s, properties: props }));
  }

  function ensureUniqueKey(base: string): string {
    const props = $featureContextMenuState.properties;
    if (!props[base]) return base;
    let i = 1;
    while (props[`${base}_${i}`] !== undefined) i++;
    return `${base}_${i}`;
  }

  function onKeyEdit(oldKey: string, newKeyRaw: string) {
    const f = $featureContextMenuState.feature;
    const newKey = newKeyRaw.trim();
    if (!f || !oldKey || !newKey || newKey === "geometry") return;

    if (oldKey === newKey) return;

    const props = $featureContextMenuState.properties;
    let finalKey = newKey;
    if (props[newKey] !== undefined) {
      finalKey = ensureUniqueKey(newKey);
    }

    const value = (f as any).get(oldKey);
    (f as any).set(finalKey, value);
    (f as any).unset(oldKey, true);

    // Propagate rename across all features in the same layer
    const layer = getLayerForFeature(f);
    const source = layer?.getSource?.();
    const features = source?.getFeatures?.() ?? [];
    for (const other of features) {
      if (other === f) continue;
      const hasOld = (other as any).get(oldKey) !== undefined;
      if (hasOld) {
        const hasNew = (other as any).get(finalKey) !== undefined;
        if (!hasNew) {
          (other as any).set(finalKey, (other as any).get(oldKey));
        }
        (other as any).unset(oldKey, true);
      }
    }
    rebuildPropertiesFromFeature();
  }

  function onValueEdit(key: string, newVal: string) {
    const f = $featureContextMenuState.feature;
    if (!f || !key) return;
    const typed = parseValue(newVal);
    (f as any).set(key, typed);
    rebuildPropertiesFromFeature();
  }

  function addProperty() {
    const f = $featureContextMenuState.feature;
    if (!f) return;
    const key = ensureUniqueKey("property");
    (f as any).set(key, "");

    // Also add the key to all other features in the same layer (with empty value)
    const layer = getLayerForFeature(f);
    const source = layer?.getSource?.();
    const features = source?.getFeatures?.() ?? [];
    for (const other of features) {
      if (other !== f && (other as any).get(key) === undefined) {
        (other as any).set(key, "");
      }
    }

    rebuildPropertiesFromFeature();
  }

  function removeProperty(key: string) {
    const f = $featureContextMenuState.feature;
    if (!f || !key) return;
    (f as any).unset(key, true);

    // Also remove the key from all other features in the same layer
    const layer = getLayerForFeature(f);
    const source = layer?.getSource?.();
    const features = source?.getFeatures?.() ?? [];
    for (const other of features) {
      if ((other as any).get && (other as any).get(key) !== undefined) {
        (other as any).unset(key, true);
      }
    }

    rebuildPropertiesFromFeature();
  }

  function handleKeyChange(oldKey: string, event: Event) {
    const input = event.target as HTMLInputElement;
    onKeyEdit(oldKey, input?.value ?? "");
  }

  function handleValueChange(key: string, event: Event) {
    const input = event.target as HTMLInputElement;
    onValueEdit(key, input?.value ?? "");
  }

  let newKey = "";
  let newValue = "";
  let propertiesTableEl: HTMLDivElement | null = null;

  function getLayerForFeature(feature: any): VectorLayer | null {
    for (const id in vectorLayers) {
      const layer = vectorLayers[id];
      const source = layer?.getSource?.();
      if (source && source.hasFeature && source.hasFeature(feature)) {
        return layer as unknown as VectorLayer;
      }
    }
    return null;
  }

  async function submitNewProperty() {
    const f = $featureContextMenuState.feature;
    if (!f) return;

    const trimmedKey = newKey.trim();
    if (!trimmedKey || trimmedKey === "geometry") return;

    const props = $featureContextMenuState.properties;
    const finalKey =
      props[trimmedKey] !== undefined
        ? ensureUniqueKey(trimmedKey)
        : trimmedKey;

    const typedVal = parseValue(newValue);
    (f as any).set(finalKey, typedVal);

    // Also add the new key to all other features in the same layer
    // If the input has a non-empty value, propagate that same value; otherwise set empty string
    const layer = getLayerForFeature(f);
    const source = layer?.getSource?.();
    const features = source?.getFeatures?.() ?? [];
    const hasNonEmptyInput = newValue.trim().length > 0;
    const propagatedValue = hasNonEmptyInput ? typedVal : "";
    for (const other of features) {
      if (other !== f && (other as any).get(finalKey) === undefined) {
        (other as any).set(finalKey, propagatedValue);
      }
    }

    rebuildPropertiesFromFeature();
    await tick();
    propertiesTableEl?.scrollTo({
      top: propertiesTableEl.scrollHeight,
      behavior: "smooth",
    });
    newKey = "";
    newValue = "";
  }
</script>

{#if $featureContextMenuState.visible}
  <div
    class="context-menu-overlay"
    role="button"
    tabindex="0"
    aria-label="Close feature context menu"
    on:click={onBackgroundClick}
    on:keydown={onBackgroundKeydown}
  ></div>

  <div
    class="context-menu"
    style="left: {$featureContextMenuState.x}px; top: {$featureContextMenuState.y}px;"
  >
    <div class="context-menu-content">
      <div class="properties-table" bind:this={propertiesTableEl}>
        <table>
          <thead>
            <tr>
              <th class="key">Key</th>
              <th class="value">Value</th>
              <th class="actions"></th>
            </tr>
          </thead>
          <tbody>
            {#each Object.entries($featureContextMenuState.properties) as [key, val] (key)}
              <tr>
                <td class="key">
                  <input value={key} on:change={(e) => handleKeyChange(key, e)} />
                </td>
                <td class="value">
                  <input
                    value={formatValue(val)}
                    on:change={(e) => handleValueChange(key, e)}
                  />
                </td>
                <td class="actions">
                  <button
                    class="delete-btn"
                    aria-label="Delete property"
                    title="Delete property"
                    on:click={() => removeProperty(key)}
                  >
                    <i class="fas fa-trash-can"></i>
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="add-property-section">
        <form class="add-form" on:submit|preventDefault={submitNewProperty}>
          <table class="add-property-table">
            <tbody>
              <tr>
                <td><input placeholder="Key" bind:value={newKey} /></td>
                <td><input placeholder="Value" bind:value={newValue} /></td>
                <td>
                  <button
                    type="submit"
                    class="add-btn"
                    aria-label="Add property"
                    title="Add property"
                    disabled={!newKey.trim()}
                  >
                    <i class="fas fa-plus"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </form>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .context-menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: transparent;
  }
  .context-menu {
    position: fixed;
    z-index: 1001;
    background: rgb(23, 25, 26);
    color: #eaeaea;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    min-width: 320px;
    max-width: 520px;
    max-height: 60vh;
    overflow: auto;
    font-family: Arial, sans-serif;
  }
  .context-menu-content {
    

    .properties-table {
      max-height: 160px;
      overflow-y: scroll;
      border: 1px solid rgba(255, 255, 255, 0.1);
      
      &::-webkit-scrollbar {
        width: 8px;
      }
      
      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      
      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        transition: background 0.3s ease;
        
        &:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      }
      
      &::-webkit-scrollbar-corner {
        background: transparent;
      }
      
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
      
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;

        th {
          background: rgb(23, 25, 26);
          padding: 8px;
          text-align: left;
          font-weight: bold;
          color: #ccc;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 0.7rem;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        td {
          padding: 4px;
          vertical-align: middle;

          input {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid #444;
            font-size: 0.8rem;
            background: #2a2a2a;
            color: white;
            transition: border-color 0.3s ease;

            &:focus {
              outline: none;
              border-color: #007acc;
            }

            &:hover {
              border-color: #555;
            }
          }

          .delete-btn {
            background: rgb(201, 29, 29);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.3s ease;

            &:hover {
              background: darkred;
            }
          }
        }
      }
    }

    .add-property-section {
      

      .add-property-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;

        th {
          background: rgba(255, 255, 255, 0.05);
          padding: 8px;
          text-align: left;
          font-weight: bold;
          color: #ccc;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 0.7rem;
          display: none; /* Hide the headers */
        }

        td {
          padding: 4px;
          vertical-align: middle;

          input {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid #444;
            font-size: 0.8rem;
            background: #2a2a2a;
            color: white;
            transition: border-color 0.3s ease;

            &:focus {
              outline: none;
              border-color: #007acc;
            }

            &:hover {
              border-color: #555;
            }

            &::placeholder {
              color: #666;
            }
          }

          .add-btn {
            background: green;
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.3s ease;
            margin-right: 12px; // Align with delete button

            &:hover {
              background: #388e3c;
            }

            &:disabled {
              background: #666;
              cursor: not-allowed;
            }
          }
        }
      }
    }
  }
</style>
