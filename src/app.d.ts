// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

interface ImportMetaEnv {
	/** Set to `"true"` at build time to enable internal-only UI (e.g. Export in game). */
	readonly VITE_EXPORT_IN_GAME?: string;
}

export {};

