// Binod World Government — Dynamic Data Loader
// Loads world-state.json, publications.json, press releases, and live game data.
// Live data polls a GitHub Gist every 9 seconds (updated by watch-world.ps1 + JCBP_WebSync addon).

const LIVE_GIST_URL = 'https://gist.githubusercontent.com/Abi1206/1a9bf7c08a8f4246c8e3a9188608ad5b/raw/world-live.json';

const GOV = {
  worldState:  null,
  publications: null,
  pressFolder:  [],   // loaded from assets/press_release/manifest.json

  async init() {
    // Load static data once
    try {
      const [wsRes, pubRes] = await Promise.all([
        fetch('data/world-state.json'),
        fetch('data/publications.json')
      ]);
      if (wsRes.ok)  this.worldState  = await wsRes.json();
      if (pubRes.ok) this.publications = await pubRes.json();
    } catch (_) {}

    // Load press releases from the press_release folder
    // Each entry in manifest.json: { file, title, date, author, ref?, summary?, content? }
    // file ending in .pdf → rendered as card with PDF link
    // file ending in .json → fetch and merge content into entry
    try {
      const mRes = await fetch('assets/press_release/manifest.json');
      if (mRes.ok) {
        const entries = await mRes.json();
        const loaded = await Promise.all(
          entries.map(async (entry) => {
            if (!entry.file) return entry;
            if (entry.file.endsWith('.json')) {
              try {
                const r = await fetch(`assets/press_release/${entry.file}`);
                if (r.ok) {
                  const data = await r.json();
                  return { ...entry, ...data };  // manifest metadata overrides file if both set
                }
              } catch (_) {}
            }
            return entry;  // PDF or failed JSON: use manifest metadata as-is
          })
        );
        this.pressFolder = loaded.filter(Boolean);
      }
    } catch (_) {}

    // Fetch live game data, then render, then start polling every 9 seconds
    await this._fetchLive();
    this.render();
    setInterval(() => this._fetchLive().then(() => this.render()), 9000);
  },

  // Fetches live data from the Gist and merges it into worldState
  async _fetchLive() {
    if (!this.worldState) return;
    try {
      const r = await fetch(`${LIVE_GIST_URL}?_=${Date.now()}`);
      if (!r.ok) return;
      const live = await r.json();
      if (!live?._live && !live?.ts) return; // safety check

      // President
      if (live.president?.name) {
        this.worldState.president.name        = live.president.name;
        this.worldState.president.displayName = live.president.name;
        this.worldState.president.nation      = live.president.nation ?? null;
        this.worldState.president.termsServed = live.president.terms  ?? 0;
      } else {
        this.worldState.president.displayName = 'Vacant';
        this.worldState.president.name        = null;
      }

      // Election
      if (live.election) {
        this.worldState.election.status           = live.election.active ? 'active' : 'none';
        this.worldState.election.registrationOpen = !!(live.election.registrationOpen);
        this.worldState.election.candidates       = live.election.candidates ?? [];
      }

      // Nation leaders, treasury, citizens from game data
      if (this.worldState.nations) {
        for (const nation of this.worldState.nations) {
          if (live.leaders  && live.leaders[nation.name]  !== undefined) nation.leader   = live.leaders[nation.name]  ?? null;
          if (live.treasury && live.treasury[nation.name] !== undefined) nation.treasury = live.treasury[nation.name] ?? 0;
          if (live.citizens && live.citizens[nation.name] !== undefined) nation.citizens = live.citizens[nation.name] ?? 0;
        }
      }

      // Online player count + last sync time
      if (live.onlinePlayers !== undefined) {
        this.worldState.statistics.onlinePlayers = live.onlinePlayers;
        this.worldState.statistics.totalCitizens = live.citizens
          ? Object.values(live.citizens).reduce((s, v) => s + (v || 0), 0)
          : this.worldState.statistics.totalCitizens;
      }
      if (live.ts) this.worldState._meta.lastUpdated = live.ts;

      // Publications from game (laws, white papers, announcements, decrees)
      if (live.publications) {
        if (!this.publications) this.publications = { laws: [], whitePapers: [], pressReleases: [], notices: [], decrees: [], orders: [], announcements: [] };
        const p = live.publications;
        const map = fn => x => ({ title: x.title, date: x.publishDay, department: x.author, description: x.description ?? x.content ?? x.category ?? '' });
        if (p.laws?.length)         this.publications.laws        = p.laws.map(map());
        if (p.whitePapers?.length)  this.publications.whitePapers = p.whitePapers.map(x => ({ title: x.title, date: x.publishDay, department: x.author, description: x.category || x.content?.substring(0, 120) || '' }));
        if (p.announcements?.length) this.publications.notices    = p.announcements.map(x => ({ title: x.title, date: x.publishDay, department: x.author, description: x.content || '' }));
        if (p.decrees?.length)      this.publications.decrees     = p.decrees.map(x => ({ title: x.title, date: x.publishDay, department: x.author, description: x.description || '', active: x.active }));
      }
    } catch (_) {}
  },

  render() {
    this.renderAnnouncement();
    this.renderStats();
    this.renderLatestPublications();
    this.renderPresident();
    this.renderNations();
    this.renderPublicationsPage();
    this.renderConstitution();
    this.renderTreasury();
    this.renderArchives();
    this.renderElectionBanner();
  },

  // ─── Helpers ────────────────────────────────────────────────────

  formatDate(iso) {
    if (!iso && iso !== 0) return '—';
    if (typeof iso === 'number' || (typeof iso === 'string' && /^\d+$/.test(iso))) return `Day ${iso}`;
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  },

  pubNo(type, idx) {
    const codes = { laws: 'LAW', whitePapers: 'WP', pressReleases: 'PR', notices: 'NOT', decrees: 'DEC', orders: 'GO' };
    return `${codes[type] || 'PUB'}-${String(idx + 1).padStart(3, '0')}`;
  },

  formatContent(text) {
    if (!text) return '';
    return '<p>' + String(text).split(/\n\n+/).map(p => p.replace(/\n/g, '<br>')).join('</p><p>') + '</p>';
  },

  // Renders press release cards (used by press-releases.html and home page)
  buildPRCards(items) {
    if (items.length === 0) {
      return '<div class="no-data-msg">No press releases have been issued yet. Add a PDF or JSON file to the press_release folder and update manifest.json — it will appear here automatically.</div>';
    }
    return items.map(item => {
      const isPDF = item.file && item.file.endsWith('.pdf');
      return `
      <article class="pr-card">
        <div class="pr-card-meta-row">
          <span class="pub-badge badge-pr">Press Release</span>
          ${item.ref ? `<span class="pr-card-ref">${item.ref}</span>` : ''}
          <span class="pr-card-date">${this.formatDate(item.date)}</span>
        </div>
        <h3 class="pr-card-title">${item.title || 'Untitled'}</h3>
        ${item.author ? `<div class="pr-card-author">— ${item.author}</div>` : ''}
        ${item.summary ? `<p class="pr-card-summary">${item.summary}</p>` : ''}
        ${item.content ? `<div class="pr-card-body">${this.formatContent(item.content)}</div>` : ''}
        ${isPDF ? `<a href="assets/press_release/${item.file}" target="_blank" rel="noopener noreferrer" class="btn btn-navy btn-sm pr-card-pdf-btn">View Press Release PDF →</a>` : ''}
      </article>`;
    }).join('');
  },

  // ─── Renderers ──────────────────────────────────────────────────

  renderAnnouncement() {
    const el = document.getElementById('gov-announcement-text');
    if (!el || !this.worldState) return;
    const { election, president } = this.worldState;
    if (election.status === 'active') {
      el.textContent = `World Election in Progress — Candidates are registering. Election Day: ${this.formatDate(election.nextElectionDay)}`;
    } else if (election.registrationOpen) {
      el.textContent = 'Election Registration Now Open — Country leaders may register as candidates at the Binod Ballot Box.';
    } else if (president.name) {
      el.textContent = `World President: ${president.name} (${president.nation}) — Serving Term ${president.termsServed}`;
    } else {
      el.textContent = 'Binod World Government — Official Government Portal';
    }
  },

  renderElectionBanner() {
    const el = document.getElementById('election-status-banner');
    if (!el || !this.worldState) return;
    const { election } = this.worldState;
    if (election.status === 'active' || election.registrationOpen) {
      el.style.display = 'block';
    }
  },

  renderStats() {
    const ws  = this.worldState;
    const pub = this.publications;
    if (!ws) return;

    const map = {
      'stat-nations':   ws.statistics.totalNations,
      'stat-citizens':  ws.statistics.totalCitizens,
      'stat-years':     ws.statistics.yearsOfAdministration,
      'stat-laws':      pub ? pub.laws.length : 0,
      'stat-wps':       pub ? pub.whitePapers.length : 0,
      'stat-prs':       (pub ? pub.pressReleases.length : 0) + this.pressFolder.length,
      'stat-online':    ws.statistics.onlinePlayers ?? 0,
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('data-count', val);
    });
  },

  renderLatestPublications() {
    const el = document.getElementById('latest-publications');
    if (!el) return;
    const pub = this.publications;
    const prOffset = pub ? pub.pressReleases.length : 0;

    const all = [
      ...(pub ? pub.laws.map((x, i)         => ({ ...x, type: 'laws',         idx: i })) : []),
      ...(pub ? pub.whitePapers.map((x, i)  => ({ ...x, type: 'whitePapers',  idx: i })) : []),
      ...(pub ? pub.pressReleases.map((x, i)=> ({ ...x, type: 'pressReleases',idx: i })) : []),
      ...this.pressFolder.map((x, i)         => ({ ...x, type: 'pressReleases',idx: prOffset + i })),
      ...(pub ? pub.notices.map((x, i)      => ({ ...x, type: 'notices',      idx: i })) : []),
      ...(pub ? pub.decrees.map((x, i)      => ({ ...x, type: 'decrees',      idx: i })) : []),
      ...(pub ? pub.orders.map((x, i)       => ({ ...x, type: 'orders',       idx: i })) : []),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 8);

    if (all.length === 0) {
      el.innerHTML = '<div class="no-data-msg">No publications have been released yet.</div>';
      return;
    }

    const typeLabels = { laws: 'Law', whitePapers: 'White Paper', pressReleases: 'Press Release', notices: 'Notice', decrees: 'Decree', orders: 'Gov. Order' };
    const typeBadge  = { laws: 'badge-law', whitePapers: 'badge-wp', pressReleases: 'badge-pr', notices: 'badge-notice', decrees: 'badge-decree', orders: 'badge-order' };

    el.innerHTML = '<ul class="pub-list">' + all.map(item => `
      <li class="pub-item">
        <span class="pub-badge ${typeBadge[item.type]}">${typeLabels[item.type]}</span>
        <div class="pub-meta">
          <span class="pub-title">${item.title || 'Untitled'}</span>
          <div class="pub-info">
            <span>${item.ref || this.pubNo(item.type, item.idx)}</span>
            <span>${this.formatDate(item.date)}</span>
            ${item.author || item.department ? `<span>${item.author || item.department}</span>` : ''}
          </div>
        </div>
      </li>`).join('') + '</ul>';
  },

  renderPresident() {
    const el = document.getElementById('president-data');
    if (!el || !this.worldState) return;
    const p = this.worldState.president;

    el.innerHTML = `
      <div class="president-meta-table">
        <div class="pmeta-row"><span>Name</span><strong>${p.displayName || p.name || 'Vacant'}</strong></div>
        <div class="pmeta-row"><span>Nation</span><strong>${p.nation || '—'}</strong></div>
        <div class="pmeta-row"><span>Term Since</span><strong>${this.formatDate(p.termStart)}</strong></div>
        <div class="pmeta-row"><span>Terms Served</span><strong>${p.termsServed || 0}</strong></div>
      </div>
      ${p.bio    ? `<p class="president-bio">${p.bio}</p>` : ''}
      ${p.address ? `<blockquote class="president-address">${p.address}</blockquote>` : ''}
    `;
  },

  renderNations() {
    const el = document.getElementById('nations-data');
    if (!el || !this.worldState) return;

    el.innerHTML = this.worldState.nations.map(n => `
      <div class="nation-card">
        <img src="${n.flag}" alt="${n.name} Flag" class="nation-flag-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
        <div class="nation-flag-placeholder" style="display:none;">${n.emoji}</div>
        <div class="nation-body">
          <span class="nation-badge">${n.badge}</span>
          <div class="nation-name">${n.name}</div>
          <div class="nation-role">${n.role}</div>
          <ul class="nation-facts">
            <li><span>Capital</span><strong>${n.capital}</strong></li>
            <li><span>Head of State</span><strong>${n.leader || 'Vacant'}</strong></li>
            <li><span>Citizens</span><strong>${n.citizens}</strong></li>
            <li><span>Visa Fee</span><strong>${n.visaFee} em</strong></li>
            <li><span>Est.</span><strong>${n.established}</strong></li>
            <li><span>Gov. Type</span><strong>${n.governmentType}</strong></li>
          </ul>
        </div>
      </div>`).join('');
  },

  renderPublicationsPage() {
    const pub = this.publications || { laws: [], whitePapers: [], pressReleases: [], notices: [], decrees: [], orders: [] };

    // Standard publication list rendering (laws, white papers, notices)
    const typeLabels = { laws: 'Law', whitePapers: 'White Paper', notices: 'Notice', decrees: 'Decree', orders: 'Gov. Order' };
    const typeBadge  = { laws: 'badge-law', whitePapers: 'badge-wp', notices: 'badge-notice', decrees: 'badge-decree', orders: 'badge-order' };
    const listElMap  = { 'page-laws': 'laws', 'page-wps': 'whitePapers', 'page-notices': 'notices' };

    Object.entries(listElMap).forEach(([elId, key]) => {
      const el = document.getElementById(elId);
      if (!el) return;
      const items = pub[key] || [];
      if (items.length === 0) {
        el.innerHTML = '<div class="no-data-msg">No records published yet.</div>';
        return;
      }
      el.innerHTML = '<ul class="pub-list">' + items.map((item, i) => `
        <li class="pub-item">
          <span class="pub-badge ${typeBadge[key]}">${typeLabels[key]}</span>
          <div class="pub-meta">
            <span class="pub-title">${item.title || 'Untitled'}</span>
            <div class="pub-info">
              <span>${this.pubNo(key, i)}</span>
              <span>${this.formatDate(item.date)}</span>
              ${item.department ? `<span>${item.department}</span>` : ''}
              ${item.description ? `<span>${item.description}</span>` : ''}
            </div>
          </div>
        </li>`).join('') + '</ul>';
    });

    // Press releases: combine folder (PDF/JSON) + publications.json entries
    // Rendered as full cards with PDF link or inline content
    const prEl = document.getElementById('page-prs');
    if (!prEl) return;

    const prOffset = pub.pressReleases.length;
    const allPRs = [
      ...pub.pressReleases.map((item, i) => ({
        ...item,
        ref: item.ref || this.pubNo('pressReleases', i)
      })),
      ...this.pressFolder.map((item, i) => ({
        ...item,
        ref: item.ref || this.pubNo('pressReleases', prOffset + i)
      }))
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    prEl.innerHTML = this.buildPRCards(allPRs);
  },

  renderConstitution() {
    const el = document.getElementById('constitution-data');
    if (!el || !this.publications) return;
    const con = this.publications.constitution;
    if (!con.preamble && con.articles.length === 0) {
      el.innerHTML = '<div class="no-data-msg">The Constitution has not yet been published by the President.</div>';
      return;
    }
    let html = '';
    if (con.preamble) html += `<div class="constitution-preamble"><h3>Preamble</h3><p>${con.preamble}</p></div>`;
    if (con.articles.length > 0) {
      html += '<div class="constitution-articles"><h3>Articles</h3>';
      con.articles.forEach((a, i) => {
        html += `<div class="constitution-article"><h4>Article ${i + 1}: ${a.title}</h4><p>${a.body}</p></div>`;
      });
      html += '</div>';
    }
    if (con.amendments.length > 0) {
      html += '<div class="constitution-amendments"><h3>Amendments</h3>';
      con.amendments.forEach((a, i) => {
        html += `<div class="constitution-article"><h4>Amendment ${i + 1}: ${a.title} (${this.formatDate(a.date)})</h4><p>${a.body}</p></div>`;
      });
      html += '</div>';
    }
    el.innerHTML = html;
  },

  renderTreasury() {
    const el = document.getElementById('treasury-data');
    if (!el || !this.worldState) return;
    const t = this.worldState.worldTreasury;
    const n = this.worldState.nations;

    el.innerHTML = `
      <div class="treasury-summary">
        <div class="treasury-stat"><span>World Treasury Reserve</span><strong>${t.balance.toLocaleString()} em</strong></div>
        <div class="treasury-stat"><span>Current Tax Rate</span><strong>${t.taxRate} em/cycle</strong></div>
        <div class="treasury-stat"><span>Total Collected</span><strong>${t.totalCollected.toLocaleString()} em</strong></div>
      </div>
      <h3 class="treasury-section-title">Member Nation Treasuries</h3>
      <table class="gov-table">
        <thead><tr><th>Nation</th><th>Leader</th><th>Treasury Balance</th><th>Citizens</th><th>Status</th></tr></thead>
        <tbody>
          ${n.map(nation => `<tr>
            <td><strong>${nation.name}</strong></td>
            <td>${nation.leader || '—'}</td>
            <td>${nation.treasury.toLocaleString()} em</td>
            <td>${nation.citizens}</td>
            <td style="color:var(--green);font-weight:600;">${nation.status === 'active' ? '● Active' : '○ Inactive'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  },

  renderArchives() {
    const el = document.getElementById('archives-data');
    if (!el) return;
    const pub = this.publications || { laws: [], whitePapers: [], pressReleases: [], notices: [], decrees: [], orders: [] };
    const prOffset = pub.pressReleases.length;

    const all = [
      ...pub.laws.map((x, i)         => ({ ...x, type: 'laws',         idx: i,            typeLabel: 'Law',           badge: 'badge-law'    })),
      ...pub.whitePapers.map((x, i)  => ({ ...x, type: 'whitePapers',  idx: i,            typeLabel: 'White Paper',   badge: 'badge-wp'     })),
      ...pub.pressReleases.map((x, i)=> ({ ...x, type: 'pressReleases',idx: i,            typeLabel: 'Press Release', badge: 'badge-pr'     })),
      ...this.pressFolder.map((x, i) => ({ ...x, type: 'pressReleases',idx: prOffset + i, typeLabel: 'Press Release', badge: 'badge-pr'     })),
      ...pub.notices.map((x, i)      => ({ ...x, type: 'notices',      idx: i,            typeLabel: 'Notice',        badge: 'badge-notice' })),
      ...pub.decrees.map((x, i)      => ({ ...x, type: 'decrees',      idx: i,            typeLabel: 'Decree',        badge: 'badge-decree' })),
      ...pub.orders.map((x, i)       => ({ ...x, type: 'orders',       idx: i,            typeLabel: 'Gov. Order',    badge: 'badge-order'  })),
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (all.length === 0) {
      el.innerHTML = '<div class="no-data-msg">No archived documents yet. Publications will appear here once the President issues them.</div>';
      return;
    }

    const byYear = {};
    all.forEach(item => {
      const year = item.date ? new Date(item.date).getFullYear() : 'Undated';
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(item);
    });

    let html = '';
    Object.keys(byYear).sort((a, b) => b - a).forEach(year => {
      html += `<div class="archive-year"><h3 class="archive-year-label">${year}</h3><ul class="pub-list">`;
      byYear[year].forEach(item => {
        html += `<li class="pub-item">
          <span class="pub-badge ${item.badge}">${item.typeLabel}</span>
          <div class="pub-meta">
            <span class="pub-title">${item.title || 'Untitled'}</span>
            <div class="pub-info">
              <span>${item.ref || this.pubNo(item.type, item.idx)}</span>
              <span>${this.formatDate(item.date)}</span>
              ${item.author || item.department ? `<span>${item.author || item.department}</span>` : ''}
            </div>
          </div>
        </li>`;
      });
      html += '</ul></div>';
    });
    el.innerHTML = html;
  }
};

document.addEventListener('DOMContentLoaded', () => GOV.init());
