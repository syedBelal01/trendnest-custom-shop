import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { createReviewApi, uploadReviewImageApi, type ReviewImage } from '@/lib/reviewsApi';

export default function ReviewDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  onSubmitted?: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return rating >= 1 && rating <= 5 && !busy;
  }, [rating, busy]);

  const submit = async () => {
    setBusy(true);
    try {
      let images: ReviewImage[] = [];
      if (files.length) {
        images = [];
        for (const f of files.slice(0, 6)) {
          // sequential uploads to keep it simple + reliable
          const img = await uploadReviewImageApi(f);
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
      setFiles([]);
      setRating(5);
      props.onSubmitted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit review');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Write a review</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm">
            <div className="font-semibold">{props.productName}</div>
            <div className="text-muted-foreground text-xs">Rate 1–5 stars and share your experience.</div>
          </div>

          <div className="flex items-center gap-2">
            {Array.from({ length: 5 }, (_, i) => {
              const v = i + 1;
              const active = v <= rating;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRating(v)}
                  className={`text-2xl leading-none ${active ? 'text-yellow-500' : 'text-muted-foreground/40'}`}
                  aria-label={`${v} star`}
                >
                  ★
                </button>
              );
            })}
          </div>

          <textarea
            className="w-full min-h-[96px] rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Write a short comment (optional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
          />

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Upload images (optional, up to 6)</div>
            <Input
              type="file"
              multiple
              accept="image/*"
              onChange={e => {
                const next = Array.from(e.target.files || []);
                setFiles(next.slice(0, 6));
              }}
            />
          </div>

          <Button className="w-full" disabled={!canSubmit} onClick={() => void submit()}>
            {busy ? 'Submitting…' : 'Submit Review'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

