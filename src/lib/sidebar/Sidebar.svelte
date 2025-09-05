<script lang="ts">
  import { onMount } from "svelte";
  import Button from "../common/Button.svelte";
  import * as turf from "@turf/turf";
  import { GeoJSON } from "ol/format";
  import {
    enableDrawing,
    enableMoveMode,
    enableModifyMode,
    onSelectionChange,
    deleteSelectedFeatures,
    getSelectInteraction,
  } from "../../utils/mapUtils";
  import { storeLayers } from "../../utils/saveLayers";
  import { getActiveLayer } from "../../utils/vectorLayerUtils";

  let featuresSelected = false;
  let selectedFeaturesCount = 0;
  let isMoveMode = true;
  let isModifyMode = false;

  function toggleMoveMode() {
    enableMoveMode();
    isMoveMode = true;
    isModifyMode = false;
  }

  function toggleModifyMode() {
    enableModifyMode();
    isMoveMode = false;
    isModifyMode = true;
  }

  function drawPolygon() {
    enableDrawing("Polygon");
  }

  function drawCircle() {
    enableDrawing("Circle");
  }

  function drawRectangle() {
    enableDrawing("Box");
  }

  function drawLineString() {
    enableDrawing("LineString");
  }

  function drawPoint() {
    enableDrawing("Point");
  }

  function deleteFeature() {
    deleteSelectedFeatures();
  }

  function unionFeatures() {
    console.log("Union feature clicked");
    console.log("Selected polygons:", selectedFeaturesCount);

    // Get the selected features from the map
    const selectInteraction = getSelectInteraction();
    if (selectInteraction) {
      const selectedFeatures = selectInteraction.getFeatures();
      const featuresArray = selectedFeatures.getArray();

      if (featuresArray.length < 2) {
        console.log("Need at least 2 features for union operation");
        return;
      }

      console.log("Selected features:", featuresArray);

      try {
        // Convert OpenLayers features to GeoJSON format for Turf.js
        const format = new GeoJSON();
        const geoJsonFeatures = featuresArray
          .map((feature) => {
            const geometry = feature.getGeometry();
            if (!geometry) return null;

            const type = geometry.getType();
            if (type !== "Polygon" && type !== "MultiPolygon") {
              console.log(`Skipping non-polygon feature of type: ${type}`);
              return null;
            }

            return format.writeFeatureObject(feature);
          })
          .filter(Boolean);

        if (geoJsonFeatures.length < 2) {
          console.log("Need at least 2 valid polygon features for union");
          return;
        }

        console.log("GeoJSON features for union:", geoJsonFeatures);

        // Perform union operation
        let result = geoJsonFeatures[0];
        for (let i = 1; i < geoJsonFeatures.length; i++) {
          if (result && geoJsonFeatures[i]) {
            // Create a FeatureCollection for the union operation
            const featureCollection: any = {
              type: "FeatureCollection" as const,
              features: [result, geoJsonFeatures[i]],
            };
            // Use type assertion to bypass TypeScript strict checking
            result = (turf.union as any)(featureCollection, geoJsonFeatures[i]);
            if (!result) {
              console.error("Union operation failed");
              return;
            }
          }
        }

        console.log("Union result:", result);

        // Convert result back to OpenLayers feature and add to map
        if (result) {
          const unionFeatures = format.readFeatures(result);
          
          if (unionFeatures.length > 0) {
            const unionFeature = unionFeatures[0]; // Take the first feature

            // Get the active layer to add the union result
            const activeLayer = getActiveLayer();
            if (activeLayer) {
              const source = activeLayer.getSource();
              if (source) {
                // Remove the original features
                featuresArray.forEach((feature) => {
                  source.removeFeature(feature);
                });

                // Add the union result to the same source/layer
                source.addFeature(unionFeature);
              }
            }

            // Clear selection
            selectInteraction.getFeatures().clear();
            selectedFeaturesCount = 0;
            featuresSelected = false;
          }
        }
      } catch (error) {
        console.error("Error performing union operation:", error);
      }
    }
  }

  function differenceFeature() {
    console.log("Difference feature clicked");
    console.log("Selected polygons:", selectedFeaturesCount);

    // Get the selected features from the map
    const selectInteraction = getSelectInteraction();
    if (selectInteraction) {
      const selectedFeatures = selectInteraction.getFeatures();
      const featuresArray = selectedFeatures.getArray();

      if (featuresArray.length < 2) {
        console.log("Need at least 2 features for difference operation");
        return;
      }

      console.log("Selected features:", featuresArray);

      try {
        // Convert OpenLayers features to GeoJSON format for Turf.js
        const format = new GeoJSON();
        const geoJsonFeatures = featuresArray
          .map((feature) => {
            const geometry = feature.getGeometry();
            if (!geometry) return null;

            const type = geometry.getType();
            if (type !== "Polygon" && type !== "MultiPolygon") {
              console.log(`Skipping non-polygon feature of type: ${type}`);
              return null;
            }

            return format.writeFeatureObject(feature);
          })
          .filter(Boolean);

        if (geoJsonFeatures.length < 2) {
          console.log("Need at least 2 valid polygon features for difference");
          return;
        }

        console.log("GeoJSON features for difference:", geoJsonFeatures);

        // Perform difference operation: first feature minus all others
        // Create a FeatureCollection for the difference operation
        const featureCollection = {
          type: "FeatureCollection" as const,
          features: geoJsonFeatures.filter((f): f is any => f !== null)
        };
        
        // Apply difference operation on the entire collection
        const result = turf.difference(featureCollection);
        if (!result) {
          console.error("Difference operation failed");
          return;
        }

        console.log("Difference result:", result);

        // Convert result back to OpenLayers feature and add to map
        if (result) {
          const differenceFeatures = format.readFeatures(result);
          
          if (differenceFeatures.length > 0) {
            const differenceFeature = differenceFeatures[0]; // Take the first feature

            // Get the active layer to add the difference result
            const activeLayer = getActiveLayer();
            if (activeLayer) {
              const source = activeLayer.getSource();
              if (source) {
                // Remove the original features
                featuresArray.forEach((feature) => {
                  source.removeFeature(feature);
                });

                // Add the difference result to the same source/layer
                source.addFeature(differenceFeature);
              }
            }

            // Clear selection
            selectInteraction.getFeatures().clear();
            selectedFeaturesCount = 0;
            featuresSelected = false;
          }
        }
      } catch (error) {
        console.error("Error performing difference operation:", error);
      }
    }
  }

  function intersectionFeature() {
    console.log("Intersection feature clicked");
    console.log("Selected polygons:", selectedFeaturesCount);

    // Get the selected features from the map
    const selectInteraction = getSelectInteraction();
    if (selectInteraction) {
      const selectedFeatures = selectInteraction.getFeatures();
      const featuresArray = selectedFeatures.getArray();

      if (featuresArray.length < 2) {
        console.log("Need at least 2 features for intersection operation");
        return;
      }

      console.log("Selected features:", featuresArray);

      try {
        // Convert OpenLayers features to GeoJSON format for Turf.js
        const format = new GeoJSON();
        const geoJsonFeatures = featuresArray
          .map((feature) => {
            const geometry = feature.getGeometry();
            if (!geometry) return null;

            const type = geometry.getType();
            if (type !== "Polygon" && type !== "MultiPolygon") {
              console.log(`Skipping non-polygon feature of type: ${type}`);
              return null;
            }

            return format.writeFeatureObject(feature);
          })
          .filter(Boolean);

        if (geoJsonFeatures.length < 2) {
          console.log("Need at least 2 valid polygon features for intersection");
          return;
        }

        console.log("GeoJSON features for intersection:", geoJsonFeatures);

        // Perform intersection operation: find common area between all features
        // Create a FeatureCollection for the intersection operation
        const featureCollection = {
          type: "FeatureCollection" as const,
          features: geoJsonFeatures.filter((f): f is any => f !== null)
        };
        
        // Apply intersection operation on the entire collection
        const result = turf.intersect(featureCollection);
        if (!result) {
          console.error("Intersection operation failed - no common area");
          return;
        }

        console.log("Intersection result:", result);

        // Convert result back to OpenLayers feature and add to map
        if (result) {
          const intersectionFeatures = format.readFeatures(result);
          
          if (intersectionFeatures.length > 0) {
            const intersectionFeature = intersectionFeatures[0]; // Take the first feature

            // Get the active layer to add the intersection result
            const activeLayer = getActiveLayer();
            if (activeLayer) {
              const source = activeLayer.getSource();
              if (source) {
                // Remove the original features
                featuresArray.forEach((feature) => {
                  source.removeFeature(feature);
                });

                // Add the intersection result to the same source/layer
                source.addFeature(intersectionFeature);
              }
            }

            // Clear selection
            selectInteraction.getFeatures().clear();
            selectedFeaturesCount = 0;
            featuresSelected = false;
          }
        }
      } catch (error) {
        console.error("Error performing intersection operation:", error);
      }
    }
  }

  onMount(() => {
    onSelectionChange((selectedFeatures) => {
      const wasSelected = featuresSelected;
      selectedFeaturesCount = selectedFeatures.getLength();
      featuresSelected = selectedFeaturesCount > 0;
      
      // Autosave when all features are completely unselected
      if (wasSelected && !featuresSelected) {
        storeLayers(true); // Silent autosave when all features are unselected
      }
      
      if (!featuresSelected) {
        toggleMoveMode();
      }
    });
  });
