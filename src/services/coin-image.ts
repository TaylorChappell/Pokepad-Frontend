import { apiRequest } from './http';

export const COIN_IMAGE_LIMIT = 2 * 1024 * 1024;
export function imageLink(value: string): string | null {
  const raw = value.trim();
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    if (/(^|\.)google\.(com|co\.uk|[a-z]{2})$/.test(url.hostname) && url.searchParams.has('imgurl'))
      return imageLink(url.searchParams.get('imgurl')!);
    return url.href;
  } catch {
    return null;
  }
}
export function transferredImage(
  data: Pick<DataTransfer, 'files' | 'items' | 'getData'>,
): File | string | null {
  const file =
    Array.from(data.files || [])[0] ||
    Array.from(data.items || [])
      .find((item) => item.kind === 'file')
      ?.getAsFile();
  if (file) return file;
  const html = data.getData('text/html');
  const doc =
    html && html.length <= 1_000_000 ? new DOMParser().parseFromString(html, 'text/html') : null;
  const uri = data
    .getData('text/uri-list')
    .split(/\r?\n/)
    .find((line) => line.trim() && !line.startsWith('#'));
  // Google result links may contain the original image URL; otherwise use the dragged image itself.
  for (const value of [
    uri,
    ...Array.from(doc?.querySelectorAll('a[href]') || []).map((a) => a.getAttribute('href')),
  ]) {
    if (value && /[?&]imgurl=/.test(value)) {
      const direct = imageLink(value);
      if (direct) return direct;
    }
  }
  for (const value of [
    doc?.querySelector('img')?.getAttribute('src'),
    uri,
    data.getData('text/plain'),
  ]) {
    const candidate = value && imageLink(value);
    if (candidate) return candidate;
  }
  return null;
}
export async function readCoinImage(file: File, live: boolean): Promise<string> {
  const allowed = ['image/png', 'image/jpeg', 'image/webp', ...(live ? [] : ['image/gif'])];
  if (!allowed.includes(file.type))
    throw new Error(
      live ? 'Choose a PNG, JPG or WebP image.' : 'Choose a PNG, JPG, WebP or GIF image.',
    );
  if (!file.size || file.size > COIN_IMAGE_LIMIT)
    throw new Error('Choose an image smaller than 2 MB.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This image could not be read.'));
    reader.readAsDataURL(file);
  });
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      image.naturalWidth > 0 &&
      image.naturalHeight > 0 &&
      image.naturalWidth <= 4096 &&
      image.naturalHeight <= 4096
        ? resolve()
        : reject(new Error('Use an image up to 4096 × 4096 pixels.'));
    image.onerror = () => reject(new Error('This image could not be opened. Try another one.'));
    image.src = data;
  });
  return data;
}
export async function importCoinImage(
  source: File | string,
  live: boolean,
  signal: AbortSignal,
): Promise<string> {
  if (typeof source !== 'string') return readCoinImage(source, live);
  const url = imageLink(source);
  if (!url) throw new Error('Paste an image or a direct image link.');
  if (url.startsWith('data:')) {
    if (url.length > 2_900_000) throw new Error('Choose an image smaller than 2 MB.');
    const response = await fetch(url, { signal });
    const blob = await response.blob();
    return readCoinImage(new File([blob], 'pasted-image', { type: blob.type }), live);
  }
  if (live) {
    const result = await apiRequest<{ imageDataUrl: string }>('/v1/uploads/image-import', {
      method: 'POST',
      json: { url },
      signal,
    });
    return result.imageDataUrl;
  }
  try {
    const response = await fetch(url, {
      signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok || Number(response.headers.get('content-length')) > COIN_IMAGE_LIMIT)
      throw new Error();
    const reader = response.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > COIN_IMAGE_LIMIT) {
        await reader.cancel();
        throw new Error();
      }
      chunks.push(value as Uint8Array<ArrayBuffer>);
    }
    return readCoinImage(
      new File(chunks, 'linked-image', {
        type: response.headers.get('content-type')?.split(';')[0] || '',
      }),
      false,
    );
  } catch {
    throw new Error(
      'That website couldn’t share the image. Try Copy image and paste it here, or upload the saved image.',
    );
  }
}
