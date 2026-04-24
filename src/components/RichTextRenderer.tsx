import { useMemo } from 'react';
import DOMPurify from 'dompurify';

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

export function RichTextRenderer(props: { value: string; className?: string }) {
  const sanitized = useMemo(() => {
    const raw = String(props.value ?? '').trim();
    if (!raw) return '';
    const html = isProbablyHtml(raw) ? raw : plainTextToHtml(raw);
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'a'],
      ALLOWED_ATTR: ['href', 'rel', 'target'],
      FORBID_ATTR: ['style'],
    });
  }, [props.value]);

  if (!sanitized) return null;

  return (
    <div
      className={props.className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

