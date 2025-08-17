<script lang="ts">
  import { contextMenuState, hideContextMenu } from "../../utils/contextMenuStore";

  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        hideContextMenu();
      })
      .catch((err) => alert("Error copying to clipboard: " + err));
  }
  
  function onBackgroundClick() {
    hideContextMenu();
  }

  function onBackgroundKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      hideContextMenu();
    }
  }
</script>

{#if $contextMenuState.visible}
  <div
    class="context-menu-overlay"
    role="button"
    tabindex="0"
    aria-label="Close context menu"
    on:click={onBackgroundClick}
    on:keydown={onBackgroundKeydown}
  ></div>
  <div
    class="context-menu"
    style="left: {$contextMenuState.x}px; top: {$contextMenuState.y}px;"
  >
    <button on:click={() => copy($contextMenuState.tpllText)}>
      {$contextMenuState.tpllText}
    </button>
    <button on:click={() => copy($contextMenuState.tpText)}>
      {$contextMenuState.tpText}
    </button>
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
    padding: 8px 0;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    button {
      padding: 8px 16px;
      border: none;
      background: transparent;
      color: #eaeaea;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-size: 14px;
      text-align: left;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.08);
    }
  }
</style>


