import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

export function ProductSpecificationsCard(props: {
  specs: { label: string; value: string }[] | undefined;
  categoryLabel?: string;
  subcategory?: string;
  canSaveToDb: boolean;
  apiAvailable: boolean;
  specSaveBusy: boolean;
  onAddSuggested: () => void;
  onUpdateRow: (idx: number, field: 'label' | 'value', value: string) => void;
  onAddRow: () => void;
  onImportText: (text: string) => number;
  onRemoveRow: (idx: number) => void;
  onSaveToDb: () => void;
}) {
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteMessage, setPasteMessage] = useState('');
  const rows = props.specs?.length ? props.specs : [{ label: '', value: '' }];
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Product details (specifications)</p>
          <p className="text-xs text-muted-foreground mt-1">
            Suggested labels are based on the product category. Fill values, edit labels if needed, then save.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Category: <span className="font-medium text-foreground">{props.categoryLabel || 'Default'}</span>
            {props.subcategory ? <span> / {props.subcategory}</span> : null}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={props.onAddSuggested}>
          Add suggested fields for category
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((row, sidx) => (
          <div key={sidx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              className="h-9 sm:flex-1"
              placeholder="Label (e.g. Brand)"
              value={row.label}
              onChange={e => props.onUpdateRow(sidx, 'label', e.target.value)}
            />
            <Input
              className="h-9 sm:flex-[2]"
              placeholder="Value"
              value={row.value}
              onChange={e => props.onUpdateRow(sidx, 'value', e.target.value)}
            />
            <Button type="button" variant="ghost" size="sm" className="h-9 text-destructive shrink-0" onClick={() => props.onRemoveRow(sidx)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={props.onAddRow}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add custom specification
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setShowPasteBox((v) => !v);
            setPasteMessage('');
          }}
        >
          Paste specifications text
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={props.specSaveBusy || !props.apiAvailable || !props.canSaveToDb}
          onClick={() => props.onSaveToDb()}
        >
          {props.specSaveBusy ? 'Saving…' : 'Save specifications'}
        </Button>
      </div>
      {showPasteBox && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-2">
          <Textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setPasteMessage('');
            }}
            placeholder={'Paste product details here, e.g.\nBrand: CALYWORK\nMaterial: Eva\nWashable: No\nCountry of Origin: India'}
            className="min-h-[130px]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const count = props.onImportText(pasteText);
                if (count > 0) {
                  setPasteText('');
                  setPasteMessage(`Added/filled ${count} specification row(s).`);
                  return;
                }
                setPasteMessage('No label/value lines found. Use lines like Brand: CALYWORK.');
              }}
            >
              Convert to rows
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPasteText('')}>
              Clear text
            </Button>
            {pasteMessage ? <span className="text-xs text-muted-foreground">{pasteMessage}</span> : null}
          </div>
        </div>
      )}
      {!props.canSaveToDb && (
        <p className="text-xs text-amber-800 dark:text-amber-200/90">
          Save the product with the main Save button below first — then you can save specifications to the database.
        </p>
      )}
    </div>
  );
}

