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

    // Get the current state of Images tab
    const isImagesActive = get(imagesTabActive);

    // Handle W/A/S/D to move active image (10px per repeat) only when Images tab is active
    if (!event.altKey && !event.ctrlKey && !event.metaKey && activeImageLayerId && isImagesActive) {
        const stepPx = 10;
        if (event.key === 'w') { event.preventDefault(); nudgeActiveImageLayerByPixels(0, -stepPx); }
        if (event.key === 's') { event.preventDefault(); nudgeActiveImageLayerByPixels(0, stepPx); }
        if (event.key === 'a') { event.preventDefault(); nudgeActiveImageLayerByPixels(-stepPx, 0); }
        if (event.key === 'd') { event.preventDefault(); nudgeActiveImageLayerByPixels(stepPx, 0); }
    }

    // Handle image-specific shortcuts when Images tab is active
    if (isImagesActive && activeImageLayerId) {
        // Handle Alt+Q/E (Rotate image incrementally)
        if (event.altKey && (event.key === 'q' || event.key === 'e')) {
            event.preventDefault();
            rotateActiveImageLayer(event.key === 'q' ? -1 : 1);
        }

        // Handle Alt+W (Scale image up)
        if (event.key === 'w' && event.altKey) {
            event.preventDefault();
            scaleActiveImageLayer(1.05);
        }

        // Handle Alt+S (Scale image down)
        if (event.key === 's' && event.altKey) {
            event.preventDefault();
            scaleActiveImageLayer(0.95);
        }
    }

    // Disable vector layer shortcuts when Images tab is active
    if (isImagesActive) {
        // Only allow image-specific shortcuts when Images tab is active
        return;
    }

    // Vector layer shortcuts - only active when Images tab is NOT active
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

    // Handle Alt+Q/E (Rotate features 90°) - only when Images tab is NOT active
    if (event.altKey && (event.key === 'q' || event.key === 'e')) {
        event.preventDefault();
        rotateSelectedFeatures(event.key === 'q' ? 90 : -90, getSelectInteraction());
    }

    // Handle Alt+A (Flip horizontally leftward) - only when Images tab is NOT active
    if (event.key === 'a' && event.altKey) {
        event.preventDefault();
        flipSelectedFeaturesHorizontallyLeft(getSelectInteraction());
    }

    // Handle Alt+D (Flip horizontally rightward) - only when Images tab is NOT active
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
