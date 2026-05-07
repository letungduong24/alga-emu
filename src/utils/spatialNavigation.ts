import { FocusableElement } from '@/contexts/GamepadContext';
import { LayoutRectangle } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export type NavigationDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface DirectionVector {
  dx: number;  // -1 (left), 0 (vertical), 1 (right)
  dy: number;  // -1 (up), 0 (horizontal), 1 (down)
}

interface Point {
  x: number;
  y: number;
}

// ============================================================================
// Direction Vectors
// ============================================================================

const DIRECTION_VECTORS: Record<NavigationDirection, DirectionVector> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get center point of an element's bounds
 */
function getCenter(bounds: LayoutRectangle): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

/**
 * Calculate Euclidean distance between two points
 */
export function calculateDistance(from: LayoutRectangle, to: LayoutRectangle): number {
  const fromCenter = getCenter(from);
  const toCenter = getCenter(to);

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate directional bias (alignment score)
 * Returns 0-1 where 1 = perfectly aligned, 0 = not aligned
 */
export function calculateDirectionalBias(
  from: LayoutRectangle,
  to: LayoutRectangle,
  direction: NavigationDirection,
  screenWidth: number = 1080,
  screenHeight: number = 1920
): number {
  const fromCenter = getCenter(from);
  const toCenter = getCenter(to);

  let alignment: number;

  if (direction === 'UP' || direction === 'DOWN') {
    // For vertical navigation, check horizontal alignment
    alignment = 1 - Math.abs(toCenter.x - fromCenter.x) / screenWidth;
  } else {
    // For horizontal navigation, check vertical alignment
    alignment = 1 - Math.abs(toCenter.y - fromCenter.y) / screenHeight;
  }

  return Math.max(0, Math.min(1, alignment));
}

/**
 * Check if target element is in the correct direction from source
 */
export function isInCorrectDirection(
  from: LayoutRectangle,
  to: LayoutRectangle,
  direction: NavigationDirection
): boolean {
  const fromCenter = getCenter(from);
  const toCenter = getCenter(to);

  switch (direction) {
    case 'UP':
      return toCenter.y < fromCenter.y;
    case 'DOWN':
      return toCenter.y > fromCenter.y;
    case 'LEFT':
      return toCenter.x < fromCenter.x;
    case 'RIGHT':
      return toCenter.x > fromCenter.x;
    default:
      return false;
  }
}

// ============================================================================
// Main Navigation Function
// ============================================================================

interface NavigationCandidate {
  element: FocusableElement;
  score: number;
}

/**
 * Find the next focusable element in the given direction
 * @param currentElement - Currently focused element
 * @param direction - Navigation direction
 * @param allElements - All registered focusable elements
 * @param navigationGroup - Optional group filter (for modals)
 * @returns Next element to focus, or null if none found
 */
export function findNextFocusable(
  currentElement: FocusableElement,
  direction: NavigationDirection,
  allElements: Map<string, FocusableElement>,
  navigationGroup?: string
): FocusableElement | null {
  const candidates: NavigationCandidate[] = [];

  // Filter elements
  for (const [id, element] of allElements) {
    // Skip current element
    if (id === currentElement.id) continue;

    // Skip disabled elements
    if (element.disabled) continue;

    // Filter by navigation group if specified (for modals)
    if (navigationGroup && element.navigationGroup !== navigationGroup) continue;

    // Check if element is in correct direction
    if (!isInCorrectDirection(currentElement.bounds, element.bounds, direction)) {
      continue;
    }

    // Calculate distance
    const distance = calculateDistance(currentElement.bounds, element.bounds);

    // Calculate directional bias (alignment)
    const bias = calculateDirectionalBias(
      currentElement.bounds,
      element.bounds,
      direction
    );

    // Calculate score (lower is better)
    // Bias reduces score - prefer aligned elements
    const score = distance * (1 - bias * 0.5);

    candidates.push({ element, score });
  }

  // No candidates found
  if (candidates.length === 0) {
    return null;
  }

  // Sort by score (ascending) and return best candidate
  candidates.sort((a, b) => a.score - b.score);

  return candidates[0].element;
}

/**
 * Find first focusable element (highest priority, or first registered)
 */
export function findFirstFocusable(
  allElements: Map<string, FocusableElement>,
  navigationGroup?: string
): FocusableElement | null {
  let bestElement: FocusableElement | null = null;
  let highestPriority = -Infinity;

  for (const element of allElements.values()) {
    // Skip disabled elements
    if (element.disabled) continue;

    // Filter by navigation group if specified
    if (navigationGroup && element.navigationGroup !== navigationGroup) continue;

    const priority = element.priority ?? 0;

    if (priority > highestPriority) {
      highestPriority = priority;
      bestElement = element;
    }
  }

  return bestElement;
}
