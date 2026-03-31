/**
 * Resize (longest edge) and compress an image in the browser for product photos.
 * Output is JPEG for predictable size; transparency is flattened on white.
 */
export async function processProductImageFile(
  file: File,
  opts: { maxEdge: number; quality: number }
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG, WebP, etc.).');
  }

  const bitmap = await createImageBitmap(file);
  try {
    let { width, height } = bitmap;
    const max = Math.max(width, height);
    if (max > opts.maxEdge) {
      const scale = opts.maxEdge / max;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image in this browser.');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const q = Math.min(1, Math.max(0.05, opts.quality));
    return canvas.toDataURL('image/jpeg', q);
  } finally {
    bitmap.close();
  }
}

export function formatDataUrlSizeKb(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  return Math.round((base64.length * 3) / 4 / 1024);
}
