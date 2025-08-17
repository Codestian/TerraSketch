import { writable } from "svelte/store";
import Feature from "ol/Feature";
import type Geometry from "ol/geom/Geometry";

export interface FeatureContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  properties: Record<string, unknown>;
  featureId: string | number | null;
  feature: Feature<Geometry> | null;
}

export const featureContextMenuState = writable<FeatureContextMenuState>({
  visible: false,
  x: 0,
  y: 0,
  properties: {},
  featureId: null,
  feature: null,
});

export function showFeatureContextMenu(
  payload: Omit<FeatureContextMenuState, "visible">
) {
  featureContextMenuState.set({ ...payload, visible: true });
}

export function hideFeatureContextMenu() {
  featureContextMenuState.update((s) => ({ ...s, visible: false }));
}


