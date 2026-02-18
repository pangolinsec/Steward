import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

export function processWikilinks(text) {
  return text.replace(/\[\[([^\]]+)\]\]/g, (match, name) => {
    return `<a class="wikilink" href="#" data-wikilink="${encodeURIComponent(name)}">${name}</a>`;
  });
}

export function renderMarkdown(content) {
  if (!content) return '';
  return marked.parse(processWikilinks(content));
}
