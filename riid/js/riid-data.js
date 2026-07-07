// RIID — Public data loader
// Reads assets/press_releases/manifest.json and assets/cases/manifest.json
// (same manual, no-backend, manifest+JSON workflow as the government portal's
// assets/press_release/ and BIASR's assets/publications/).

const RIID_DATA = {
  pressReleases: [],
  cases: [],

  async init() {
    try {
      const [prRes, caseRes] = await Promise.all([
        fetch('assets/press_releases/manifest.json'),
        fetch('assets/cases/manifest.json')
      ]);
      if (prRes.ok) this.pressReleases = await prRes.json();
      if (caseRes.ok) this.cases = await caseRes.json();
    } catch (_) {}

    this.pressReleases.sort((a, b) => new Date(b.date) - new Date(a.date));
    this.cases.sort((a, b) => new Date(b.dateOpened) - new Date(a.dateOpened));

    this.render();
  },

  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  },

  formatContent(text) {
    if (!text) return '';
    return '<p>' + String(text).split(/\n\n+/).map(p => p.replace(/\n/g, '<br>')).join('</p><p>') + '</p>';
  },

  buildPRCard(item) {
    return `
      <article class="r-card">
        <div class="r-card-meta">
          <span class="cls-badge cls-public">Press Release</span>
          <span>${item.ref || ''}</span>
          <span>${this.formatDate(item.date)}</span>
          ${item.author ? `<span>${item.author}</span>` : ''}
        </div>
        <h3 class="r-card-title">${item.title || 'Untitled'}</h3>
        <div class="r-card-body">
          ${item.summary ? `<p>${item.summary}</p>` : ''}
          ${item.content ? this.formatContent(item.content) : ''}
        </div>
        ${item.file ? `<div class="mt-4"><a href="assets/press_releases/${item.file}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">View PDF →</a></div>` : ''}
      </article>`;
  },

  buildCaseCard(item) {
    return `
      <article class="r-card">
        <div class="r-card-meta">
          <span class="cls-badge cls-public">${item.status || item.classification || 'DECLASSIFIED'}</span>
          <span>${item.id || ''}</span>
          <span>Opened ${this.formatDate(item.dateOpened)}${item.dateClosed ? ' · Closed ' + this.formatDate(item.dateClosed) : ''}</span>
        </div>
        <h3 class="r-card-title">${item.operation || 'Untitled Operation'}</h3>
        <div class="r-card-body">
          ${item.summary ? `<p><strong class="color-cyan">Summary:</strong> ${item.summary}</p>` : ''}
          ${item.outcome ? `<p><strong class="color-cyan">Outcome:</strong> ${item.outcome}</p>` : ''}
        </div>
      </article>`;
  },

  animateStat(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('data-count', String(target));
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current.toLocaleString();
      if (current >= target) clearInterval(timer);
    }, 28);
  },

  render() {
    // Home — latest press release panel
    const latestEl = document.getElementById('latest-press-release');
    if (latestEl) {
      const latest = this.pressReleases[0];
      latestEl.innerHTML = latest
        ? `<div class="r-card-title" style="margin: 10px 0 8px; font-size: 0.95rem;"><a href="press-releases.html">${latest.title}</a></div><p class="r-card-body">Read the latest announcement. <a href="press-releases.html" class="color-cyan" style="text-decoration:none;">All releases →</a></p>`
        : `<p class="r-card-body">No press releases yet. <a href="press-releases.html" class="color-cyan" style="text-decoration:none;">Press Releases →</a></p>`;
    }

    // Home — dynamic stat counters (animated directly; the scroll-triggered
    // observer in main.js may already have fired before this fetch resolves)
    this.animateStat('stat-active-investigations', Math.max(1, this.cases.filter(c => c.status !== 'DECLASSIFIED').length || 1));
    this.animateStat('stat-declassified-cases', this.cases.length);

    // Press Releases page
    const prList = document.getElementById('pr-list');
    if (prList) {
      prList.innerHTML = this.pressReleases.length
        ? '<div class="card-list">' + this.pressReleases.map(p => this.buildPRCard(p)).join('') + '</div>'
        : '<div class="no-data-msg">No press releases have been issued yet. They will appear here automatically when published.</div>';
    }

    // Investigation Archive page
    const caseList = document.getElementById('case-archive-list');
    if (caseList) {
      caseList.innerHTML = this.cases.length
        ? '<div class="card-list">' + this.cases.map(c => this.buildCaseCard(c)).join('') + '</div>'
        : '<div class="no-data-msg">No cases have been declassified yet.</div>';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => RIID_DATA.init());
