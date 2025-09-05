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

  function updateElevationInputFromFeature() {
    const f = $featureContextMenuState.feature;
    if (!f) return;
    
    const geometry = f.getGeometry();
    if (!geometry) return;
    
    // Try to get Z coordinate from geometry
    let zValue: number | null = null;
    
    if (geometry.getType() === 'Point') {
      const coords = (geometry as any).getCoordinates();
      if (coords && coords.length >= 3) {
        zValue = coords[2];
      }
    } else if (geometry.getType() === 'LineString') {
      const coords = (geometry as any).getCoordinates();
      if (coords && coords.length > 0 && coords[0].length >= 3) {
        zValue = coords[0][2];
      }
    } else if (geometry.getType() === 'Polygon') {
      const coords = (geometry as any).getCoordinates();
      if (coords && coords.length > 0 && coords[0].length > 0 && coords[0][0].length >= 3) {
        zValue = coords[0][0][2];
      }
    } else if (geometry.getType() === 'MultiPolygon') {
      const coords = (geometry as any).getCoordinates();
      if (coords && coords.length > 0 && coords[0].length > 0 && coords[0][0].length > 0 && coords[0][0][0].length >= 3) {
        zValue = coords[0][0][0][2];
      }
    } else if (geometry.getType() === 'Circle') {
      const center = (geometry as any).getCenter();
      if (center && center.length >= 3) {
        zValue = center[2];
      }
    }
    
    // Update the elevation input with the Z coordinate value
    if (zValue !== null && !isNaN(zValue)) {
      elevationValue = zValue.toString();
      console.log(`Updated elevation input with Z coordinate: ${zValue}`);
    } else {
      elevationValue = "";
      console.log("No Z coordinate found, cleared elevation input");
    }
  }

  // Reactive statement to update elevation input when feature changes
  $: if ($featureContextMenuState.feature) {
    updateElevationInputFromFeature();
  }

  // Reactive statement to compute coordinate info for display
  $: coordinateInfo = (() => {
    const feature = $featureContextMenuState.feature;
    if (!feature || !feature.getGeometry()) return null;
    
    const geometry = feature.getGeometry();
    if (!geometry) return null;
    const type = geometry.getType();
    
    try {
      if (type === 'Point') {
        const coords = (geometry as any).getCoordinates();
        return {
          type: 'Point',
          x: coords[0]?.toFixed(6) || 'N/A',
          y: coords[1]?.toFixed(6) || 'N/A',
          z: coords[2] !== undefined ? coords[2]?.toFixed(6) || 'N/A' : undefined
        };
      } else if (type === 'LineString') {
        const coords = (geometry as any).getCoordinates();
        return {
          type: 'LineString',
          points: coords.length,
          start: coords[0] ? `[${coords[0][0]?.toFixed(6) || 'N/A'}, ${coords[0][1]?.toFixed(6) || 'N/A'}]` : 'N/A',
          end: coords.length > 0 ? `[${coords[coords.length-1][0]?.toFixed(6) || 'N/A'}, ${coords[coords.length-1][1]?.toFixed(6) || 'N/A'}]` : 'N/A'
        };
      } else if (type === 'Polygon') {
        const coords = (geometry as any).getCoordinates();
        return {
          type: 'Polygon',
          rings: coords.length,
          exteriorPoints: coords[0]?.length || 0
        };
      } else if (type === 'MultiPolygon') {
        const coords = (geometry as any).getCoordinates();
        return {
          type: 'MultiPolygon',
          polygons: coords.length,
          totalPoints: coords.reduce((total: number, poly: any) => total + (poly[0]?.length || 0), 0)
        };
      } else {
        return { type: type };
      }
    } catch (error) {
      return { type: 'Error', error: String(error) };
    }
  })();

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
  let elevationValue: string = "";
  let activeTab: 'info' | 'properties' = 'info';

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

  function updateElevation() {
    console.log("updateElevation called");
    console.log("Selected feature:", $featureContextMenuState.feature);
    console.log("Feature ID:", $featureContextMenuState.featureId);
    console.log("Elevation value:", elevationValue);
    console.log("Feature properties:", $featureContextMenuState.properties);
    
    // Get the selected feature
    const feature = $featureContextMenuState.feature;
    if (!feature || !elevationValue) {
      console.log("No feature selected or no elevation value");
      return;
    }
    
    // Get the feature's geometry
    const geometry = feature.getGeometry();
    if (!geometry) {
      console.log("Feature has no geometry");
      return;
    }
    
    console.log("Original geometry:", geometry);
    console.log("Geometry type:", geometry.getType());
    
    // Convert elevation value to number
    const elevation = parseFloat(elevationValue);
    if (isNaN(elevation)) {
      console.log("Invalid elevation value");
      return;
    }
    
    // Update the geometry coordinates to include Z coordinate
    try {
      // For Point geometry
      if (geometry.getType() === 'Point') {
        const pointGeom = geometry as any;
        const coords = pointGeom.getCoordinates();
        if (coords && coords.length >= 2) {
          const newCoords = [coords[0], coords[1], elevation];
          pointGeom.setCoordinates(newCoords);
          console.log(`Updated Point coordinates from [${coords[0]}, ${coords[1]}] to [${newCoords[0]}, ${newCoords[1]}, ${newCoords[2]}]`);
        }
      }
      // For LineString geometry
      else if (geometry.getType() === 'LineString') {
        const lineGeom = geometry as any;
        const coords = lineGeom.getCoordinates();
        if (coords && coords.length > 0) {
          const newCoords = coords.map((coord: any) => [coord[0], coord[1], elevation]);
          lineGeom.setCoordinates(newCoords);
          console.log(`Updated LineString coordinates to include Z coordinate: ${elevation}`);
        }
      }
      // For Polygon geometry
      else if (geometry.getType() === 'Polygon') {
        const polyGeom = geometry as any;
        const coords = polyGeom.getCoordinates();
        if (coords && coords.length > 0) {
          const newCoords = coords.map((ring: any) => 
            ring.map((coord: any) => [coord[0], coord[1], elevation])
          );
          polyGeom.setCoordinates(newCoords);
          console.log(`Updated Polygon coordinates to include Z coordinate: ${elevation}`);
        }
      }
      // For MultiPolygon geometry
      else if (geometry.getType() === 'MultiPolygon') {
        const multiPolyGeom = geometry as any;
        const coords = multiPolyGeom.getCoordinates();
        if (coords && coords.length > 0) {
          const newCoords = coords.map((polygon: any) => 
            polygon.map((ring: any) => 
              ring.map((coord: any) => [coord[0], coord[1], elevation])
            )
          );
          multiPolyGeom.setCoordinates(newCoords);
          console.log(`Updated MultiPolygon coordinates to include Z coordinate: ${elevation}`);
        }
      }
      else {
        console.log(`Geometry type ${geometry.getType()} not supported for elevation update`);
        return;
      }
      
      console.log("Elevation updated successfully in geometry coordinates");
      console.log("Updated geometry:", geometry);
      
    } catch (error) {
      console.error("Error updating elevation in geometry:", error);
    }
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
      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button 
          class="tab-button {activeTab === 'info' ? 'active' : ''}"
          on:click={() => activeTab = 'info'}
        >
          Info
        </button>
        <button 
          class="tab-button {activeTab === 'properties' ? 'active' : ''}"
          on:click={() => activeTab = 'properties'}
        >
          Properties
        </button>
      </div>

      <!-- Info Tab Content -->
      {#if activeTab === 'info'}
        <div class="tab-content">
          <!-- Feature Type Section -->
          <div class="info-section">
            <h4>Feature Type</h4>
            <div class="info-value">
              {$featureContextMenuState.feature ? $featureContextMenuState.feature.getGeometry()?.getType() || 'Unknown' : 'No feature selected'}
            </div>
          </div>

          <!-- Coordinates Section -->
          <div class="info-section">
            <h4>Coordinates</h4>
            <div class="coordinates-info">
              {#if coordinateInfo}
                <div class="coordinate-row">
                  <span class="coord-label">Geometry Type:</span>
                  <span class="coord-value">{coordinateInfo.type}</span>
                </div>
                
                {#if coordinateInfo.type === 'Point'}
                  <div class="coordinate-row">
                    <span class="coord-label">X (Longitude):</span>
                    <span class="coord-value">{coordinateInfo.x}</span>
                  </div>
                  <div class="coordinate-row">
                    <span class="coord-label">Y (Latitude):</span>
                    <span class="coord-value">{coordinateInfo.y}</span>
                  </div>
                  {#if coordinateInfo.z}
                    <div class="coordinate-row">
                      <span class="coord-label">Z (Elevation):</span>
                      <span class="coord-value">{coordinateInfo.z}</span>
                    </div>
                  {/if}
                {:else if coordinateInfo.type === 'LineString'}
                  <div class="coordinate-row">
                    <span class="coord-label">Start Point:</span>
                    <span class="coord-value">{coordinateInfo.start}</span>
                  </div>
                  <div class="coordinate-row">
                    <span class="coord-label">End Point:</span>
                    <span class="coord-value">{coordinateInfo.end}</span>
                  </div>
                  <div class="coordinate-row">
                    <span class="coord-label">Total Points:</span>
                    <span class="coord-value">{coordinateInfo.points}</span>
                  </div>
                {:else if coordinateInfo.type === 'Polygon'}
                  <div class="coordinate-row">
                    <span class="coord-label">Rings:</span>
                    <span class="coord-value">{coordinateInfo.rings}</span>
                  </div>
                  <div class="coordinate-row">
                    <span class="coord-label">Exterior Points:</span>
                    <span class="coord-value">{coordinateInfo.exteriorPoints}</span>
                  </div>
                {:else if coordinateInfo.type === 'MultiPolygon'}
                  <div class="coordinate-row">
                    <span class="coord-label">Polygons:</span>
                    <span class="coord-value">{coordinateInfo.polygons}</span>
                  </div>
                  <div class="coordinate-row">
                    <span class="coord-label">Total Points:</span>
                    <span class="coord-value">{coordinateInfo.totalPoints}</span>
                  </div>
                {:else}
                  <div class="coordinate-row">
                    <span class="coord-label">Complex Geometry:</span>
                    <span class="coord-value">Use Properties tab for details</span>
                  </div>
                {/if}
              {:else}
                <div class="coordinate-row">
                  <span class="coord-label">No geometry available</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Elevation Section -->
          <div class="elevation-section">
            <h4>Elevation</h4>
            <div class="elevation-controls">
              <input 
                type="number" 
                step="0.1" 
                placeholder="Set Z coordinate"
                bind:value={elevationValue}
              />
              <button 
                class="elevation-btn"
                on:click={updateElevation}
                disabled={!elevationValue}
              >
                Set Elevation
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Properties Tab Content -->
      {#if activeTab === 'properties'}
        <div class="tab-content">
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
      {/if}
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
    width: 400px;
    min-width: 400px;
    max-width: 400px;
    max-height: 60vh;
    overflow: auto;
    font-family: Arial, sans-serif;
  }
  .context-menu-content {
    .tab-navigation {
      display: flex;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      margin-bottom: 12px;
      
      .tab-button {
        flex: 1;
        padding: 8px 16px;
        background: transparent;
        border: none;
        color: #ccc;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s ease;
        
        &:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }
        
        &.active {
          background: rgba(0, 122, 204, 0.2);
          color: #007acc;
          border-bottom: 2px solid #007acc;
        }
      }
    }
    
    .tab-content {
      min-width: 100%;
      
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
      }
      
      .info-section {
        padding: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        
        h4 {
          margin: 0 0 8px 0;
          color: #ccc;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .info-value {
          color: #fff;
          font-size: 0.9rem;
          padding: 4px 0;
        }
        
        .coordinates-info {
          .coordinate-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            
            &:last-child {
              border-bottom: none;
            }
            
            .coord-label {
              color: #ccc;
              font-size: 0.85rem;
              font-weight: 500;
            }
            
            .coord-value {
              color: #fff;
              font-size: 0.85rem;
              font-family: 'Courier New', monospace;
            }
          }
        }
      }
      
      .elevation-section {
        min-width: 100%;
      }
    }

    .elevation-section {
      padding: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      
      h4 {
        margin: 0 0 8px 0;
        color: #ccc;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      .elevation-controls {
        display: flex;
        gap: 8px;
        align-items: center;
        
        input {
          flex: 1;
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
        
        .elevation-btn {
          background: #007acc;
          border: none;
          color: white;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: background-color 0.3s ease;
          
          &:hover {
            background: #005a9e;
          }
          
          &:disabled {
            background: #666;
            cursor: not-allowed;
          }
        }
      }
    }
      
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
  
</style>
