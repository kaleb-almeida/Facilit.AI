export function markdownParaHtml(textoMarkdown) {
  if (typeof textoMarkdown !== 'string' || textoMarkdown.trim() === '') {
    return '';
  }

  let html = textoMarkdown;

  // 1) Escapa caracteres HTML perigosos ANTES de tudo, para evitar que o próprio texto gerado pela IA injete tags HTML indesejadas (XSS).
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2) Blocos de código ```codigo```
  html = html.replace(/```([\s\S]*?)```/g, (_, codigo) => {
    return `<pre><code>${codigo.trim()}</code></pre>`;
  });

  // 3) Código inline `codigo`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 4) Cabeçalhos (do nível 6 ao 1, para não confundir ### com ##)
  html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // 5) Negrito **texto** e itálico *texto*
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 6) Links [texto](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // 7) Listas não ordenadas (- item / * item)
  html = html.replace(/(^|\n)[-*] (.+)/g, '$1<li>$2</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (bloco) => `<ul>${bloco}</ul>`);

  // 8) Listas ordenadas (1. item, 2. item...)
  html = html.replace(/(^|\n)\d+\. (.+)/g, '$1<li>$2</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (bloco) => {
    // evita re-envolver <li> que já viraram <ul> no passo anterior
    return bloco.includes('<ul>') ? bloco : `<ol>${bloco}</ol>`;
  });

  // 9) Parágrafos: quebra dupla de linha vira <p>, quebra simples vira <br>
  html = html
    .split(/\n{2,}/)
    .map((paragrafo) => {
      const trimmed = paragrafo.trim();
      if (trimmed === '') return '';
      // não envolve em <p> se já for um bloco de heading/lista/código
      if (/^<(h[1-6]|ul|ol|pre)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}
