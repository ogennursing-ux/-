import React from 'react';

// Minimal markdown renderer for chat replies: code fences, headings, lists,
// blockquotes, bold/italic/inline-code/links. Builds React elements directly,
// so untrusted model output is never injected as raw HTML.

const INLINE_RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;

function renderInline(text, keyPrefix) {
  const parts = [];
  let last = 0;
  let m;
  let k = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyPrefix}-${k++}`;
    if (token.startsWith('`')) {
      parts.push(<code key={key} dir="ltr">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const label = token.slice(1, token.indexOf(']'));
      parts.push(
        <a key={key} href={m[5]} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function Markdown({ text }) {
  const blocks = [];
  const lines = (text || '').split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(
        <pre key={key++} dir="ltr">
          <code>{code.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)/);
    if (heading) {
      const Tag = `h${Math.min(heading[1].length + 2, 6)}`;
      blocks.push(<Tag key={key++}>{renderInline(heading[2], `h${key}`)}</Tag>);
      i++;
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={key++}>
          {items.map((item, j) => (
            <li key={j}>{renderInline(item, `li${key}-${j}`)}</li>
          ))}
        </List>
      );
      continue;
    }

    if (line.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote key={key++}>{renderInline(quote.join('\n'), `q${key}`)}</blockquote>
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*([-*]|\d+\.)\s)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key++}>{renderInline(para.join('\n'), `p${key}`)}</p>);
  }

  return <div className="md">{blocks}</div>;
}
