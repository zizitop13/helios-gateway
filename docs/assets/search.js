(function () {
  const forms = document.querySelectorAll('[data-docs-search]');
  if (!forms.length) return;

  let indexPromise;

  function loadIndex(form) {
    if (!indexPromise) {
      const indexUrl = form.dataset.searchIndex || '/search.json';
      indexPromise = fetch(indexUrl).then((response) => {
        if (!response.ok) {
          throw new Error('Search index failed to load');
        }
        return response.json();
      });
    }

    return indexPromise;
  }

  function scorePage(page, terms) {
    const title = page.title.toLowerCase();
    const content = page.content.toLowerCase();
    let score = 0;

    for (const term of terms) {
      if (title.includes(term)) score += 8;
      if (content.includes(term)) score += 1;
    }

    return score;
  }

  function summarize(page, terms) {
    const content = page.content.replace(/\s+/g, ' ').trim();
    const lowerContent = content.toLowerCase();
    const firstHit = terms
      .map((term) => lowerContent.indexOf(term))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];

    if (firstHit === undefined) {
      return content.slice(0, 160);
    }

    const start = Math.max(0, firstHit - 70);
    const end = Math.min(content.length, firstHit + 140);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < content.length ? '...' : '';

    return `${prefix}${content.slice(start, end)}${suffix}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderResults(container, results, terms) {
    if (!terms.length) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }

    if (!results.length) {
      container.hidden = false;
      container.innerHTML = '<p class="search-empty">No results found.</p>';
      return;
    }

    container.hidden = false;
    container.innerHTML = `
      <ul class="search-results-list">
        ${results
          .slice(0, 8)
          .map((page) => `
            <li>
              <a href="${escapeHtml(page.url)}">${escapeHtml(page.title)}</a>
              <p>${escapeHtml(summarize(page, terms))}</p>
            </li>
          `)
          .join('')}
      </ul>
    `;
  }

  for (const form of forms) {
    const input = form.querySelector('[data-search-input]');
    const resultsContainer = form.querySelector('[data-search-results]');

    if (!input || !resultsContainer) continue;

    input.addEventListener('input', async () => {
      const terms = input.value
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      if (!terms.length) {
        renderResults(resultsContainer, [], terms);
        return;
      }

      try {
        const index = await loadIndex(form);
        const results = index
          .map((page) => ({ ...page, score: scorePage(page, terms) }))
          .filter((page) => page.score > 0)
          .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

        renderResults(resultsContainer, results, terms);
      } catch (_error) {
        resultsContainer.hidden = false;
        resultsContainer.innerHTML = '<p class="search-empty">Search is unavailable right now.</p>';
      }
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        input.value = '';
        renderResults(resultsContainer, [], []);
      }
    });
  }
})();

(function () {
  const codeBlocks = document.querySelectorAll('.markdown-body pre > code');
  if (!codeBlocks.length) return;

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  for (const code of codeBlocks) {
    const pre = code.parentElement;
    if (!pre || pre.dataset.copyReady === 'true') continue;

    pre.dataset.copyReady = 'true';
    pre.classList.add('code-block');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code-button';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy code to clipboard');

    button.addEventListener('click', async () => {
      const originalText = button.textContent;

      try {
        await copyText(code.textContent || '');
        button.textContent = 'Copied';
        button.classList.add('is-copied');
      } catch (_error) {
        button.textContent = 'Failed';
      }

      window.setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('is-copied');
      }, 1600);
    });

    pre.appendChild(button);
  }
})();
