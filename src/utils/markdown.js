import { marked } from 'marked';

/** @type {import('marked').MarkedOptions} */
const GFM_MARKDOWN_OPTIONS = {
  breaks: true,
  gfm: true,
};

/** Multi-line or longer blockquotes become copyable excerpts when `excerpts: true`. */
const EXCERPT_BLOCKQUOTE_MIN_CHARS = 80;

marked.use({
  ...GFM_MARKDOWN_OPTIONS,
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
    checkbox({ checked }) {
      const checkedAttr = checked ? ' checked' : '';
      return `<input type="checkbox" class="nova-task-checkbox"${checkedAttr} />`;
    },
  },
});

/**
 * @typedef {{ excerpts?: boolean }} ParseMarkdownOptions
 */

/**
 * @typedef {{ type: 'html'; html: string } | { type: 'excerpt'; variant: 'blockquote' | 'code'; html: string; plainText: string }} MarkdownBlock
 */

/** Nova chat: promote long blockquotes and fenced code to copyable excerpt cards. */
export const NOVA_MARKDOWN_OPTIONS = Object.freeze({ excerpts: true });

/**
 * @param {import('marked').Token[] | undefined} tokens
 * @returns {string}
 */
function tokensToPlainText(tokens) {
  if (!Array.isArray(tokens)) return '';
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'text':
        case 'codespan':
        case 'code':
          return token.text ?? '';
        case 'br':
          return '\n';
        case 'paragraph':
        case 'strong':
        case 'em':
        case 'del':
        case 'link':
        case 'image':
        case 'list_item':
        case 'blockquote':
        case 'heading':
          return tokensToPlainText(token.tokens) || token.text || '';
        case 'list':
          return (token.items ?? [])
            .map((item) => tokensToPlainText(item.tokens))
            .filter(Boolean)
            .join('\n');
        case 'space':
          return '';
        default:
          if (token.tokens) return tokensToPlainText(token.tokens);
          return token.text ?? '';
      }
    })
    .join('');
}

/**
 * @param {import('marked').Tokens.Blockquote} token
 * @returns {string}
 */
function blockquotePlainText(token) {
  return tokensToPlainText(token.tokens).trim();
}

/**
 * @param {import('marked').Tokens.Blockquote} token
 * @returns {boolean}
 */
function isExcerptBlockquote(token) {
  const plain = blockquotePlainText(token);
  return plain.length >= EXCERPT_BLOCKQUOTE_MIN_CHARS || plain.includes('\n');
}

/**
 * @param {import('marked').Token[]} buffer
 * @param {MarkdownBlock[]} blocks
 */
function flushMarkdownBuffer(buffer, blocks) {
  if (!buffer.length) return;
  const html = marked.parser(buffer);
  if (html.trim()) blocks.push({ type: 'html', html });
  buffer.length = 0;
}

/**
 * Split markdown into HTML segments and optional copyable excerpt blocks.
 *
 * @param {unknown} value
 * @param {ParseMarkdownOptions} [options]
 * @returns {MarkdownBlock[]}
 */
export function parseMarkdownBlocks(value, options = {}) {
  const excerpts = options.excerpts === true;
  const text = typeof value === 'string' ? value : '';
  if (!text.trim()) return [];

  try {
    const tokens = marked.lexer(text, GFM_MARKDOWN_OPTIONS);
    /** @type {MarkdownBlock[]} */
    const blocks = [];
    /** @type {import('marked').Token[]} */
    const buffer = [];

    for (const token of tokens) {
      if (excerpts && token.type === 'blockquote' && isExcerptBlockquote(token)) {
        flushMarkdownBuffer(buffer, blocks);
        blocks.push({
          type: 'excerpt',
          variant: 'blockquote',
          html: marked.parser([token]),
          plainText: blockquotePlainText(token),
        });
        continue;
      }

      if (excerpts && token.type === 'code') {
        flushMarkdownBuffer(buffer, blocks);
        const plainText = String(token.text ?? '').trim();
        if (!plainText) continue;
        blocks.push({
          type: 'excerpt',
          variant: 'code',
          html: marked.parser([token]),
          plainText,
        });
        continue;
      }

      buffer.push(token);
    }

    flushMarkdownBuffer(buffer, blocks);
    return blocks;
  } catch (err) {
    console.error('Markdown parse error:', err);
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return [{ type: 'html', html: escaped }];
  }
}

/**
 * Parse GitHub-flavored markdown to an HTML string.
 *
 * @param {unknown} value
 * @param {ParseMarkdownOptions} [options]
 * @returns {string}
 */
export function parseMarkdown(value, options = {}) {
  return parseMarkdownBlocks(value, options)
    .map((block) => block.html)
    .join('');
}
