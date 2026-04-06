import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Trash2, Plus, Upload, ImageIcon } from 'lucide-react';

function VariantThumbImg({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/50">
      <img src={src} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        aria-label="Remove image"
        className="absolute right-1 top-1 rounded-md bg-background/95 p-1 shadow-sm ring-1 ring-border hover:bg-destructive hover:text-destructive-foreground"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function VariantOptionsCard(props: {
  variantOptions: Array<{ name: string; images: string[] }> | undefined;
  variantUrlDraft: Record<number, string>;
  setVariantUrlDraft: (next: (prev: Record<number, string>) => Record<number, string>) => void;
  maxEdge: number;
  setMaxEdge: (n: number) => void;
  qualityPct: number;
  setQualityPct: (n: number) => void;
  imageBusy: boolean;
  variantFileRef: React.RefObject<HTMLInputElement>;
  onVariantFilesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenVariantUpload: (vidx: number) => void;
  onUpdateVariantName: (vidx: number, name: string) => void;
  onRemoveVariantRow: (vidx: number) => void;
  onRemoveVariantImageAt: (vidx: number, imgIdx: number) => void;
  onAddVariantImageUrl: (vidx: number) => void;
  onAddVariantRow: () => void;
}) {
  const opts = props.variantOptions ?? [{ name: '', images: [] as string[] }];
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-3">
      <div>
        <p className="text-sm font-medium">Colors / finishes</p>
        <p className="text-xs text-muted-foreground mt-1">
          One card per option. The storefront switches photos when the customer picks a finish.
        </p>
      </div>
      <input
        ref={props.variantFileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={props.onVariantFilesChange}
      />
      <div className="space-y-2">
        <div className="flex justify-between gap-2 text-xs">
          <Label htmlFor="img-max-edge">Max edge (px)</Label>
          <span className="text-muted-foreground tabular-nums">{props.maxEdge}px</span>
        </div>
        <Slider
          id="img-max-edge"
          min={400}
          max={1920}
          step={20}
          value={[props.maxEdge]}
          onValueChange={v => props.setMaxEdge(v[0])}
        />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between gap-2 text-xs">
          <Label htmlFor="img-quality">JPEG quality</Label>
          <span className="text-muted-foreground tabular-nums">{props.qualityPct}%</span>
        </div>
        <Slider
          id="img-quality"
          min={50}
          max={100}
          step={5}
          value={[props.qualityPct]}
          onValueChange={v => props.setQualityPct(v[0])}
        />
      </div>

      <div className="space-y-4 pt-1">
        {opts.map((opt, vidx) => (
          <div key={vidx} className="rounded-xl border border-border bg-background p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-9 max-w-[220px]"
                placeholder="e.g. White Marble"
                value={opt.name}
                onChange={e => props.onUpdateVariantName(vidx, e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => props.onOpenVariantUpload(vidx)}
                disabled={props.imageBusy}
              >
                <Upload className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
              <button
                type="button"
                className="text-sm font-medium text-destructive hover:underline"
                onClick={() => props.onRemoveVariantRow(vidx)}
              >
                Remove variant
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {!(opt.images ?? []).filter(Boolean).length ? (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
                  <ImageIcon className="h-7 w-7 text-muted-foreground" />
                </div>
              ) : (
                (opt.images ?? [])
                  .map((src, idx) => ({ src, idx }))
                  .filter(x => x.src.trim())
                  .map(({ src, idx }) => (
                    <VariantThumbImg
                      key={`${vidx}-${idx}`}
                      src={src}
                      onRemove={() => props.onRemoveVariantImageAt(vidx, idx)}
                    />
                  ))
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                className="h-9 text-sm flex-1 min-w-0"
                placeholder="https://…"
                value={props.variantUrlDraft[vidx] ?? ''}
                onChange={e => props.setVariantUrlDraft(d => ({ ...d, [vidx]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    props.onAddVariantImageUrl(vidx);
                  }
                }}
              />
              <Button type="button" variant="secondary" size="sm" className="h-9 shrink-0" onClick={() => props.onAddVariantImageUrl(vidx)}>
                Add URL
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={props.onAddVariantRow}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add variant
        </Button>
      </div>
    </div>
  );
}

