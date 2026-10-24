export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMarkdown(src: string): string {
  const escaped = escapeHtml(src.replace(/\r\n/g, '\n'));
  const lines = escaped.split('\n');
  const out: string[] = [];
  let list = false;
  const flush = () => {
    if (list) {
      out.push('</ul>');
      list = false;
    }
  };
  for (const line of lines) {
    if (/^### /.test(line)) {
      flush();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (/^## /.test(line)) {
      flush();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (/^# /.test(line)) {
      flush();
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (/^[-*] /.test(line)) {
      if (!list) {
        out.push('<ul>');
        list = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (!line.trim()) {
      flush();
      out.push('<br>');
    } else {
      flush();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  flush();
  return out.join('');
}

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}
