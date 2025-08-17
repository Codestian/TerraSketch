import { default as Feature } from "ol/Feature";
import { Select } from "ol/interaction";

// Rotates selected features as a group around the center of the selection
export function rotateSelectedFeatures(degrees: number, selectInteraction: Select | null) {
  if (!selectInteraction) return;

  const selectedFeatures = selectInteraction.getFeatures();
  if (selectedFeatures.getLength() === 0) return;

  const radians = (degrees * Math.PI) / 180;

  // Calculate the center of the entire selection
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  selectedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      const extent = geometry.getExtent();
      minX = Math.min(minX, extent[0]);
      minY = Math.min(minY, extent[1]);
      maxX = Math.max(maxX, extent[2]);
      maxY = Math.max(maxY, extent[3]);
    }
  });

  const selectionCenter = [(minX + maxX) / 2, (minY + maxY) / 2];

  // Rotate each feature around the selection center
  selectedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      // Translate to origin (selection center becomes 0,0)
      geometry.translate(-selectionCenter[0], -selectionCenter[1]);
      
      // Rotate around origin
      geometry.rotate(radians, [0, 0]);
      
      // Translate back to original position
      geometry.translate(selectionCenter[0], selectionCenter[1]);
      
      feature.setGeometry(geometry);
    }
  });
}

// Flips selected features vertically upward (W key) as a group - only if not already flipped up
export function flipSelectedFeaturesVerticallyUp(selectInteraction: Select | null) {
  if (!selectInteraction) return;

  const selectedFeatures = selectInteraction.getFeatures();
  if (selectedFeatures.getLength() === 0) return;

  // Calculate the center of the entire selection
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  selectedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      const extent = geometry.getExtent();
      minX = Math.min(minX, extent[0]);
      minY = Math.min(minY, extent[1]);
      maxX = Math.max(maxX, extent[2]);
      maxY = Math.max(maxY, extent[3]);
    }
  });

  const selectionCenterY = (minY + maxY) / 2;

  selectedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      // Check if already flipped vertically up
      const isFlippedVerticallyUp = feature.get('isFlippedVerticallyUp') || false;
      
      if (!isFlippedVerticallyUp) {
        // Flip around the selection center Y
        geometry.applyTransform((input, output = [], dimension = 2) => {
          for (let i = 0; i < input.length; i += dimension) {
            output[i] = input[i];
            output[i + 1] = 2 * selectionCenterY - input[i + 1];
          }
          return output;
        });
        
        // Mark as flipped vertically up
        feature.set('isFlippedVerticallyUp', true);
        feature.set('isFlippedVerticallyDown', false); // Reset opposite flag
      }
    }
  });
}

// Flips selected features vertically downward (S key) as a group - only if not already flipped down
export function flipSelectedFeaturesVerticallyDown(selectInteraction: Select | null) {
  if (!selectInteraction) return;

  const selectedFeatures = selectInteraction.getFeatures();
  if (selectedFeatures.getLength() === 0) return;

  // Calculate the center of the entire selection
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  selectedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      const extent = geometry.getExtent();
      minX = Math.min(minX, extent[0]);
      minY = Math.min(minY, extent[1]);
      maxX = Math.max(maxX, extent[2]);
      maxY = Math.max(maxY, extent[3]);
    }
  });

  const selectionCenterY = (minY + maxY) / 2;

  selectedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      // Check if already flipped vertically down
      const isFlippedVerticallyDown = feature.get('isFlippedVerticallyDown') || false;
      
      if (!isFlippedVerticallyDown) {
        // Flip around the selection center Y
        geometry.applyTransform((input, output = [], dimension = 2) => {
          for (let i = 0; i < input.length; i += dimension) {
            output[i] = input[i];
            output[i + 1] = 2 * selectionCenterY - input[i + 1];
          }
          return output;
        });
        
        // Mark as flipped vertically down
        feature.set('isFlippedVerticallyDown', true);
        feature.set('isFlippedVerticallyUp', false); // Reset opposite flag
      }
    }
  });
}

// Flips selected features horizontally leftward (A key) as a group - only if not already flipped left
export function flipSelectedFeaturesHorizontallyLeft(selectInteraction: Select | null) {
  if (!selectInteraction) return;

  const selectedFeatures = selectInteraction.getFeatures();
  if (selectedFeatures.getLength() === 0) return;

  // Calculate the center of the entire selection
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  selectedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      const extent = geometry.getExtent();
      minX = Math.min(minX, extent[0]);
      minY = Math.min(minY, extent[1]);
      maxX = Math.max(maxX, extent[2]);
      maxY = Math.max(maxY, extent[3]);
    }
  });

  const selectionCenterX = (minX + maxX) / 2;

  selectedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      // Check if already flipped horizontally left
      const isFlippedHorizontallyLeft = feature.get('isFlippedHorizontallyLeft') || false;
      
      if (!isFlippedHorizontallyLeft) {
        // Flip around the selection center X
        geometry.applyTransform((input, output = [], dimension = 2) => {
          for (let i = 0; i < input.length; i += dimension) {
            output[i] = 2 * selectionCenterX - input[i];
            output[i + 1] = input[i + 1];
          }
          return output;
        });
        
        // Mark as flipped horizontally left
        feature.set('isFlippedHorizontallyLeft', true);
        feature.set('isFlippedHorizontallyRight', false); // Reset opposite flag
      }
    }
  });
}

// Flips selected features horizontally rightward (D key) as a group - only if not already flipped right
export function flipSelectedFeaturesHorizontallyRight(selectInteraction: Select | null) {
  if (!selectInteraction) return;

  const selectedFeatures = selectInteraction.getFeatures();
  if (selectedFeatures.getLength() === 0) return;

  // Calculate the center of the entire selection
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  selectedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      const extent = geometry.getExtent();
      minX = Math.min(minX, extent[0]);
      minY = Math.min(minY, extent[1]);
      maxX = Math.max(maxX, extent[2]);
      maxY = Math.max(maxY, extent[3]);
    }
  });

  const selectionCenterX = (minX + maxX) / 2;

  selectedFeatures.forEach((feature) => {
    const geometry = feature.getGeometry();
    if (geometry) {
      // Check if already flipped horizontally right
      const isFlippedHorizontallyRight = feature.get('isFlippedHorizontallyRight') || false;
      
      if (!isFlippedHorizontallyRight) {
        // Flip around the selection center X
        geometry.applyTransform((input, output = [], dimension = 2) => {
          for (let i = 0; i < input.length; i += dimension) {
            output[i] = 2 * selectionCenterX - input[i];
            output[i + 1] = input[i + 1];
          }
          return output;
        });
        
        // Mark as flipped horizontally right
        feature.set('isFlippedHorizontallyRight', true);
        feature.set('isFlippedHorizontallyLeft', false); // Reset opposite flag
      }
    }
  });
}
