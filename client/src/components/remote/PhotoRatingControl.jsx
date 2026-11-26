function PhotoRatingControl({ photo, onRate, sideLabel = '' }) {
  const unrated = photo.rating === null || photo.rating === undefined;
  const label = unrated ? 'Unrated'
    : photo.rating === 1 ? '1 · Banned / blocked'
      : typeof photo.rating === 'number' ? `${photo.rating} / 10` : `Legacy rating: ${String(photo.rating)}`;
  return (
    <fieldset className="photo-rating-control" aria-label={`Photo rating${sideLabel}`}>
      <legend>Photo rating{sideLabel}</legend>
      <div className="photo-rating-summary">
        <span>{label}</span>
        <button type="button" className="remote-btn" disabled={unrated}
          onClick={() => onRate(photo.url, null)}>Reset to unrated</button>
      </div>
      <div className="image-feeds-rating-scale">
        {Array.from({ length: 10 }, (_, index) => index + 1).map(rating => {
          const selected = !unrated && photo.rating === rating;
          return (
            <button key={rating} type="button" className="remote-btn"
              aria-label={`Set rating ${rating} for ${photo.title}`}
              aria-pressed={selected} onClick={() => onRate(photo.url, rating)}
              style={{ background: selected ? 'var(--accent-color)' : undefined }}>
              {rating}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default PhotoRatingControl;
