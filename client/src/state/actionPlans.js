// @ts-check

/**
 * Build a durable state patch from a partially applied field policy.
 *
 * Keeping this projection pure gives the action hook a small, typed seam:
 * transport and React state effects remain outside the functional core.
 *
 * @param {string} field
 * @returns {(value: unknown) => Record<string, unknown>}
 */
const buildFieldPatch = (field) => (value) => ({
  [field]: value
});

/**
 * Build the nested widget patch used by the REST state command.
 *
 * @param {string} widgetName
 * @returns {(visible: boolean) => { widgets: Record<string, boolean> }}
 */
const buildWidgetVisibilityPatch = (widgetName) => (visible) => ({
  widgets: { [widgetName]: visible }
});

export {
  buildFieldPatch,
  buildWidgetVisibilityPatch
};
