<script lang="ts">
    import Window from '../../components/Window.svelte';
    import Layers from './tabs/Layers.svelte';
    import Maps from './tabs/Maps.svelte';
    // import Images from './tabs/Images.svelte';

    const components = {
        'Layers': Layers,
        'Maps': Maps,
        // 'Images': Images,
    };
</script>

<Window
    index={2} 
    components={components}
/>
