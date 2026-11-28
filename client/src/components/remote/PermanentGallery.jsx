import { useEffect, useRef, useState } from 'react';
import { permanentGalleryRequest, readPermanentGallery } from '../../state/permanentGallery.js';
import './permanentGallery.css';

// Image failure is presentation state, never the slideshow's broken-photo effect.
function GalleryImage({ photo, expanded = false }) {
  const [failed, setFailed] = useState(false);
  return <div className={`gallery-media${expanded ? ' gallery-media-expanded' : ''}`}>
    {failed ? <span role="status">Image unavailable · collection unchanged</span>
      : <img src={photo.url} alt={photo.title} loading={expanded ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
  </div>;
}

function GalleryBrowser() {
  const [request, setRequest] = useState({ page: 1, focus: false });
  const [result, setResult] = useState({ status: 'loading' });
  const [selected, setSelected] = useState(null);
  const heading = useRef(null), expandedHeading = useRef(null), thumbnails = useRef([]);
  const returnIndex = useRef(0), returnScroll = useRef(null), inspectorHistory = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setResult(previous => ({ status: 'loading', data: previous.data }));
    const { path, options } = permanentGalleryRequest(request.page);
    fetch(path, { ...options, signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Permanent collection could not be loaded.');
        return response.json();
      })
      .then(readPermanentGallery)
      .then(data => {
        if (!current) return;
        setResult({ status: 'ready', data });
        if (request.expand !== undefined && data.photos.length && inspectorHistory.current === 'open') {
          const index = request.expand === -1 ? data.photos.length - 1 : 0;
          returnIndex.current = index;
          setSelected(index);
        }
      })
      .catch(error => { if (current) setResult({ status: 'error', message: error.message }); });
    return () => { current = false; controller.abort(); };
  }, [request]);

  useEffect(() => {
    if (result.status !== 'loading' && request.focus
      && (request.expand === undefined || result.status === 'error' || result.data?.photos.length === 0 || inspectorHistory.current === null)) heading.current?.focus();
  }, [result, request]);
  useEffect(() => {
    if (selected !== null) {
      const dialog = expandedHeading.current?.closest('dialog');
      if (dialog && !dialog.open) dialog.showModal();
      expandedHeading.current?.focus();
    }
  }, [selected]);

  const page = result.data;
  const changePage = (next, expand) => { returnScroll.current = null; setSelected(null); setRequest({ page: next, focus: true, expand }); };
  const restoreGrid = () => {
    const thumbnail = thumbnails.current[returnIndex.current];
    const target = thumbnail && !thumbnail.disabled ? thumbnail : heading.current;
    if (!target?.isConnected) return;
    target.focus({ preventScroll: returnScroll.current !== null });
    if (returnScroll.current !== null) window.scrollTo({ top: returnScroll.current, behavior: 'instant' });
    else target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  };
  const closeImage = (stepBack = true) => {
    // Keep the modal inert until its one history traversal settles, avoiding a
    // rapid close/reopen being mistaken for the previous inspector's popstate.
    if (stepBack && inspectorHistory.current !== null) {
      if (inspectorHistory.current === 'open') {
        inspectorHistory.current = 'closing'; window.history.back();
      }
      return;
    }
    expandedHeading.current?.closest('dialog')?.close();
    inspectorHistory.current = null;
    setSelected(null); restoreGrid();
  };
  const openImage = index => {
    returnIndex.current = index; returnScroll.current = window.scrollY;
    window.history.pushState({ ...window.history.state, luminaGalleryInspector: true }, '');
    inspectorHistory.current = 'open'; setSelected(index);
  };
  const moveImage = direction => {
    const next = selected + direction;
    if (next >= 0 && next < page.photos.length) setSelected(next);
    else if (next < 0 && page.page > 1) changePage(page.page - 1, -1);
    else if (next >= page.photos.length && page.page < page.pages) changePage(page.page + 1, 0);
  };
  useEffect(() => {
    const onBack = () => {
      if (inspectorHistory.current === null) return;
      closeImage(false);
      // Native history restores scroll after popstate; restore current grid on paint.
      requestAnimationFrame(() => { if (inspectorHistory.current === null) restoreGrid(); });
    };
    window.addEventListener('popstate', onBack);
    return () => {
      window.removeEventListener('popstate', onBack);
      if (inspectorHistory.current === 'open') window.history.back();
      inspectorHistory.current = null;
    };
  }, []);
  useEffect(() => {
    if (request.expand !== undefined && result.status !== 'loading'
      && (result.status === 'error' || result.data?.photos.length === 0) && inspectorHistory.current === 'open') {
      inspectorHistory.current = 'closing'; window.history.back();
    }
  }, [request, result]);
  const selectedPhoto = page?.photos[selected];
  const busy = result.status !== 'ready';
  return <div className="permanent-gallery-browser" aria-busy={result.status === 'loading'}>
    <h3 ref={heading} tabIndex={-1}>Permanent collection images</h3>
    <p>Saved images across pools and Google Photos, including exclusions. Browsing never changes playback or your collection.</p>
    {result.status === 'loading' && <>
      <p role="status">Loading permanent collection…</p>
      {!page && <div className="gallery-loading" aria-hidden="true">
        {[0, 1, 2, 3].map(index => <span className="gallery-media" key={index} />)}
      </div>}
    </>}
    {result.status === 'error' && <div role="alert"><p>{result.message}</p>
      <button onClick={() => setRequest({ ...request, focus: true })}>Retry collection</button></div>}
    {page && <>
      <p role={busy ? undefined : "status"}>{busy && "Previous results · "}{page.total} images · Page {page.page} of {page.pages}</p>
      {page.total === 0 ? <p>No permanent images yet. Use the Permanent Collection switch in the rating deck to save an image.</p> : <>
        <nav aria-label="Collection pages">
          <button disabled={busy || page.page <= 1} onClick={() => changePage(page.page - 1)}>Previous page</button>
          <button disabled={busy || page.page >= page.pages} onClick={() => changePage(page.page + 1)}>Next page</button>
        </nav>
        {selectedPhoto && <dialog className="permanent-gallery-dialog" aria-label="Collection image inspector"
          onCancel={event => { event.preventDefault(); closeImage(); }}>
          <section className="permanent-gallery-expanded" aria-label="Expanded collection image"
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeImage(); }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault(); event.stopPropagation(); moveImage(event.key === 'ArrowLeft' ? -1 : 1);
            }
          }}>
          <div className="gallery-detail-content">
          <h4 ref={expandedHeading} tabIndex={-1}>{selectedPhoto.title} · Image {(page.page - 1) * 24 + selected + 1} of {page.total}</h4>
          <GalleryImage key={selectedPhoto.url} photo={selectedPhoto} expanded />
          <p className="gallery-attribution">{selectedPhoto.author || "Attribution unavailable"}</p>
          <p>{selectedPhoto.pool}{selectedPhoto.exclusions.length > 0 && ` · ${selectedPhoto.exclusions.join(' · ')}`}</p>
          </div>
          <nav aria-label="Expanded image controls">
            <button disabled={selected === 0 && page.page === 1} onClick={() => moveImage(-1)}>Previous image</button>
            <button disabled={selected === page.photos.length - 1 && page.page === page.pages} onClick={() => moveImage(1)}>Next image</button>
            <button onClick={() => closeImage()}>Close image</button>
          </nav>
          <small>Use arrow keys for adjacent images, including across pages. Escape returns to the grid.</small>
        </section></dialog>}
        <ul className="permanent-gallery-grid" aria-label="Permanent image thumbnails">
          {page.photos.map((photo, index) => <li key={photo.url}>
            <button ref={node => { thumbnails.current[index] = node; }} onClick={() => openImage(index)}
              disabled={busy} aria-label={`Open ${photo.title}`} aria-expanded={selected === index}>
              <GalleryImage photo={photo} /><span className="gallery-card-title"><span title={photo.title}>{photo.title}</span></span>
            </button>
            <small>{photo.pool}{photo.exclusions.length > 0 && ` · ${photo.exclusions.join(' · ')}`}</small>
          </li>)}
        </ul>
      </>}
    </>}
  </div>;
}

export default function PermanentGallery() {
  const [open, setOpen] = useState(false);
  return <section className="permanent-gallery">
    <button className="permanent-gallery-toggle" aria-expanded={open} aria-controls="permanent-gallery-content"
      onClick={() => setOpen(value => !value)}>Permanent Collection Gallery</button>
    {open && <div id="permanent-gallery-content"><GalleryBrowser /></div>}
  </section>;
}
