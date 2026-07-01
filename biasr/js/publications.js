// BIASR — Publications journal interface: fetch manifest, search/filter/paginate.
(function () {
  'use strict';

  const PAGE_SIZE = 6;
  const state = { all: [], filtered: [], page: 1, query: '', division: '' };

  const el = (id) => document.getElementById(id);

  function render() {
    const list = el('pub-list');
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = state.filtered.slice(start, start + PAGE_SIZE);

    if (pageItems.length === 0) {
      list.innerHTML = '<div class="empty-state">No publications match your search.</div>';
    } else {
      list.innerHTML = pageItems.map(renderCard).join('');
    }
    renderPagination();
  }

  function renderCard(p) {
    const tags = (p.tags || []).map(t => `<span class="pub-tag">${t}</span>`).join('');
    return `
      <article class="pub-card">
        <h3>${p.title}</h3>
        <div class="pub-meta">
          ${p.authors.join(', ')} &middot; ${p.institution} &middot; ${p.division}<br>
          Published ${p.date} &middot; Vol. ${p.volume}, Issue ${p.issue} &middot; DOI: ${p.doi}
        </div>
        <p class="pub-abstract">${p.abstract}</p>
        <div class="pub-tags">${tags}</div>
        <div class="pub-footer">
          <span class="pub-citation">${p.citation}</span>
          <a class="btn btn-secondary" href="assets/publications/${p.file}" download>Download PDF</a>
        </div>
      </article>`;
  }

  function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    const bar = el('pub-pagination');
    let html = `<button ${state.page === 1 ? 'disabled' : ''} data-page="${state.page - 1}">‹ Prev</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button aria-current="${i === state.page}" data-page="${i}">${i}</button>`;
    }
    html += `<button ${state.page === totalPages ? 'disabled' : ''} data-page="${state.page + 1}">Next ›</button>`;
    bar.innerHTML = html;
    bar.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.page = parseInt(btn.dataset.page, 10);
        render();
        window.scrollTo({ top: el('pub-list').offsetTop - 100, behavior: 'smooth' });
      });
    });
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();
    state.filtered = state.all.filter(p => {
      const matchesQuery = !q ||
        p.title.toLowerCase().includes(q) ||
        p.authors.join(' ').toLowerCase().includes(q) ||
        (p.tags || []).join(' ').toLowerCase().includes(q);
      const matchesDivision = !state.division || p.division === state.division;
      return matchesQuery && matchesDivision;
    });
    state.page = 1;
    render();
  }

  function populateDivisionFilter() {
    const divisions = [...new Set(state.all.map(p => p.division))].sort();
    const select = el('pub-filter-division');
    select.innerHTML = '<option value="">All Divisions</option>' +
      divisions.map(d => `<option value="${d}">${d}</option>`).join('');
  }

  async function init() {
    try {
      const res = await fetch('assets/publications/manifest.json');
      state.all = res.ok ? await res.json() : [];
    } catch (_) {
      state.all = [];
    }
    state.all.sort((a, b) => new Date(b.date) - new Date(a.date));
    state.filtered = state.all;
    populateDivisionFilter();
    render();

    el('pub-search').addEventListener('input', (e) => { state.query = e.target.value; applyFilters(); });
    el('pub-filter-division').addEventListener('change', (e) => { state.division = e.target.value; applyFilters(); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
