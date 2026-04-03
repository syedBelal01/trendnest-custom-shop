import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createReviewApi, uploadReviewImageApi, type ReviewImage } from '@/lib/reviewsApi';
import { prepareReviewImageFile } from '@/lib/processProductImage';

type LocalReviewPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_PHOTOS = 3;

export default function ReviewDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  onSubmitted?: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<LocalReviewPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [retakeIdx, setRetakeIdx] = useState<number | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const canSubmit = useMemo(() => {
    return rating >= 1 && rating <= 5 && !busy;
  }, [rating, busy]);

  const canAddMore = photos.length < MAX_PHOTOS && !busy;

  const clearInputs = () => {
    if (captureInputRef.current) captureInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const addOrReplacePhoto = async (raw: File) => {
    const processed = await prepareReviewImageFile(raw);
    const next: LocalReviewPhoto = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: processed,
      previewUrl: URL.createObjectURL(processed),
    };

    setPhotos((prev) => {
      if (retakeIdx !== null) {
        const idx = Math.max(0, Math.min(prev.length - 1, retakeIdx));
        const existing = prev[idx];
        if (existing) URL.revokeObjectURL(existing.previewUrl);
        const copy = [...prev];
        copy[idx] = next;
        return copy;
      }
      if (prev.length >= MAX_PHOTOS) return prev;
      return [...prev, next];
    });
    setRetakeIdx(null);
    clearInputs();
  };

  const submit = async () => {
    setBusy(true);
    try {
      let images: ReviewImage[] = [];
      if (photos.length) {
        images = [];
        for (const p of photos.slice(0, MAX_PHOTOS)) {
          const img = await uploadReviewImageApi(p.file);
          images.push(img);
        }
      }
      await createReviewApi({
        productId: props.productId,
        rating,
        comment: comment.trim(),
        images,
      });
      toast.success('Thanks! Your review was submitted.');
      props.onOpenChange(false);
      setComment('');
      setPhotos((prev) => {
        for (const p of prev) URL.revokeObjectURL(p.previewUrl);
        return [];
      });
      setRating(5);
      props.onSubmitted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit review');
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const p = prev[idx];
      if (p) URL.revokeObjectURL(p.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
    if (retakeIdx === idx) setRetakeIdx(null);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md mx-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Write a review</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm">
            <div className="font-semibold truncate">{props.productName}</div>
            <div className="text-muted-foreground text-xs">Rate 1–5 stars and share your experience.</div>
          </div>

          {/* Stars — larger touch targets */}
          <div className="flex items-center gap-3">
            {Array.from({ length: 5 }, (_, i) => {
              const v = i + 1;
              const active = v <= rating;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRating(v)}
                  className={`text-3xl sm:text-2xl leading-none p-1 ${active ? 'text-yellow-500' : 'text-muted-foreground/40'}`}
                  aria-label={`${v} star`}
                >
                  ★
                </button>
              );
            })}
          </div>

          <textarea
            className="w-full min-h-[80px] sm:min-h-[96px] rounded-xl border bg-background px-3 py-2.5 text-sm resize-none"
            placeholder="Write a short comment (optional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
          />

          {/* Photo section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">Add photos (optional, up to {MAX_PHOTOS})</div>
              <div className="text-xs text-muted-foreground">{photos.length}/{MAX_PHOTOS}</div>
            </div>

            <input
              ref={captureInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void addOrReplacePhoto(f).catch((err) => {
                  toast.error(err instanceof Error ? err.message : 'Could not process image');
                  setRetakeIdx(null);
                  clearInputs();
                });
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void addOrReplacePhoto(f).catch((err) => {
                  toast.error(err instanceof Error ? err.message : 'Could not process image');
                  setRetakeIdx(null);
                  clearInputs();
                });
              }}
            />

            {/* Buttons — full width stacked on mobile */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!canAddMore}
                className="h-10 text-xs sm:text-sm flex-1"
                onClick={() => {
                  setRetakeIdx(null);
                  captureInputRef.current?.click();
                }}
              >
                📷 Capture Image
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canAddMore}
                className="h-10 text-xs sm:text-sm flex-1"
                onClick={() => {
                  setRetakeIdx(null);
                  galleryInputRef.current?.click();
                }}
              >
                🖼️ Add from gallery
              </Button>
            </div>

            {/* Photo previews — responsive grid */}
            {photos.length ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p, idx) => (
                  <div key={p.id} className="rounded-xl border bg-muted/20 overflow-hidden">
                    <div className="aspect-square w-full bg-muted">
                      <img src={p.previewUrl} alt={`Review photo ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-1.5 flex items-center justify-between gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        className="text-[10px] h-7 px-2 flex-1"
                        onClick={() => {
                          setRetakeIdx(idx);
                          captureInputRef.current?.click();
                        }}
                      >
                        Retake
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        className="text-[10px] h-7 px-2"
                        onClick={() => removePhoto(idx)}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <Button className="w-full h-11 rounded-xl text-sm" disabled={!canSubmit} onClick={() => void submit()}>
            {busy ? 'Submitting…' : 'Submit Review'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
