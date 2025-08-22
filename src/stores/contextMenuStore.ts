import { writable } from "svelte/store";

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tpllText: string;
  tpText: string;
}

export const contextMenuState = writable<ContextMenuState>({
  visible: false,
  x: 0,
  y: 0,
  tpllText: "",
  tpText: "",
});

export function showContextMenu(payload: Omit<ContextMenuState, "visible">) {
  contextMenuState.set({ ...payload, visible: true });
}

export function hideContextMenu() {
  contextMenuState.update((s) => ({ ...s, visible: false }));
}


