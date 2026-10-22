import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Icon } from './UI';
import { imageLink, importCoinImage, transferredImage } from '../services/coin-image';

export function CoinImagePicker({
  value,
  onChange,
  onBusyChange,
  live,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onBusyChange: (value: boolean) => void;
  live: boolean;
  disabled?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const active = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [filename, setFilename] = useState('');
  const importImage = useCallback(
    async (source: File | string) => {
      if (disabled) return;
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      setError('');
      setLoading(true);
      onBusyChange(true);
      try {
        const image = await importCoinImage(source, live, controller.signal);
        if (active.current !== controller || controller.signal.aborted) return;
        onChange(image);
        setFilename(typeof source === 'string' ? 'Image added' : source.name);
        setLinkOpen(false);
        setLink('');
      } catch (e) {
        if (!controller.signal.aborted && active.current === controller)
          setError(e instanceof Error ? e.message : 'Please try another image.');
      } finally {
        if (active.current === controller) {
          active.current = null;
          setLoading(false);
          onBusyChange(false);
        }
        if (fileInput.current) fileInput.current.value = '';
      }
    },
    [disabled, live, onChange, onBusyChange],
  );
  useEffect(
    () => () => {
      active.current?.abort();
      onBusyChange(false);
    },
    [onBusyChange],
  );
  useEffect(() => {
    const paste = (event: globalThis.ClipboardEvent) => {
      if (disabled || !event.clipboardData || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const editable = target?.closest('input,textarea,[contenteditable="true"]');
      const hasFile = Array.from(event.clipboardData.items).some((item) => item.kind === 'file');
      if (editable && !hasFile) return;
      const source = transferredImage(event.clipboardData);
      if (!source) return;
      event.preventDefault();
      void importImage(source);
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, [importImage, disabled]);
  function drop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    const source = transferredImage(event.dataTransfer);
    if (source) void importImage(source);
    else setError('Drop an image here, or use Copy image and paste it.');
  }
  const types = live ? 'PNG, JPG or WebP' : 'PNG, JPG, WebP or GIF';
  return (
    <div className="coin-image-field">
      <div className="image-field-label">
        <label className="creation-label" htmlFor="coin-image">
          Coin image
        </label>
        <small>{live ? 'Required' : 'Optional'}</small>
      </div>
      <div
        className={
          'coin-image-dropzone' +
          (dragging ? ' is-dragging' : '') +
          (value ? ' has-image' : '') +
          (loading ? ' is-loading' : '')
        }
        ref={zone}
        tabIndex={0}
        role="group"
        aria-label="Coin image: upload, drop or paste"
        aria-busy={loading}
        aria-describedby="coin-image-help"
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) {
            dragDepth.current++;
            setDragging(true);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (--dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={drop}
      >
        <div className="image-scanner-corners" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <input
          ref={fileInput}
          id="coin-image"
          className="creation-file-input"
          type="file"
          accept={'image/png,image/jpeg,image/webp' + (live ? '' : ',image/gif')}
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importImage(file);
          }}
          disabled={disabled}
        />
        <button
          type="button"
          className="coin-image-choose"
          onClick={() => fileInput.current?.click()}
          disabled={disabled}
          aria-label={value ? 'Change coin image' : 'Upload coin image'}
        >
          {value ? (
            <img src={value} alt="Your coin image" />
          ) : (
            <>
              <span className="image-upload-symbol">
                <Icon name="Upload" size={30} />
              </span>
              <strong>Drop your coin image</strong>
              <span>or click to upload</span>
              <small>You can paste an image here, too.</small>
            </>
          )}
          {value && (
            <span className="image-replace-label">
              <Icon name="Upload" size={15} />
              Change image
            </span>
          )}
        </button>
        {(dragging || loading) && (
          <div className="image-drop-overlay" aria-live="polite">
            <Icon name={loading ? 'Pokeball' : 'Upload'} size={34} />
            <strong>{loading ? 'Preparing image…' : 'Drop it here!'}</strong>
          </div>
        )}
      </div>
      <div className="image-picker-tools">
        <button
          type="button"
          onClick={() => setLinkOpen(!linkOpen)}
          disabled={disabled}
          aria-expanded={linkOpen}
        >
          <Icon name="Link" size={15} />
          Image link
        </button>
        {value && (
          <button
            type="button"
            className="image-remove"
            disabled={disabled}
            onClick={() => {
              active.current?.abort();
              active.current = null;
              setLoading(false);
              onBusyChange(false);
              onChange('');
              setFilename('');
              setError('');
            }}
          >
            <Icon name="X" size={13} />
            Remove
          </button>
        )}
      </div>
      {linkOpen && (
        <div className="image-link-entry">
          <label htmlFor="coin-image-link" className="sr-only">
            Image URL
          </label>
          <input
            id="coin-image-link"
            className="creation-input"
            type="url"
            placeholder="Paste an image link"
            autoFocus
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (imageLink(link)) void importImage(link);
              }
            }}
          />
          <button
            type="button"
            aria-label="Use image link"
            disabled={!imageLink(link) || disabled || loading}
            onClick={() => void importImage(link)}
          >
            <Icon name="ArrowRight" size={18} />
          </button>
        </div>
      )}
      <p id="coin-image-help" className="image-format-hint">
        {types} · max 2 MB
      </p>
      {filename && value && (
        <p className="image-success" role="status">
          <Icon name="Check" size={13} />
          {filename}
        </p>
      )}
      {error && (
        <p className="creation-error image-import-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
