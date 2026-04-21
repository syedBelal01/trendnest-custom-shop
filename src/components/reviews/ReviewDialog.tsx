import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createReviewApi, uploadReviewMediaApi, type ReviewMedia } from '@/lib/reviewsApi';
import { prepareReviewImageFile } from '@/lib/processProductImage';
import { useProducts } from '@/contexts/ProductsContext';

type LocalReviewMedia = {
  id: string;
  file: File;
  previewUrl: string;
  kind: 'image' | 'video';
};

const MAX_PHOTOS = 3;

export default function ReviewDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  onSubmitted?: () => void;
  initialRating?: number;
  lockRating?: boolean;
}) {
  const { refreshRatingSummary } = useProducts();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [media, setMedia] = useState<LocalReviewMedia[]>([]);
  const [busy, setBusy] = useState(false);
  const [retakeIdx, setRetakeIdx] = useState<number | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    if (props.initialRating && Number.isFinite(props.initialRating)) {
      const v = Math.max(1, Math.min(5, Math.floor(Number(props.initialRating))));
      setRating(v);
    }
    return () => {
      for (const m of media) URL.revokeObjectURL(m.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const canSubmit = useMemo(() => {
    return rating >= 1 && rating <= 5 && !busy;
  }, [rating, busy]);

  const canAddMore = media.length < MAX_PHOTOS && !busy;

  const clearInputs = () => {
    if (captureInputRef.current) captureInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const addOrReplaceMedia = async (raw: File) => {
    const kind: 'image' | 'video' = raw.type?.startsWith('video/') ? 'video' : 'image';
    const processed = kind === 'image' ? await prepareReviewImageFile(raw) : raw;
    const next: LocalReviewMedia = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: processed,
      previewUrl: URL.createObjectURL(processed),
      kind,
    };

    setMedia((prev) => {
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
      let uploaded: ReviewMedia[] = [];
      if (media.length) {
        uploaded = [];
        for (const m of media.slice(0, MAX_PHOTOS)) {
          const out = await uploadReviewMediaApi(m.file);
          uploaded.push(out);
        }
      }
      await createReviewApi({
        productId: props.productId,
        rating,
        comment: comment.trim(),
        media: uploaded,
      });
      await refreshRatingSummary([props.productId]);
      toast.success('Thanks! Your review was submitted.');
      props.onOpenChange(false);
      setComment('');
      setMedia((prev) => {
        for (const m of prev) URL.revokeObjectURL(m.previewUrl);
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

  const removeMediaAt = (idx: number) => {
    setMedia((prev) => {
      const m = prev[idx];
      if (m) URL.revokeObjectURL(m.previewUrl);
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
                  onClick={() => {
                    if (props.lockRating) return;
                    setRating(v);
                  }}
                  disabled={!!props.lockRating}
                  className={`text-3xl sm:text-2xl leading-none p-1 ${active ? 'text-yellow-500' : 'text-muted-foreground/40'} ${props.lockRating ? 'cursor-default' : ''}`}
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
              <div className="text-xs text-muted-foreground">Add media (optional, up to {MAX_PHOTOS})</div>
              <div className="text-xs text-muted-foreground">{media.length}/{MAX_PHOTOS}</div>
            </div>

            <input
              ref={captureInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void addOrReplaceMedia(f).catch((err) => {
                  toast.error(err instanceof Error ? err.message : 'Could not process image');
                  setRetakeIdx(null);
                  clearInputs();
                });
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void addOrReplaceMedia(f).catch((err) => {
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
                📷 Capture
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
            {media.length ? (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m, idx) => (
                  <div key={m.id} className="rounded-xl border bg-muted/20 overflow-hidden">
                    <div className="aspect-square w-full bg-muted">
                      {m.kind === 'video' ? (
                        <video src={m.previewUrl} className="w-full h-full object-cover" controls />
                      ) : (
                        <img src={m.previewUrl} alt={`Review media ${idx + 1}`} className="w-full h-full object-cover" />
                      )}
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
                        onClick={() => removeMediaAt(idx)}
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