</script>

<aside class="sidebar">
  <div class="top-buttons">
    {#if !featuresSelected}
      <Button iconClass="fas fa-slash" label="" onClick={drawLineString} />
      <Button iconClass="fas fa-draw-polygon" label="" onClick={drawPolygon} />
      <Button iconClass="fas fa-circle" label="" onClick={drawCircle} />
      <Button iconClass="far fa-square" label="" onClick={drawRectangle} />
    {/if}
    {#if featuresSelected}
      <Button
        iconClass="fas fa-arrows-alt"
        label=""
        onClick={toggleMoveMode}
        bordered={isMoveMode}
      />
      <Button
        iconClass="fas fa-pen-fancy"
        label=""
        onClick={toggleModifyMode}
        bordered={isModifyMode}
      />
      <Button
        iconClass="fas fa-trash-can"
        label=""
        onClick={deleteFeature}
        danger
      />
      {#if selectedFeaturesCount >= 2}
        <Button
          iconClass="fas fa-layer-group"
          label=""
          onClick={unionFeatures}
        />
        <Button
          iconClass="fas fa-minus"
          label=""
          onClick={differenceFeature}
        />
        <Button
          iconClass="fas fa-times"
          label=""
          onClick={intersectionFeature}
        />
      {/if}
    {/if}
  </div>
  <div class="bottom-buttons">
    <Button iconClass="fas fa-info" label="" />
    <Button iconClass="fas fa-cog" label="" />
  </div>
</aside>

<style lang="scss">
  .sidebar {
    width: 48px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: rgba(23, 25, 26, 0.85);
    position: absolute;
    left: 0;
    top: 0;
    backdrop-filter: blur(36px);
    padding: calc((48px - 36px) / 2) 0;
    z-index: 11;
  }

  .top-buttons,
  .bottom-buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc((48px - 36px) / 2);
  }
</style>
