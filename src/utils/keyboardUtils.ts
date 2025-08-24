import { deleteSelectedFeatures, copySelectedFeatures, pasteCopiedFeatures, getSelectInteraction } from './mapUtils';
import { rotateSelectedFeatures, flipSelectedFeaturesHorizontallyLeft, flipSelectedFeaturesHorizontallyRight } from './transformationUtils';
import { scaleActiveImageLayer, rotateActiveImageLayer, activeImageLayerId, nudgeActiveImageLayerByPixels } from './imageLayerUtils';
import { imagesTabActive } from '../stores/uiStore';
import { get } from 'svelte/store';

function handleKeyDown(event: KeyboardEvent) {
    // Check if the focused element is inside the table in Features.svelte
    const focusedElement = document.activeElement as HTMLElement;
    if (focusedElement.closest('table') || focusedElement.closest('input') || focusedElement.closest('textarea')) {
        // If the focused element is within a table, do not proceed with map-related operations
        return;
    }

    // Handle W/A/S/D to move active image (10px per repeat) only when Images tab is active
    const isImagesActive = get(imagesTabActive);
    if (!event.altKey && !event.ctrlKey && !event.metaKey && activeImageLayerId && isImagesActive) {
        const stepPx = 10;
        if (event.key === 'w') { event.preventDefault(); nudgeActiveImageLayerByPixels(0, -stepPx); }
        if (event.key === 's') { event.preventDefault(); nudgeActiveImageLayerByPixels(0, stepPx); }
        if (event.key === 'a') { event.preventDefault(); nudgeActiveImageLayerByPixels(-stepPx, 0); }
        if (event.key === 'd') { event.preventDefault(); nudgeActiveImageLayerByPixels(stepPx, 0); }
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
        deleteSelectedFeatures();
    }

    // Handle Ctrl+C (Copy)
    if (event.key === 'c' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault(); // Prevent the default copy action
        copySelectedFeatures();
    }

    // Handle Ctrl+V (Paste)
    if (event.key === 'v' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault(); // Prevent the default paste action
        pasteCopiedFeatures();
    }

    // Handle Alt+Q/E (Rotate image incrementally, only when Images tab is active; else rotate features 90°)
    if (event.altKey && (event.key === 'q' || event.key === 'e')) {
        event.preventDefault();
        const isImagesActive = get(imagesTabActive);
        if (activeImageLayerId && isImagesActive) {
            rotateActiveImageLayer(event.key === 'q' ? -1 : 1);
        } else {
            rotateSelectedFeatures(event.key === 'q' ? 90 : -90, getSelectInteraction());
        }
    }

    // Handle Alt+W (Scale image up) only when Images tab is active
    if (event.key === 'w' && event.altKey && get(imagesTabActive)) {
        event.preventDefault();
        scaleActiveImageLayer(1.05);
    }

    // Handle Alt+S (Scale image down) only when Images tab is active
    if (event.key === 's' && event.altKey && get(imagesTabActive)) {
        event.preventDefault();
        scaleActiveImageLayer(0.95);
    }

    // Handle Alt+A (Flip horizontally leftward)
    if (event.key === 'a' && event.altKey) {
        event.preventDefault();
        flipSelectedFeaturesHorizontallyLeft(getSelectInteraction());
    }

    // Handle Alt+D (Flip horizontally rightward)
    if (event.key === 'd' && event.altKey) {
        event.preventDefault();
        flipSelectedFeaturesHorizontallyRight(getSelectInteraction());
    }
}

/**
 * Initializes keyboard event listeners for handling map interactions.
 */
export function initializeKeyboardListeners() {
    if (typeof window !== 'undefined') {
        // Check if window is defined to ensure this runs only in the browser
        window.addEventListener('keydown', handleKeyDown);
    }
}

/**
 * Removes keyboard event listeners to clean up resources.
 */
export function removeKeyboardListeners() {
    if (typeof window !== 'undefined') {
        // Check if window is defined to ensure this runs only in the browser
        window.removeEventListener('keydown', handleKeyDown);
    }
}
