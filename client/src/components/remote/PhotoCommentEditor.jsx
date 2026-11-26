import { useEffect, useId, useState } from 'react';
import { getPhotoComment, setPhotoComment } from '../../api/luminaClient.js';

const requireComment = result => {
  if (typeof result?.comment !== 'string') throw new Error('Invalid comment response.');
  return result.comment;
};

function PhotoCommentEditor({ url }) {
  const id = useId();
  // ponytail: drafts live only in this admin tab; no private data in shared state.
  const [entries, setEntries] = useState({});
  const [retry, setRetry] = useState(0);
  const entry = entries[url];
  const update = (key, patch) => setEntries(current => ({
    ...current, [key]: { ...current[key], ...patch }
  }));

  useEffect(() => {
    // Retain per-photo drafts across selection; never accept an old GET on a new photo.
    if (entry?.saved !== undefined) return;
    let active = true;
    update(url, { status: 'loading', error: '' });
    getPhotoComment(url).then(requireComment).then(comment => {
      if (active) update(url, { saved: comment, draft: comment, status: 'ready', error: '' });
    }).catch(error => {
      if (active) update(url, { status: 'error', error: error.message });
    });
    return () => { active = false; };
  }, [url, retry]);

  const loaded = entry?.saved !== undefined;
  const saving = entry?.status === 'saving';
  const dirty = loaded && entry.draft !== entry.saved;
  const save = async comment => {
    update(url, { status: 'saving', error: '' });
    try {
      const saved = requireComment(await setPhotoComment(url, comment));
      // Captured URL keeps an in-flight save from overwriting another photo's draft.
      update(url, { saved, draft: saved, status: 'ready', error: '' });
    } catch (error) {
      update(url, { status: 'ready', error: error.message });
    }
  };

  return (
    <section aria-label="Private photo comment" style={{ margin: '16px 0' }}>
      <details key={url} className="photo-comment-disclosure" open={Boolean(entry?.expanded)}
        onToggle={event => update(url, { expanded: event.currentTarget.open })}>
        <summary aria-expanded={Boolean(entry?.expanded)} aria-controls={`${id}-editor`}>
          {loaded ? (entry.saved ? 'View/edit comment' : 'Add comment') : 'Private comment'}
        </summary>
        <div id={`${id}-editor`}>
          <label htmlFor={id} style={{ fontSize: '0.82rem', fontWeight: 600 }}>Private photo comment</label>
          <p id={`${id}-help`} style={{ fontSize: '0.72rem', opacity: 0.6 }}>
            Plain text for local curation; not shown on the TV. Drafts stay while this tab is open.
          </p>
          <textarea id={id} aria-describedby={`${id}-help ${id}-count`} maxLength={2000}
            rows={3} value={entry?.draft ?? ''} disabled={!loaded || saving}
            onChange={event => update(url, { draft: event.target.value, error: '' })}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px',
              color: 'inherit', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px', font: 'inherit' }} />
          <div id={`${id}-count`} style={{ fontSize: '0.72rem' }}>{entry?.draft?.length ?? 0}/2000</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="remote-btn" disabled={!dirty || saving} onClick={() => save(entry.draft)}>Save comment</button>
            <button className="remote-btn" disabled={!loaded || saving || (!entry.saved && !entry.draft)} onClick={() => save('')}>Clear comment</button>
            {!loaded && entry?.status === 'error' && (
              <button className="remote-btn" onClick={() => setRetry(value => value + 1)}>Retry loading comment</button>
            )}
          </div>
        </div>
      </details>
      <div role="status" aria-live="polite" style={{ fontSize: '0.75rem', marginTop: '6px' }}>
        {saving ? 'Saving comment…' : !loaded ? (entry?.status === 'error' ? 'Unable to load comment' : 'Loading comment…') : entry?.error ? 'Comment not saved' : dirty ? 'Unsaved comment' : entry.saved ? 'Comment saved' : 'No comment'}
      </div>
      {entry?.error && <p role="alert">{entry.error}</p>}
    </section>
  );
}

export default PhotoCommentEditor;
