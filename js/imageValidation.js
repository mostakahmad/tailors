import { LOW_RES_EDGE, MAX_FILE_BYTES, MAX_IMAGE_EDGE, MIN_IMAGE_EDGE } from './config.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

export function validateFileMeta(file) {
  if (!file) return { ok: false, code: 'missing' };
  if (!file.size) return { ok: false, code: 'empty' };
  if (file.size > MAX_FILE_BYTES) return { ok: false, code: 'too_large' };
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '');
  if (type === 'image/svg+xml' || /\.svg$/i.test(name)) return { ok: false, code: 'format' };
  const extOk = /\.(jpe?g|png|webp)$/i.test(name);
  const typeOk = ALLOWED_TYPES.has(type);
  if (!typeOk && !extOk) return { ok: false, code: 'format' };
  return { ok: true };
}

export async function readImageFile(file) {
  const meta = validateFileMeta(file);
  if (!meta.ok) return meta;
  try {
    const { width, height } = await measureImage(file);
    if (width < MIN_IMAGE_EDGE || height < MIN_IMAGE_EDGE) {
      return { ok: false, code: 'too_small' };
    }
    if (width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE) {
      return { ok: false, code: 'dimensions' };
    }
    const warnings = [];
    if (width < LOW_RES_EDGE || height < LOW_RES_EDGE) warnings.push('low_resolution');
    const objectUrl = URL.createObjectURL(file);
    return {
      ok: true,
      objectUrl,
      width,
      height,
      mime: file.type || 'image/*',
      name: file.name || 'photo',
      warnings,
    };
  } catch {
    return { ok: false, code: 'decode' };
  }
}

async function measureImage(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  }
  const url = URL.createObjectURL(file);
  try {
    const size = await loadElementSize(url);
    return size;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadElementSize(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });
}
