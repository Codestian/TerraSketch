<script lang="ts">
    import Window from '../../components/Window.svelte';
    import Layers from './tabs/Layers.svelte';
    import Maps from './tabs/Maps.svelte';
    import { onMount } from 'svelte';
    import { initLayersFromDBOnce } from '../../../../stores/layersStore';
    import { initMapLayersFromDBOnce } from '../../../../utils/mapLayerUtils';
    import { restoreAllImageLayers } from '../../../../utils/imageLayerUtils';
    import { getMap } from '../../../../utils/mapUtils';
    import Images from './tabs/Images.svelte';

    const components = {
        'Layers': Layers,
        'Maps': Maps,
        'Images': Images,
    };

    onMount(() => {
        initLayersFromDBOnce();
        initMapLayersFromDBOnce();
        
        // Restore image layers after map is ready
        const map = getMap();
        if (map) {
            restoreAllImageLayers({ map });
        }
    });
</script>

<Window
    index={2} 
    components={components}
/>
