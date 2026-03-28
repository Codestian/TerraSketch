<script lang="ts">
    export let onMouseDown: (event: MouseEvent) => void;
</script>

<div class="resize-handle-horizontal" on:mousedown={onMouseDown}>
    <span></span>
</div>

<style lang="scss">
    .resize-handle-horizontal {
        height: 12px;
        width: 100%;
        cursor: ns-resize;
        position: absolute;
        bottom: -12px;
        display: flex;
        align-items: center;
        justify-content: center;

        span {
            width: 32px;
            height: 2px;
            background: white;
        }
    }
</style>
