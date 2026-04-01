/**
 * Popup Drag Setup Utility
 * Adds draggable behavior to Mapbox Popup elements with viewport clamping
 */

import type { Popup } from 'mapbox-gl';

export interface PopupDragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  listeners: {
    mouseMove: (e: MouseEvent) => void;
    mouseUp: (e: MouseEvent) => void;
  };
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Setup draggable behavior on a Mapbox Popup
 * Allows user to drag the popup within viewport bounds
 * Updates tether line via callback if provided
 */
export function setupPopupDrag(
  popup: Popup,
  onDragUpdate?: (offset: { x: number; y: number }) => void
): PopupDragState {
  const popupElement = popup.getElement();
  if (!popupElement) {
    return {
      isDragging: false,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      listeners: { mouseMove: () => {}, mouseUp: () => {} },
    };
  }

  // Initialize drag state
  const dragState: PopupDragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    listeners: { mouseMove: () => {}, mouseUp: () => {} },
  };

  // Add draggable class to popup
  popupElement.classList.add('sc-popup-draggable');

  // Mouse down handler on drag handle or popup header
  const handleMouseDown = (e: MouseEvent) => {
    // Only start drag if clicking on drag handle or within header area
    const target = e.target as HTMLElement;
    if (
      !target.closest('.popup-drag-handle') &&
      !target.closest(
        '[style*="display:flex"][style*="justify-content:space-between"][style*="padding:10px"]'
      )
    ) {
      return;
    }

    e.preventDefault();
    dragState.isDragging = true;
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;

    popupElement.classList.add('dragging');

    // Define mouse move handler
    dragState.listeners.mouseMove = (moveEvent: MouseEvent) => {
      if (!dragState.isDragging) return;

      const deltaX = moveEvent.clientX - dragState.startX;
      const deltaY = moveEvent.clientY - dragState.startY;

      // Apply offset
      dragState.offsetX = deltaX;
      dragState.offsetY = deltaY;

      // Get popup current position and size
      const rect = popupElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate new position with offset
      let newX = deltaX;
      let newY = deltaY;

      // Clamp to viewport bounds
      const minX = -rect.width / 2;
      const maxX = viewportWidth - rect.width / 2;
      const minY = -rect.height / 2;
      const maxY = viewportHeight - rect.height / 2;

      newX = clamp(newX, minX, maxX);
      newY = clamp(newY, minY, maxY);

      // Update drag state with clamped values
      dragState.offsetX = newX;
      dragState.offsetY = newY;

      // Apply transform
      popupElement.style.transform = `translate(${newX}px, ${newY}px)`;

      // Call tether update callback if provided
      if (onDragUpdate) {
        onDragUpdate({ x: newX, y: newY });
      }
    };

    // Define mouse up handler
    dragState.listeners.mouseUp = () => {
      if (!dragState.isDragging) return;

      dragState.isDragging = false;
      popupElement.classList.remove('dragging');

      // Remove event listeners
      document.removeEventListener('mousemove', dragState.listeners.mouseMove);
      document.removeEventListener('mouseup', dragState.listeners.mouseUp);
    };

    // Add event listeners
    document.addEventListener('mousemove', dragState.listeners.mouseMove);
    document.addEventListener('mouseup', dragState.listeners.mouseUp);
  };

  // Attach mouse down handler to popup
  popupElement.addEventListener('mousedown', handleMouseDown);

  // Return cleanup function in the state
  return dragState;
}

/**
 * Cleanup drag event listeners and state
 */
export function cleanupPopupDrag(popup: Popup, dragState: PopupDragState): void {
  const popupElement = popup.getElement();
  if (!popupElement) return;

  // Remove event listeners if they exist
  if (dragState.listeners.mouseMove) {
    document.removeEventListener('mousemove', dragState.listeners.mouseMove);
  }
  if (dragState.listeners.mouseUp) {
    document.removeEventListener('mouseup', dragState.listeners.mouseUp);
  }

  // Remove draggable class
  popupElement.classList.remove('sc-popup-draggable', 'dragging');

  // Reset transform
  popupElement.style.transform = 'none';
}
