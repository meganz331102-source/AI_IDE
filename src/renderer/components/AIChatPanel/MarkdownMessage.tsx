import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import markdown from 'highlight.js/lib/languages/markdown';

// Rejestruj tylko najczęstsze języki – oszczędza ~280 KB w bundle
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

marked.setOptions({
  gfm: true,
  breaks: true,
});

import { memo } from 'react';

interface Props { content: string; }

function MarkdownMessageInner({ content }: Props) {
  const html = useMemo(() => {
    const rawHtml = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ['target'],
    });
  }, [content]);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Syntax highlight wszystkich code blocks
    ref.current.querySelectorAll('pre code').forEach((block) => {
      try { hljs.highlightElement(block as HTMLElement); } catch { /* skip */ }
    });
    // Dodaj przyciski "Kopiuj" do każdego code block
    ref.current.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.copy-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'Kopiuj';
      btn.onclick = async () => {
        const code = pre.querySelector('code')?.textContent ?? '';
        await navigator.clipboard.writeText(code);
        btn.textContent = 'Skopiowano ✓';
        setTimeout(() => (btn.textContent = 'Kopiuj'), 1500);
      };
      pre.appendChild(btn);
    });
    // Linki w nowej karcie
    ref.current.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (href && href.startsWith('http')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }, [html]);

  return <div ref={ref} className="md-message" dangerouslySetInnerHTML={{ __html: html }} />;
}

export const MarkdownMessage = memo(MarkdownMessageInner, (a, b) => a.content === b.content);

