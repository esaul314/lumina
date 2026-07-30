// @ts-check

/**
 * Identify Unsplash premium/plus preview rows using both API metadata and the
 * durable CDN marker that survives persistence.
 * @param {Record<string, any> | null | undefined} photo
 */
function isDisallowedUnsplashPhoto(photo) {
  if (!photo || photo.source !== 'unsplash') return false;
  return Boolean(
    photo.premium || photo.plus || photo.isPremium || photo.isPlus ||
    photo.is_premium || photo.is_plus ||
    String(photo.url || '').includes('plus.unsplash.com')
  );
}

module.exports = { isDisallowedUnsplashPhoto };
