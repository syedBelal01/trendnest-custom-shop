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

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const q = Math.min(1, Math.max(0.05, quality));
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode this image in the browser.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      q
    );
  });
}

export async function prepareReviewImageFile(
  file: File,
  opts?: {
    maxEdge?: number;
    maxBytes?: number;
    initialQuality?: number;
    minQuality?: number;
  }
): Promise<File> {
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowed.has(file.type)) {
    throw new Error('Please choose a JPG, PNG, or WebP image.');
  }

  const maxEdge = opts?.maxEdge ?? 1920;
  const maxBytes = opts?.maxBytes ?? 2_000_000;
  const initialQuality = opts?.initialQuality ?? 0.85;
  const minQuality = opts?.minQuality ?? 0.55;

  const bitmap = await createImageBitmap(file);
  try {
    let { width, height } = bitmap;
    const max = Math.max(width, height);
    if (max > maxEdge) {
      const scale = maxEdge / max;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image in this browser.');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let q = initialQuality;
    let blob = await canvasToJpegBlob(canvas, q);
    while (blob.size > maxBytes && q > minQuality) {
      q = Math.max(minQuality, Math.round((q - 0.1) * 100) / 100);
      blob = await canvasToJpegBlob(canvas, q);
    }

    const safeNameBase = `review-${Date.now()}`;
    return new File([blob], `${safeNameBase}.jpg`, { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}

export function formatDataUrlSizeKb(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  return Math.round((base64.length * 3) / 4 / 1024);
}
