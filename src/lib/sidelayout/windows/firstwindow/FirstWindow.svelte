<script lang="ts">
    import Window from '../../components/Window.svelte';
    
    import Converter from './tabs/Converter.svelte';

    const components = {
        'Converter': Converter,
    };

</script>

<Window
    index={0} 
    components={components}
/>
