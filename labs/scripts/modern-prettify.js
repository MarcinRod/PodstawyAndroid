/**
 * @file modern-prettify.js
 * @description Lightweight client-side syntax highlighter optimized for Kotlin, Java, and Android development.
 *
 * Provides a drop-in replacement for Google Prettify by exposing `window.prettyPrintOne(codeHtml)`.
 * It tokenizes code blocks using regular expressions and wraps syntax elements in semantic
 * `.tok-*` CSS classes.
 *
 * It also observes DOM mutations to format step numbers in `h2.step-title` headings
 * (e.g. converting `"1. "` to `<span class="step-number">1.</span>`).
 */

(function () {
  'use strict';

  /**
   * Set of reserved Kotlin keywords, modifiers, and declarations.
   * @type {Set<string>}
   */
  const keywords = new Set([
    'as', 'break', 'by', 'catch', 'class', 'companion', 'const', 'constructor',
    'continue', 'data', 'do', 'else', 'enum', 'expect', 'external', 'false',
    'field', 'file', 'final', 'for', 'fun', 'get', 'if', 'import', 'in',
    'infix', 'init', 'inline', 'inner', 'interface', 'internal', 'is', 'lateinit',
    'noinline', 'null', 'object', 'open', 'operator', 'out', 'override',
    'package', 'param', 'private', 'protected', 'public', 'reified', 'return',
    'sealed', 'set', 'setparam', 'super', 'suspend', 'tailrec', 'this', 'throw',
    'true', 'try', 'typealias', 'typeof', 'val', 'var', 'vararg', 'when', 'where',
    'while', 'actual'
  ]);

  /**
   * Set of standard Kotlin/Java built-in primitive and object types.
   * @type {Set<string>}
   */
  const types = new Set([
    'Any', 'Array', 'Boolean', 'Byte', 'Char', 'Double', 'Float', 'Int', 'List',
    'Long', 'Map', 'Nothing', 'Number', 'Set', 'Short', 'String', 'Unit', 'ViewModel'
  ]);

  /**
   * Decodes HTML entities from code blocks (e.g., &lt; to <) using a detached textarea.
   *
   * @param {string} value - HTML encoded code string.
   * @returns {string} Raw unescaped code string.
   */
  function decodeHtml(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  /**
   * Escapes special characters into HTML entities for safe DOM injection.
   *
   * @param {string} value - Raw string.
   * @returns {string} Escaped HTML string.
   */
  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Wraps a syntax token in a span element with the corresponding CSS class.
   *
   * @param {string} className - Token category name (e.g. 'keyword', 'type', 'string').
   * @param {string} value - The token text.
   * @returns {string} HTML span markup.
   */
  function span(className, value) {
    return `<span class="tok-${className}">${escapeHtml(value)}</span>`;
  }

  /**
   * Core tokenizer and syntax highlighter engine.
   * Parses code line by line using regular expression matching and contextual lookahead/lookbehind:
   *   - Comments (`//...`, C-style block comments)
   *   - Annotations (`@Annotation`)
   *   - Strings (`"..."`, `'...'`)
   *   - Numbers (integers, floats, long literals)
   *   - Keywords and built-in types
   *   - Function invocations vs declarations
   *   - Named arguments and properties
   *
   * @param {string} source - Raw code string to highlight.
   * @returns {string} Highlighted HTML string with `.tok-*` spans.
   */
  function highlight(source) {
    const tokenPattern = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|@[A-Za-z_]\w*|\b(?:\d+(?:\.\d+)?(?:[fFL])?|\d+[fFL])\b|\b[A-Za-z_]\w*\b)/g;
    const declarationKeywords = new Set([
      'val', 'var', 'const', 'private', 'protected', 'public', 'internal',
      'override', 'lateinit', 'final', 'abstract', 'open', 'data', 'class',
      'fun', 'object', 'enum', 'interface', 'typealias', 'annotation', 'companion'
    ]);
    let output = '';
    let cursor = 0;
    let match;

    while ((match = tokenPattern.exec(source)) !== null) {
      const token = match[0];
      const isPropertyAccess = match.index > 0 && source.charAt(match.index - 1) === '.';
      const prefix = source.slice(cursor, match.index);
      output += escapeHtml(prefix);
      const remaining = source.slice(match.index + token.length);
      const next = remaining.match(/^\s*\(/);
      const assignmentName = remaining.match(/^\s*=(?!=)/);
      const beforeToken = source.slice(0, match.index).match(/\b[A-Za-z_]\w*\b(?=\s*$)/);
      const previousKeyword = beforeToken ? beforeToken[0] : '';
      const isDeclaration = declarationKeywords.has(previousKeyword);

      if (token.startsWith('//') || token.startsWith('/*')) {
        output += span('comment', token);
      } else if (token.startsWith('@')) {
        output += span('annotation', token);
      } else if (token.startsWith('"') || token.startsWith("'")) {
        output += span('string', token);
      } else if (/^\d/.test(token)) {
        output += span('number', token);
      } else if (keywords.has(token)) {
        output += span('keyword', token);
      } else if (types.has(token) || /^[A-Z]/.test(token)) {
        output += span('type', token);
      } else if (assignmentName && !isDeclaration && !isPropertyAccess) {
        output += span('parameter', token);
      } else if (next) {
        output += span('function', token);
      } else if (isPropertyAccess && /^[A-Za-z_]/.test(token)) {
        output += span('property', token);
      } else {
        output += escapeHtml(token);
      }
      cursor = match.index + token.length;
    }

    return output + escapeHtml(source.slice(cursor));
  }

  /**
   * Global entry point compatible with legacy Google Prettify calls.
   *
   * @param {string} source - HTML-escaped code string from `<pre><code>`.
   * @returns {string} Syntax-highlighted HTML string.
   */
  window.prettyPrintOne = function (source) {
    return highlight(decodeHtml(source));
  };

  /**
   * Helper that checks if a step heading starts with an index pattern (e.g. "1. "),
   * and wraps that index in `<span class="step-number">` for dedicated brutalist styling.
   *
   * @param {HTMLElement} heading - The `h2.step-title` element.
   */
  function wrapStepNumber(heading) {
    if (heading.querySelector('.step-number')) {
      return;
    }
    const firstNode = heading.firstChild;
    if (!firstNode || firstNode.nodeType !== Node.TEXT_NODE) {
      return;
    }
    const match = firstNode.nodeValue.match(/^(\d+\.)(\s+)/);
    if (!match) {
      return;
    }
    const number = document.createElement('span');
    number.className = 'step-number';
    number.textContent = match[1];
    heading.insertBefore(number, firstNode);
    firstNode.nodeValue = firstNode.nodeValue.slice(match[0].length);
    heading.insertBefore(document.createTextNode(match[2]), firstNode);
  }

  // Observe DOM for dynamically inserted step titles to format step numbers
  const headingObserver = new MutationObserver(() => {
    document.querySelectorAll('h2.step-title').forEach(wrapStepNumber);
  });
  headingObserver.observe(document.documentElement, { childList: true, subtree: true });
}());
