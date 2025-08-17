import { deleteSelectedFeatures, copySelectedFeatures, pasteCopiedFeatures, getSelectInteraction } from './mapUtils';
import { rotateSelectedFeatures, flipSelectedFeaturesVerticallyUp, flipSelectedFeaturesVerticallyDown, flipSelectedFeaturesHorizontallyLeft, flipSelectedFeaturesHorizontallyRight } from './transformationUtils';

function handleKeyDown(event: KeyboardEvent) {
    // Check if the focused element is inside the table in Features.svelte
    const focusedElement = document.activeElement as HTMLElement;
    if (focusedElement.closest('table') || focusedElement.closest('input') || focusedElement.closest('textarea')) {
        // If the focused element is within a table, do not proceed with map-related operations
        return;
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

    // Handle Alt+Q (Rotate 90° clockwise/right)
    if (event.key === 'q' && event.altKey) {
        event.preventDefault();
        rotateSelectedFeatures(90, getSelectInteraction()); // Negative for clockwise (right)
    }

    // Handle Alt+E (Rotate 90° counterclockwise/left)
    if (event.key === 'e' && event.altKey) {
        event.preventDefault();
        rotateSelectedFeatures(-90, getSelectInteraction()); // Positive for counterclockwise (left)
    }

    // Handle Alt+W (Flip vertically upward)
    if (event.key === 'w' && event.altKey) {
        event.preventDefault();
        flipSelectedFeaturesVerticallyUp(getSelectInteraction());
    }

    // Handle Alt+S (Flip vertically downward)
    if (event.key === 's' && event.altKey) {
        event.preventDefault();
        flipSelectedFeaturesVerticallyDown(getSelectInteraction());
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
