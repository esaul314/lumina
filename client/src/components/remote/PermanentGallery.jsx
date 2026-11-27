import { useEffect, useRef, useState } from 'react';
import { permanentGalleryRequest, readPermanentGallery } from '../../state/permanentGallery.js';
import './permanentGallery.css';

// Image failure is presentation state, never the slideshow's broken-photo effect.
function GalleryImage({ photo, expanded = false }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span role="status">Image unavailable · collection unchanged</span>
    : <img src={photo.url} alt={photo.title} loading={expanded ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function GalleryBrowser() {
  const [request, setRequest] = useState({ page: 1, focus: false });
  const [result, setResult] = useState({ status: 'loading' });
  const [selected, setSelected] = useState(null);
  const heading = useRef(null), expandedHeading = useRef(null), thumbnails = useRef([]);
  const returnIndex = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setResult({ status: 'loading' });
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
        if (request.expand !== undefined && data.photos.length) {
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
      && (request.expand === undefined || result.status === 'error' || result.data?.photos.length === 0)) heading.current?.focus();
  }, [result, request]);
  useEffect(() => {
    if (selected !== null) expandedHeading.current?.focus();
  }, [selected]);

  const page = result.data;
  const changePage = (next, expand) => { setSelected(null); setRequest({ page: next, focus: true, expand }); };
  const closeImage = () => { setSelected(null); thumbnails.current[returnIndex.current]?.focus(); };
  const openImage = index => { returnIndex.current = index; setSelected(index); };
  const moveImage = direction => {
    const next = selected + direction;
    if (next >= 0 && next < page.photos.length) setSelected(next);
    else if (next < 0 && page.page > 1) changePage(page.page - 1, -1);
    else if (next >= page.photos.length && page.page < page.pages) changePage(page.page + 1, 0);
  };
  const selectedPhoto = page?.photos[selected];
  return <div className="permanent-gallery-browser" aria-busy={result.status === 'loading'}>
    <h3 ref={heading} tabIndex={-1}>Permanent collection images</h3>
    <p>All saved permanent images, including exclusions, across pools and Google Photos. Viewing does not change playback, ratings or membership.</p>
    {result.status === 'loading' && <p role="status">Loading permanent collection…</p>}
    {result.status === 'error' && <div role="alert"><p>{result.message}</p>
      <button onClick={() => setRequest({ ...request, focus: true })}>Retry collection</button></div>}
    {result.status === 'ready' && <>
      <p role="status">{page.total} images · Page {page.page} of {page.pages}</p>
      {page.total === 0 ? <p>No permanent images yet. Use the Permanent Collection switch in the rating deck to save an image.</p> : <>
        <nav aria-label="Collection pages">
          <button disabled={page.page <= 1} onClick={() => changePage(page.page - 1)}>Previous page</button>
          <button disabled={page.page >= page.pages} onClick={() => changePage(page.page + 1)}>Next page</button>
        </nav>
        {selectedPhoto && <section className="permanent-gallery-expanded" aria-label="Expanded collection image"
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeImage(); }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault(); moveImage(event.key === 'ArrowLeft' ? -1 : 1);
            }
          }}>
          <h4 ref={expandedHeading} tabIndex={-1}>{selectedPhoto.title} · Image {(page.page - 1) * 24 + selected + 1} of {page.total}</h4>
          <GalleryImage key={selectedPhoto.url} photo={selectedPhoto} expanded />
          <p>{selectedPhoto.pool}{selectedPhoto.exclusions.length > 0 && ` · ${selectedPhoto.exclusions.join(' · ')}`}</p>
          <nav aria-label="Expanded image controls">
            <button disabled={selected === 0 && page.page === 1} onClick={() => moveImage(-1)}>Previous image</button>
            <button disabled={selected === page.photos.length - 1 && page.page === page.pages} onClick={() => moveImage(1)}>Next image</button>
            <button onClick={closeImage}>Close image</button>
          </nav>
          <small>Use arrow keys for adjacent images, including across pages. Escape returns to the grid.</small>
        </section>}
        <ul className="permanent-gallery-grid" aria-label="Permanent image thumbnails">
          {page.photos.map((photo, index) => <li key={photo.url}>
            <button ref={node => { thumbnails.current[index] = node; }} onClick={() => openImage(index)}
              aria-label={`Open ${photo.title}`} aria-expanded={selected === index}>
              <GalleryImage photo={photo} /><span>{photo.title}</span>
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
