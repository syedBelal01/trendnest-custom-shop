import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';

export function ProductSpecificationsCard(props: {
  specs: { label: string; value: string }[] | undefined;
  canSaveToDb: boolean;
  apiAvailable: boolean;
  specSaveBusy: boolean;
  onAddSuggested: () => void;
  onUpdateRow: (idx: number, field: 'label' | 'value', value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (idx: number) => void;
  onSaveToDb: () => void;
}) {
  const rows = props.specs?.length ? props.specs : [{ label: '', value: '' }];
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Product details (specifications)</p>
          <p className="text-xs text-muted-foreground mt-1">
            Fill label and value for each row, then use <strong>Save specifications</strong> to write them to MongoDB.
            The storefront reads only what is saved there (complete rows only).
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={props.onAddSuggested}>
          Add suggested fields for categorys
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
          <Plus className="h-3.5 w-3.5 mr-1" /> Add row
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
      {!props.canSaveToDb && (
        <p className="text-xs text-amber-800 dark:text-amber-200/90">
          Save the product with the main Save button below first — then you can save specifications to the database.
        </p>
      )}
    </div>
  );
}

