// @ts-check

/**
 * The Image Feeds workspace intentionally keeps its panel vocabulary small.
 * A stable identifier makes the view state serializable and gives a future
 * TypeScript migration a narrow discriminated-union seam.
 */
export const IMAGE_FEEDS_PANEL_IDS = Object.freeze({
  RATING: 'rating',
  SOURCES: 'sources'
});

/**
 * @typedef {{open: Record<string, boolean>, maximized: string|null}} ImageFeedsPanelState
 */

/**
 * @returns {ImageFeedsPanelState}
 */
export const createImageFeedsPanelState = () => ({
  open: {
    [IMAGE_FEEDS_PANEL_IDS.RATING]: true,
    [IMAGE_FEEDS_PANEL_IDS.SOURCES]: true
  },
  maximized: null
});

/**
 * Toggle one panel without mutating the previous view model.
 *
 * @param {ImageFeedsPanelState} panelState
 * @param {string} panelId
 * @returns {ImageFeedsPanelState}
 */
export const toggleImageFeedsPanel = (panelState, panelId) => ({
  ...panelState,
  open: {
    ...panelState.open,
    [panelId]: !panelState.open?.[panelId]
  }
});

/**
 * Maximize a panel for focused editing, or restore the two-panel workspace.
 * Maximizing always opens the selected panel so the action is never hidden.
 *
 * @param {ImageFeedsPanelState} panelState
 * @param {string} panelId
 * @returns {ImageFeedsPanelState}
 */
export const toggleImageFeedsPanelMaximized = (panelState, panelId) => ({
  ...panelState,
  open: {
    ...panelState.open,
    [panelId]: true
  },
  maximized: panelState.maximized === panelId ? null : panelId
});
