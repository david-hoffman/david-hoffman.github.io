// Search the published archive in the browser. No service or tracking required.
const searchForm = document.querySelector('.archive-search');
const searchInput = document.querySelector('#search-query');
const searchStatus = document.querySelector('#search-status');
const searchResults = document.querySelector('#search-results');

const archive = fetch('/index.json')
  .then(response => {
    if (!response.ok) throw new Error('Archive unavailable');
    return response.json();
  })
  .then(entries => entries.filter(entry => ['post', 'publication'].includes(entry.section)));

function decodeText(value) {
  // Hugo's archive contains both encoded and double-encoded entities. Decode
  // in an unattached textarea, then insert only text nodes into the page.
  const decoder = document.createElement('textarea');
  let decoded = String(value || '');
  for (let pass = 0; pass < 2; pass += 1) {
    decoder.innerHTML = decoded;
    const next = decoder.value;
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function excerpt(entry, query) {
  const content = decodeText(entry.content?.trim() || entry.summary).replace(/\s+/g, ' ').trim();
  const position = content.toLowerCase().indexOf(query.toLowerCase());
  const start = Math.max(0, position - 70);
  const end = Math.min(content.length, start + 240);
  return `${start ? '…' : ''}${content.slice(start, end)}${end < content.length ? '…' : ''}`;
}

let searchVersion = 0;

async function search() {
  const version = ++searchVersion;
  const query = searchInput.value.trim();
  searchResults.replaceChildren();
  const url = new URL(window.location.href);
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  window.history.replaceState(null, '', url);

  if (!query) {
    searchStatus.textContent = 'Enter a search term to get started.';
    return;
  }
  searchStatus.textContent = 'Searching…';
  try {
    const entries = await archive;
    if (version !== searchVersion || searchInput.value.trim() !== query) return;
    const terms = query.toLowerCase().split(/\s+/);
    const matches = entries.filter(entry => {
      const text = decodeText(`${entry.title} ${entry.content || ''} ${entry.summary || ''} ${(entry.tags || []).join(' ')}`).toLowerCase();
      return terms.every(term => text.includes(term));
    });
    searchStatus.textContent = matches.length
      ? `${matches.length} ${matches.length === 1 ? 'result' : 'results'} for “${query}”.`
      : `No results for “${query}”. Try a broader term, such as optics or microscopy.`;

    for (const entry of matches) {
      const article = document.createElement('article');
      article.className = 'archive-entry';
      const meta = document.createElement('p');
      meta.className = 'entry-meta';
      meta.textContent = entry.section === 'post' ? 'Writing' : 'Publication';
      const heading = document.createElement('h2');
      const link = document.createElement('a');
      link.href = entry.relpermalink;
      link.textContent = decodeText(entry.title);
      heading.append(link);
      const summary = document.createElement('p');
      summary.className = 'entry-summary';
      summary.textContent = excerpt(entry, query);
      article.append(meta, heading, summary);
      searchResults.append(article);
    }
  } catch {
    if (version !== searchVersion) return;
    searchStatus.textContent = 'Search could not load. You can still browse Writing and Publications from the navigation.';
  }
}

searchForm.addEventListener('submit', event => {
  event.preventDefault();
  search();
});
let pendingSearch;
searchInput.addEventListener('input', () => {
  clearTimeout(pendingSearch);
  pendingSearch = setTimeout(search, 180);
});
searchInput.value = new URLSearchParams(window.location.search).get('q') || '';
search();
