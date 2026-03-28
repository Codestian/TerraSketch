<script lang="ts">
    import '@fortawesome/fontawesome-free/css/all.css';

    // Define props
    export let iconClass: string;
    export let label: string = ''; // Default label
    export let width: string = '36px'; // Default width
    export let height: string = '36px'; // Default height
    export let onClick: () => void = () => {}; // Default onClick handler
    export let secondary: boolean = false; // Prop for secondary style
    export let danger: boolean = false; // Prop for danger style
    export let bordered: boolean = false; // New prop for bordered style
    export let flexGrow: boolean = false; // New prop for flex grow
    export let tooltip: string = ""; // Tooltip text shown on hover/focus
</script>

<button 
    class="btn {secondary ? 'secondary' : ''} {danger ? 'danger' : ''} {bordered ? 'bordered' : ''}" 
    style="width: {flexGrow ? 'auto' : width}; flex-grow: {flexGrow ? 1 : 0}; height: {height};" 
    on:click={onClick}
    aria-label={tooltip || label}
>
    <i class={iconClass}></i>
    {label}
    {#if tooltip}
        <span class="tooltip">{tooltip}</span>
    {/if}
</button>

<style lang="scss">
    .btn {
        position: relative;
        overflow: visible;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        background-color: green;
        border-top: 3px solid rgba(255, 255, 255, 0.1);
        border-left: 3px solid rgba(255, 255, 255, 0.1);
        border-bottom: 3px solid rgba(0, 0, 0, 0.3);
        border-right: 3px solid rgba(0, 0, 0, 0.3);
        cursor: pointer;
        transition: background-color 0.3s ease;
        font-size: 0.6rem;
        font-weight: bold;
        letter-spacing: 2px;
        text-transform: uppercase;

        i {
            font-size: 0.8rem;
        }

        &:hover {
            background-color: rgb(0, 83, 0);
        }

        &.secondary {
            background-color: lightgray;
            color: black;

            &:hover {
                background-color: darkgray;
            }
        }

        &.danger {
            background-color: rgb(201, 29, 29);

            &:hover {
                background-color: darkred;
            }
        }

        &.bordered {
            border: 2px solid white; // Adds white border
        }

        .tooltip {
            position: absolute;
            left: calc(100% + 8px);
            top: 50%;
            transform: translateY(-50%) translateX(-4px);
            opacity: 0;
            pointer-events: none;
            white-space: nowrap;
            background: rgb(23, 25, 26);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 6px 8px;
            font-size: 0.68rem;
            letter-spacing: 0.5px;
            z-index: 3000;
            transition: opacity 0.15s ease, transform 0.15s ease;
        }

        &:hover .tooltip,
        &:focus-visible .tooltip {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
        }
    }
</style>
