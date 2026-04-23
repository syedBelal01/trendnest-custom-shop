import React from 'react';
import type { PrintAreaPct } from '@/data/customPrintMockups';
import { cn } from '@/lib/utils';

export default function CustomPrintPreview(props: {
  mockupUrl: string;
  designPreviewUrl: string;
  printArea: PrintAreaPct;
  productName: string;
  className?: string;
}) {
  const area = props.printArea;
  const areaStyle: React.CSSProperties = {
    left: `${area.leftPct}%`,
    top: `${area.topPct}%`,
    width: `${area.widthPct}%`,
    height: `${area.heightPct}%`,
  };

  return (
    <div className={cn('relative aspect-square w-full rounded-2xl overflow-hidden border border-border bg-muted', props.className)}>
      <img
        src={props.mockupUrl}
        alt={props.productName}
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
      />

      {/* Design overlay in fixed printable area */}
      <div className="absolute" style={areaStyle}>
        <div className="relative h-full w-full">
          <img
            src={props.designPreviewUrl}
            alt="Your design preview"
            className="h-full w-full object-contain"
            loading="eager"
            draggable={false}
          />
          {/* subtle mask to feel printed */}
          <div className="pointer-events-none absolute inset-0 mix-blend-multiply opacity-10" />
        </div>
      </div>

      {/* Soft vignette for premium look */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]" />
    </div>
  );
}

