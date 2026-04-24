import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button } from '@/components/ui/button';

function isProbablyHtml(input: string) {
  return /<\/?[a-z][\s\S]*>/i.test(input);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToHtml(s: string) {
  const escaped = escapeHtml(s);
  const withBreaks = escaped.replace(/\r\n|\r|\n/g, '<br />');
  return `<p>${withBreaks}</p>`;
}

export function stripHtmlToText(htmlOrText: string) {
  const s = String(htmlOrText ?? '');
  if (!isProbablyHtml(s)) return s;
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export function RichTextEditor(props: {
  value: string;
  onChange: (nextHtml: string) => void;
  className?: string;
}) {
  const initialHtml = useMemo(() => {
    const raw = String(props.value ?? '');
    return isProbablyHtml(raw) ? raw : plainTextToHtml(raw);
  }, [props.value]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        class:
          'min-h-[120px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      },
    },
    onUpdate({ editor }) {
      props.onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const nextHtml = isProbablyHtml(String(props.value ?? '')) ? String(props.value ?? '') : plainTextToHtml(String(props.value ?? ''));
    // Avoid resetting selection on every keystroke.
    if (nextHtml !== editor.getHTML()) {
      editor.commands.setContent(nextHtml, false);
    }
  }, [editor, props.value]);

  if (!editor) return null;

  const ToolbarButton = (p: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <Button
      type="button"
      variant={p.active ? 'default' : 'outline'}
      size="sm"
      className="h-8 px-2 text-xs"
      onClick={p.onClick}
    >
      {p.children}
    </Button>
  );

  return (
    <div className={props.className}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          Bold
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          Bullets
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          Numbered
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHardBreak().run()}
        >
          Line break
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
      <div className="mt-1 text-[11px] text-muted-foreground">
        Tip: select text then apply formatting. Use “Line break” for a new line.
      </div>
    </div>
  );
}

