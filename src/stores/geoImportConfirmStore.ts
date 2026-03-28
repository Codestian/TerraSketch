import { writable } from "svelte/store";

/** Pending GeoJSON file for the import confirmation modal (Layers tab + welcome modal). */
export const pendingImportFile = writable<File | null>(null);
export const showImportConfirm = writable(false);

export function openImportConfirm(file: File) {
  pendingImportFile.set(file);
  showImportConfirm.set(true);
}

export function closeImportConfirm() {
  showImportConfirm.set(false);
  pendingImportFile.set(null);
}
