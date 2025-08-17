<script lang="ts">
    import '@fortawesome/fontawesome-free/css/all.css';

    // Define props
    export let iconClass: string;
    export let label: string = ''; // Default label
    export let width: string = '32px'; // Default width
    export let onClick: () => void = () => {}; // Default onClick handler
    export let flexGrow: boolean = false; // Prop for flex grow
    export let square: boolean = false; // Prop for making button square
</script>

<button 
    class="btn" 
    class:square={square}
    style="width: {flexGrow ? 'auto' : (square ? '32px' : width)}; flex-grow: {flexGrow ? 1 : 0};" 
    on:click={onClick}
>
    <i class={iconClass}></i>
    {#if !square}
        {label}
    {/if}
</button>

<style lang="scss">
    .btn {
        height: 28px;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        padding: 0 6px;
        font-size: 0.7rem;
        border: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background-color 0.3s ease;
        user-select: none;

        i {
            font-size: 0.7rem;
            padding-right: 4px;
        }

        &:hover {
            background-color: rgba(255, 255, 255, 0.2);
        }

        &.square {
            width: 32px;
            height: 32px;
            padding: 0;

            i {
                padding-right: 0;
            }
        }
    }
</style>
