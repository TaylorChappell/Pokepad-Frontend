import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../types';
import { useApp } from '../state/AppContext';
import { apiRequest } from '../services/http';
import { Icon } from './UI';
export const TRAINER_BANNERS = [
  { id: 'meadow', name: 'Viridian' },
  { id: 'ocean', name: 'Cerulean' },
  { id: 'sunset', name: 'Cinnabar' },
  { id: 'midnight', name: 'Lavender' },
] as const;
export function TrainerBanner({
  profile,
  compact = false,
}: {
  profile: Pick<Profile, 'bannerImage' | 'bannerPreset'>;
  compact?: boolean;
}) {
  return (
    <div
      className={
        'trainer-banner banner-' + (profile.bannerPreset || 'meadow') + (compact ? ' compact' : '')
      }
      aria-label="Trainer banner"
    >
      {profile.bannerImage ? (
        <img src={profile.bannerImage} alt="Custom trainer banner" />
      ) : (
        <>
          <span className="banner-ball" />
          <span className="banner-stripe" />
        </>
      )}
    </div>
  );
}
async function prepareImage(file: File, kind: 'avatar' | 'banner'): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)
    throw new Error('Choose a PNG, JPEG or WebP smaller than 2 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 16000000)
      throw new Error('Choose an image smaller than 16 megapixels.');
    const canvas = document.createElement('canvas');
    canvas.width = kind === 'avatar' ? 512 : 1600;
    canvas.height = kind === 'avatar' ? 512 : 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image preview is unavailable.');
    const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
    ctx.drawImage(
      bitmap,
      (canvas.width - bitmap.width * scale) / 2,
      (canvas.height - bitmap.height * scale) / 2,
      bitmap.width * scale,
      bitmap.height * scale,
    );
    return canvas.toDataURL('image/webp', 0.86);
  } finally {
    bitmap.close();
  }
}
export function TrainerImageEditor({
  profile,
  onChange,
  section = 'banner',
}: {
  profile: Profile;
  section?: 'avatar' | 'banner';
  onChange: (patch: Partial<Profile>) => void;
}) {
  const { mode, toast } = useApp(),
    [uploading, setUploading] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const upload = async (file: File | undefined, kind: 'avatar' | 'banner') => {
    if (!file || uploading) return;
    setUploading(kind);
    try {
      const data = await prepareImage(file, kind);
      const image =
        mode === 'demo'
          ? data
          : (
              await apiRequest<{ image: string }>('/v1/uploads/trainer', {
                method: 'POST',
                headers: { 'Idempotency-Key': crypto.randomUUID() },
                json: { kind, imageDataUrl: data },
              })
            ).image;
      if (mounted.current)
        onChange(kind === 'avatar' ? { avatarImage: image } : { bannerImage: image });
    } catch (e) {
      if (mounted.current) toast(e instanceof Error ? e.message : 'Image could not be uploaded.');
    } finally {
      if (mounted.current) setUploading(null);
    }
  };
  return (
    <section className="trainer-image-editor">
      <div className="editor-label-row">
        <h3>{section === 'avatar' ? 'Custom picture' : 'Banner'}</h3>
        <span>Auto saved</span>
      </div>
      {section === 'banner' && <TrainerBanner profile={profile} compact />}
      <div className="trainer-upload-actions">
        {[section].map((kind) => (
          <label className={'button secondary ' + (uploading ? 'disabled' : '')} key={kind}>
            <Icon name="Plus" size={15} />
            {uploading === kind
              ? 'Uploading…'
              : kind === 'avatar'
                ? 'Upload profile picture'
                : 'Upload banner'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={!!uploading}
              aria-label={'Upload custom ' + kind}
              onChange={(e) => {
                void upload(e.target.files?.[0], kind);
                e.target.value = '';
              }}
            />
          </label>
        ))}
        {section === 'avatar' && profile.avatarImage && (
          <button className="text-link" onClick={() => onChange({ avatarImage: null })}>
            Use trainer avatar
          </button>
        )}
      </div>
      <p className="field-help">PNG, JPEG or WebP · up to 2 MB · centred crop</p>
      {section === 'banner' && (
        <div className="banner-presets" aria-label="Preset banners">
          {TRAINER_BANNERS.map((b) => (
            <button
              type="button"
              key={b.id}
              className={
                !profile.bannerImage && (profile.bannerPreset || 'meadow') === b.id
                  ? 'selected'
                  : ''
              }
              aria-pressed={!profile.bannerImage && (profile.bannerPreset || 'meadow') === b.id}
              onClick={() => onChange({ bannerImage: null, bannerPreset: b.id })}
            >
              <TrainerBanner compact profile={{ bannerPreset: b.id }} />
              <span>{b.name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
