import mapboxgl from 'mapbox-gl';

/**
 * Pin state for a popup: tracks whether it's fixed to the viewport or geo-anchored.
 */
interface PopupPinState {
  popup: mapboxgl.Popup;
  isPinned: boolean;
  originalOffset?: any;
  pinButton?: HTMLElement;
}

/**
 * Map pin states by popup DOM element id for cleanup
 */
const pinStateMap = new Map<string, PopupPinState>();

/**
 * Setup pin functionality for a popup.
 * Returns a cleanup function.
 */
export function setupPopupPin(popup: mapboxgl.Popup, _map: mapboxgl.Map): () => void {
  // Get the popup DOM container
  const popupElement = popup.getElement();
  if (!popupElement) return () => {};

  const popupId = `popup-${Math.random().toString(36).slice(2, 9)}`;

  // Create pin button and inject into tooltip header
  const pinButton = document.createElement('button');
  pinButton.className = 'popup-pin-button';
  pinButton.title = 'Pin to viewport / Unpin to map';
  pinButton.innerHTML = '📌';
  pinButton.setAttribute('data-pinned', 'false');

  // Find the header flex container and insert pin button
  const header = popupElement.querySelector(
    '[style*="display:flex"][style*="align-items:center"][style*="justify-content:space-between"]'
  );
  if (header) {
    // Insert pin button after the threat badge on the right side
    const threatBadge = header.querySelector('[style*="flex-shrink:0"]');
    if (threatBadge) {
      threatBadge.insertAdjacentElement('afterend', pinButton);
    } else {
      header.appendChild(pinButton);
    }
  }

  // Store initial state
  const pinState: PopupPinState = {
    popup,
    isPinned: false,
    originalOffset: popup.options?.offset || [0, 0],
    pinButton,
  };

  pinStateMap.set(popupId, pinState);

  // Pin/unpin toggle
  const togglePin = () => {
    const currentPopupElement = popup.getElement();
    if (!currentPopupElement) return;

    if (!pinState.isPinned) {
      // Pin to viewport
      pinState.isPinned = true;
      pinButton.setAttribute('data-pinned', 'true');
      pinButton.classList.add('pinned');

      // Get current popup position on screen
      const rect = currentPopupElement.getBoundingClientRect();

      // Convert to viewport-fixed positioning
      // Store the current screen coordinates
      const screenX = rect.left;
      const screenY = rect.top;

      // Remove from Mapbox control and add viewport-fixed positioning
      currentPopupElement.style.position = 'fixed';
      currentPopupElement.style.left = `${screenX}px`;
      currentPopupElement.style.top = `${screenY}px`;
      currentPopupElement.style.transform = 'none'; // Clear any map-applied transforms
      currentPopupElement.classList.add('popup-pinned-viewport');

      // Hide tether line (popup is no longer at the map point)
      const tetherSVG = document.querySelector(`#tether-svg-${popupId}`);
      if (tetherSVG) {
        (tetherSVG as SVGElement).style.display = 'none';
      }

      // Prevent map interactions while pinned (optional: remove for draggable pinned popups)
      // pinButton.style.cursor = 'grab';
    } else {
      // Unpin and return to map-anchored
      pinState.isPinned = false;
      pinButton.setAttribute('data-pinned', 'false');
      pinButton.classList.remove('pinned');

      currentPopupElement.style.position = '';
      currentPopupElement.style.left = '';
      currentPopupElement.style.top = '';
      currentPopupElement.style.transform = '';
      currentPopupElement.classList.remove('popup-pinned-viewport');

      // Show tether line again
      const tetherSVG = document.querySelector(`#tether-svg-${popupId}`);
      if (tetherSVG) {
        (tetherSVG as SVGElement).style.display = '';
      }
    }
  };

  pinButton.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePin();
  });

  // Cleanup function
  const cleanup = () => {
    pinButton.removeEventListener('click', togglePin);
    pinStateMap.delete(popupId);
  };

  return cleanup;
}

/**
 * Get pin state for a popup (for checking if it's pinned)
 */
export function isPopupPinned(popup: mapboxgl.Popup): boolean {
  const state = Array.from(pinStateMap.values()).find((s) => s.popup === popup);
  return state?.isPinned ?? false;
}

/**
 * Clean up all pin states (call on page unmount)
 */
export function cleanupAllPinStates(): void {
  pinStateMap.clear();
}
