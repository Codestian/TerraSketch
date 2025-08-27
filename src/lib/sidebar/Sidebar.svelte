<script lang="ts">
  import { onMount } from "svelte";
  import Button from "../common/Button.svelte";
  import {
    enableDrawing,
    enableMoveMode,
    enableModifyMode,
    onSelectionChange,
    deleteSelectedFeatures,
  } from "../../utils/mapUtils";
  import { storeLayers } from "../../utils/saveLayers";

  let featuresSelected = false;
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

  onMount(() => {
    onSelectionChange((selectedFeatures) => {
      const wasSelected = featuresSelected;
      featuresSelected = selectedFeatures.getLength() > 0;
      
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
