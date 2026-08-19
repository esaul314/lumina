const DISMISSAL_EVENT_TYPES = new Set([
  'keydown',
  'mousedown',
  'mousemove',
  'scroll',
  'touchstart'
]);

const isEscapeKey = (event) => event?.key === 'Escape' || event?.code === 'Escape';

const isScreensaverDismissalActivity = ({ screensaverActive, event }) => (
  Boolean(screensaverActive)
  && DISMISSAL_EVENT_TYPES.has(event?.type)
);

export {
  isEscapeKey,
  isScreensaverDismissalActivity
};
