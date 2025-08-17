<script lang="ts">
	import '../app.scss';
	import Sidebar from '$lib/sidebar/Sidebar.svelte';
	import Map from '$lib/map/Map.svelte';
	import SideLayout from '$lib/sidelayout/SideLayout.svelte';
</script>

<svelte:head>
	<title>TerrasEdit</title>
</svelte:head>


<main>
	<Sidebar />
	<Map />
	<SideLayout /> 
</main>

<style lang="scss">
	main {
		width: 100%;
		height: 100vh;
		display: flex;
	}
</style>
