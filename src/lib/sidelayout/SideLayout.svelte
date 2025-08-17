<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Button from "../common/Button.svelte";
  import FirstWindow from "./windows/firstwindow/FirstWindow.svelte";
  import SecondWindow from "./windows/secondwindow/SecondWindow.svelte";
  import { moveToLocation } from "../../utils/mapUtils"; // Import the moveToLocation function

  let searchCoordinates: string = ""; // Variable to hold the input for coordinates
  let isHidden = false; // State to track if sidebar content is hidden

  // Function to parse and move to the specified coordinates
  function moveToCoordinates() {
    const [lat, lng] = searchCoordinates
      .split(",")
      .map((coord) => parseFloat(coord.trim()));
    if (!isNaN(lat) && !isNaN(lng)) {
      moveToLocation(lat, lng, 16); // Use a default zoom level of 12
    } else {
      alert('Invalid coordinates format. Please use "lat, lng" format.');
    }
  }

  // Function to toggle sidebar content visibility
  function toggleSidebar() {
    isHidden = !isHidden;
  }

  function handleToggleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleSidebar();
    }
  }

  function applyResponsiveVisibility(width: number) {
    isHidden = width < 768;
  }

  let handleResize: () => void;

  onMount(() => {
    // Set initial state based on current viewport width
    applyResponsiveVisibility(window.innerWidth);
    // Update state on resize
    handleResize = () => applyResponsiveVisibility(window.innerWidth);
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    if (handleResize) {
      window.removeEventListener("resize", handleResize);
    }
  });
</script>

<aside class="sidelayout" class:collapsed={isHidden}>
  <div
    class="toggle-handle"
    role="button"
    tabindex="0"
    aria-label="Toggle sidebar"
    aria-expanded={!isHidden}
    aria-controls="sidebar-content"
    on:click={toggleSidebar}
    on:keydown={handleToggleKeydown}
  >
    <span></span>
  </div>
  <div id="sidebar-content" class="content" class:hidden={isHidden}>
    <div class="search-container">
      <input
        id="search"
        type="text"
        placeholder="Move to location..."
        bind:value={searchCoordinates}
      />
      <Button
        onClick={moveToCoordinates}
        iconClass="fas fa-search"
        label=""
        width="36px"
        height="36px"
      />
    </div>
    <div class="windows" id="windowsContainer">
      <FirstWindow />
      <SecondWindow />
    </div>
  </div>
</aside>

<style lang="scss">
  .sidelayout {
    background: rgb(23, 25, 26);
    position: absolute;
    top: 0;
    right: 0;
    overflow: hidden;
    box-sizing: border-box;
    display: flex;
    height: 100%;
    z-index: 10;
  }

  .toggle-handle {
    width: 18px;
    height: 100%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease, width 0.3s ease;

    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    span {
      height: 32px;
      width: 2px;
      background: white;
      border-radius: 32px;
    }
  }

  .sidelayout.collapsed {
    .toggle-handle {
      width: 26px;
    }
  }

  .content {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 8px 8px 8px 0px;
    height: 100%;
    width: 320px;
    transition: width 0.3s ease-in-out, opacity 0.3s ease-in-out;

    &.hidden {
      width: 0;
      opacity: 0;
      padding: 0;
      overflow: hidden;
    }

    .search-container {
      display: flex;
      margin-bottom: 8px;
      width: 100%;
      height: 36px;

      #search {
        border: none;
        background: rgba(255, 255, 255, 0.1);
        flex: 1;
        font-size: 0.8rem;
        padding: 12px;
        color: white;

        &:focus {
          background-color: rgba(255, 255, 255, 0.05);
          outline: none;
        }
      }
    }

    .windows {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;

      :global(> :first-child) {
        flex-shrink: 0; /* FirstWindow won't shrink, will size based on content */
      }

      :global(> :last-child) {
        flex: 1; /* SecondWindow will fill remaining space */
        min-height: 0; /* Allow it to shrink below content size */
      }
    }
  }
</style>
