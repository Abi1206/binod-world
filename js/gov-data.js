// Binod World Government — Government Data Loader
// Reads publications.json (flat array, auto-exported from the Government ID Panel)
// and world-state.json (static nations metadata).

const GOV = {
  worldState:   null,
  publications: null,   // raw array from publications.json
  pub:          null,   // { laws, whitePapers, constitution, decrees, announcements, pressReleases, elections, leaders }
  pressFolder:  [],

  async init() {
    try {
      const [wsRes, pubRes] = await Promise.all([
        fetch('data/world-state.json'),
        fetch('data/publications.json')
      ]);
      if (wsRes.ok)  this.worldState = await wsRes.json();
      if (pubRes.ok) {
        const raw = await pubRes.json();
        this.publications = raw.publications ?? [];
        this._buildViews();
      }
    } catch (_) {}

    // Press-release folder (PDFs / JSON files)
    try {
      const mRes = await fetch('assets/press_release/manifest.json');
      if (mRes.ok) {
        const entries = await mRes.json();
        const loaded = await Promise.all(entries.map(async (entry) => {
          if (entry.file && entry.file.endsWith('.json')) {
            try {
              const r = await fetch(`assets/press_release/${entry.file}`);
              if (r.ok) return { ...entry, ...(await r.json()) };
            } catch (_) {}
          }
          return entry;
        }));
        this.pressFolder = loaded.filter(Boolean);
      }
    } catch (_) {}

    this.render();
  },

  // ── Build filtered views from the flat publications array ──────────────────

  _buildViews() {
    const all = this.publications;
    const byType = (t) => all.filter(p => p.type === t);

    const articles   = byType('article');
    const amendments = byType('amendment');
    const conEntry   = all.find(p => p.type === 'constitution') ?? null;

    this.pub = {
      laws:          byType('law'),
      whitePapers:   byType('whitepaper'),
      pressReleases: byType('press_release'),
      announcements: byType('announcement'),
      decrees:       byType('presidential_order'),
      elections:     byType('election').filter(p => p.status === 'elected'),
      currentPres:   all.find(p => p.type === 'election' && p.status === 'active') ?? null,
      leaders:       byType('leader_update'),
      constitution:  {
        preamble:   conEntry?.content ?? null,
        publishDay: conEntry?.day ?? null,
        articles,
        amendments
      }
    };
  },

  // ── Helpers ────────────────────────────────────────────────────────────────

  formatDate(iso) {
    if (iso == null) return '—';
    if (typeof iso === 'number' || /^\d+$/.test(String(iso))) return `Day ${iso}`;
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  },

  formatContent(text) {
    if (!text) return '';
    return '<p>' + String(text).split(/\n\n+/).map(p => p.replace(/\n/g, '<br>')).join('</p><p>') + '</p>';
  },

  buildPRCards(items) {
    if (items.length === 0) {
      return '<div class="no-data-msg">No press releases have been issued yet.</div>';
    }
    return items.map((item, i) => {
      const isPDF = item.file && item.file.endsWith('.pdf');
      const ref   = item.ref || item.id || `PR-${String(i + 1).padStart(3, '0')}`;
      return `
      <article class="pr-card">
        <div class="pr-card-meta-row">
          <span class="pub-badge badge-pr">Press Release</span>
          <span class="pr-card-ref">${ref}</span>
          <span class="pr-card-date">${this.formatDate(item.date ?? item.day)}</span>
        </div>
        <h3 class="pr-card-title">${item.title || 'Untitled'}</h3>
        ${(item.author || item.publishedBy) ? `<div class="pr-card-author">— ${item.author || item.publishedBy}</div>` : ''}
        ${item.summary ? `<p class="pr-card-summary">${item.summary}</p>` : ''}
        ${item.content ? `<div class="pr-card-body">${this.formatContent(item.content)}</div>` : ''}
        ${isPDF ? `<a href="assets/press_release/${item.file}" target="_blank" rel="noopener noreferrer" class="btn btn-navy btn-sm pr-card-pdf-btn">View PDF →</a>` : ''}
      </article>`;
    }).join('');
  },

  // ── Renderers ──────────────────────────────────────────────────────────────

  render() {
    this.renderAnnouncement();
    this.renderStats();
    this.renderLatestPublications();
    this.renderPresident();
    this.renderNations();
    this.renderPublicationsPage();
    this.renderConstitution();
    this.renderArchives();
    this.renderElectionBanner();
  },

  renderAnnouncement() {
    const el = document.getElementById('gov-announcement-text');
    if (!el) return;
    const pres = this.pub?.currentPres;
    const ws   = this.worldState;
    const election = ws?.election;
    if (election?.status === 'active') {
      el.textContent = `World Election in Progress — Election Day: ${this.formatDate(election.nextElectionDay)}`;
    } else if (election?.registrationOpen) {
      el.textContent = 'Election Registration Now Open — Country leaders may register at the Binod Ballot Box.';
    } else if (pres) {
      el.textContent = `World President: ${pres.leader} (${pres.country}) — Term ${pres.termNumber ?? 1}`;
    } else {
      el.textContent = 'Binod World Government — Official Government Portal';
    }
  },

  renderElectionBanner() {
    const el = document.getElementById('election-status-banner');
    if (!el || !this.worldState) return;
    const e = this.worldState.election;
    if (e?.status === 'active' || e?.registrationOpen) el.style.display = 'block';
  },

  renderStats() {
    const pub = this.pub;
    const ws  = this.worldState;
    if (!pub && !ws) return;
    const map = {
      'stat-nations': ws?.statistics?.totalNations ?? 0,
      'stat-years':   ws?.statistics?.yearsOfAdministration ?? 0,
      'stat-laws':    pub?.laws?.length ?? 0,
      'stat-wps':     pub?.whitePapers?.length ?? 0,
      'stat-prs':     (pub?.pressReleases?.length ?? 0) + this.pressFolder.length,
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.setAttribute('data-count', val);
      // Re-animate: the IntersectionObserver fires before data loads, so we run it ourselves
      if (val === 0) { el.textContent = '0'; return; }
      let current = 0;
      const step = Math.max(1, Math.ceil(val / 40));
      const timer = setInterval(() => {
        current = Math.min(current + step, val);
        el.textContent = current.toLocaleString();
        if (current >= val) clearInterval(timer);
      }, 28);
    });
  },

  renderLatestPublications() {
    const el = document.getElementById('latest-publications');
    if (!el || !this.pub) return;

    const typeLabel = { law: 'Law', whitepaper: 'White Paper', press_release: 'Press Release', announcement: 'Notice', presidential_order: 'Decree' };
    const typeBadge = { law: 'badge-law', whitepaper: 'badge-wp', press_release: 'badge-pr', announcement: 'badge-notice', presidential_order: 'badge-decree' };

    const shown = ['law', 'whitepaper', 'press_release', 'announcement', 'presidential_order'];
    const all = [
      ...this.publications.filter(p => shown.includes(p.type)),
      ...this.pressFolder.map(x => ({ ...x, type: 'press_release', day: x.date }))
    ].sort((a, b) => (b.day ?? 0) - (a.day ?? 0)).slice(0, 8);

    if (all.length === 0) {
      el.innerHTML = '<div class="no-data-msg">No publications have been released yet.</div>';
      return;
    }

    el.innerHTML = '<ul class="pub-list">' + all.map(item => `
      <li class="pub-item">
        <span class="pub-badge ${typeBadge[item.type] ?? 'badge-law'}">${typeLabel[item.type] ?? item.type}</span>
        <div class="pub-meta">
          <span class="pub-title">${item.title || 'Untitled'}</span>
          <div class="pub-info">
            <span>${item.id || ''}</span>
            <span>${this.formatDate(item.day ?? item.date)}</span>
            ${item.publishedBy || item.author ? `<span>${item.publishedBy || item.author}</span>` : ''}
          </div>
        </div>
      </li>`).join('') + '</ul>';
  },

  renderPresident() {
    const el     = document.getElementById('president-data');
    const nameEl = document.getElementById('president-name');
    const pres   = this.pub?.currentPres;

    if (!el) return;
    const isVacant = !pres;

    if (nameEl) nameEl.textContent = isVacant ? 'Office Vacant' : pres.leader;

    if (isVacant) {
      el.innerHTML = `
        <div class="president-vacant">
          <div class="president-vacant-badge">VACANT</div>
          <p class="text-muted">The Office of the World President is currently vacant, pending the outcome of the next general election.</p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="president-meta-table">
        <div class="pmeta-row"><span>Name</span><strong>${pres.leader}</strong></div>
        <div class="pmeta-row"><span>Nation</span><strong>${pres.country || '—'}</strong></div>
        <div class="pmeta-row"><span>Office</span><strong>World President</strong></div>
        <div class="pmeta-row"><span>In Office Since</span><strong>${this.formatDate(pres.day)}</strong></div>
        <div class="pmeta-row"><span>Term</span><strong>${pres.termNumber ?? 1} of 3</strong></div>
        <div class="pmeta-row"><span>Status</span><strong style="color:var(--green);">● In Office</strong></div>
      </div>`;
  },

  renderNations() {
    const el = document.getElementById('nations-data');
    if (!el || !this.worldState) return;

    // Overlay leader names from leader_update records
    const leaderMap = {};
    (this.pub?.leaders ?? []).forEach(l => {
      if (l.leader && !String(l.leader).match(/^-?\d+$/)) {
        leaderMap[l.country] = l.leader;
      }
    });

    el.innerHTML = this.worldState.nations.map(n => {
      const leader = leaderMap[n.name] ?? n.leader ?? 'Vacant';
      return `
      <div class="nation-card">
        <img src="${n.flag}" alt="${n.name} Flag" class="nation-flag-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
        <div class="nation-flag-placeholder" style="display:none;">${n.emoji}</div>
        <div class="nation-body">
          <span class="nation-badge">${n.badge}</span>
          <div class="nation-name">${n.name}</div>
          <div class="nation-role">${n.role}</div>
          <ul class="nation-facts">
            <li><span>Capital</span><strong>${n.capital}</strong></li>
            <li><span>Leader</span><strong>${leader}</strong></li>
            <li><span>Est.</span><strong>${n.established}</strong></li>
            <li><span>Gov. Type</span><strong>${n.governmentType}</strong></li>
            <li><span>Status</span><strong>${n.status === 'active' ? 'Active Member' : 'Inactive'}</strong></li>
          </ul>
        </div>
      </div>`;
    }).join('');
  },

  renderPublicationsPage() {
    if (!this.pub) return;

    // Laws
    const lawEl = document.getElementById('page-laws');
    if (lawEl) {
      const items = this.pub.laws;
      lawEl.innerHTML = items.length === 0
        ? '<div class="no-data-msg">No records published yet.</div>'
        : '<ul class="pub-list">' + items.map(item => `
          <li class="pub-item">
            <span class="pub-badge badge-law">Law</span>
            <div class="pub-meta">
              <span class="pub-title">${item.title || 'Untitled'}</span>
              <div class="pub-info">
                <span>${item.id}</span>
                <span>${this.formatDate(item.day)}</span>
                <span>${item.publishedBy || ''}</span>
                ${item.content ? `<span>${item.content.slice(0, 80)}${item.content.length > 80 ? '…' : ''}</span>` : ''}
              </div>
            </div>
          </li>`).join('') + '</ul>';
    }

    // White Papers
    const wpEl = document.getElementById('page-wps');
    if (wpEl) {
      const items = this.pub.whitePapers;
      wpEl.innerHTML = items.length === 0
        ? '<div class="no-data-msg">No records published yet.</div>'
        : '<ul class="pub-list">' + items.map(item => `
          <li class="pub-item">
            <span class="pub-badge badge-wp">White Paper</span>
            <div class="pub-meta">
              <span class="pub-title">${item.title || 'Untitled'}</span>
              <div class="pub-info">
                <span>${item.id}</span>
                <span>${this.formatDate(item.day)}</span>
                ${item.category ? `<span>${item.category}</span>` : ''}
                ${item.content ? `<span>${item.content.slice(0, 80)}${item.content.length > 80 ? '…' : ''}</span>` : ''}
              </div>
            </div>
          </li>`).join('') + '</ul>';
    }

    // Notices (announcements)
    const notEl = document.getElementById('page-notices');
    if (notEl) {
      const items = this.pub.announcements;
      notEl.innerHTML = items.length === 0
        ? '<div class="no-data-msg">No records published yet.</div>'
        : '<ul class="pub-list">' + items.map(item => `
          <li class="pub-item">
            <span class="pub-badge badge-notice">Notice</span>
            <div class="pub-meta">
              <span class="pub-title">${item.title || 'Untitled'}</span>
              <div class="pub-info">
                <span>${item.id}</span>
                <span>${this.formatDate(item.day)}</span>
                <span>${item.publishedBy || ''}</span>
              </div>
            </div>
          </li>`).join('') + '</ul>';
    }

    // Press Releases
    const prEl = document.getElementById('page-prs');
    if (prEl) {
      const combined = [
        ...this.pub.pressReleases,
        ...this.pressFolder.map(x => ({ ...x, day: x.date }))
      ].sort((a, b) => (b.day ?? 0) - (a.day ?? 0));
      prEl.innerHTML = this.buildPRCards(combined);
    }
  },

  renderConstitution() {
    const el  = document.getElementById('constitution-data');
    if (!el || !this.pub) return;
    const con = this.pub.constitution;

    if (!con.preamble && con.articles.length === 0) {
      el.innerHTML = '<div class="no-data-msg">The Constitution has not yet been published by the President.</div>';
      return;
    }

    let html = '';
    if (con.preamble) {
      html += `<div class="constitution-preamble"><h3>Preamble</h3>${this.formatContent(con.preamble)}</div>`;
    }
    if (con.articles.length > 0) {
      html += '<div class="constitution-articles"><h3>Articles</h3>';
      con.articles.forEach((a, i) => {
        html += `<div class="constitution-article"><h4>Article ${i + 1}: ${a.title} <span class="pub-info-inline">${this.formatDate(a.day)}</span></h4>${this.formatContent(a.content || '')}</div>`;
      });
      html += '</div>';
    }
    if (con.amendments.length > 0) {
      html += '<div class="constitution-amendments"><h3>Amendments</h3>';
      con.amendments.forEach((a, i) => {
        html += `<div class="constitution-article"><h4>${a.title} — ${this.formatDate(a.day)}</h4>${this.formatContent(a.content || '')}</div>`;
      });
      html += '</div>';
    }
    el.innerHTML = html;
  },

  renderArchives() {
    const el = document.getElementById('archives-data');
    if (!el || !this.pub) return;

    const typeLabel = { law: 'Law', whitepaper: 'White Paper', press_release: 'Press Release', announcement: 'Notice', presidential_order: 'Decree', election: 'Election', constitution: 'Constitution', article: 'Article', amendment: 'Amendment' };
    const typeBadge = { law: 'badge-law', whitepaper: 'badge-wp', press_release: 'badge-pr', announcement: 'badge-notice', presidential_order: 'badge-decree', election: 'badge-order', constitution: 'badge-law', article: 'badge-law', amendment: 'badge-law' };

    const shown = ['law', 'whitepaper', 'press_release', 'announcement', 'presidential_order', 'constitution', 'article', 'amendment'];
    const all = [
      ...this.publications.filter(p => shown.includes(p.type)),
      ...this.pressFolder.map(x => ({ ...x, type: 'press_release', day: x.date }))
    ].sort((a, b) => (b.day ?? 0) - (a.day ?? 0));

    if (all.length === 0) {
      el.innerHTML = '<div class="no-data-msg">No archived documents yet.</div>';
      return;
    }

    const byDay = {};
    all.forEach(item => {
      const bucket = item.day ?? 'Undated';
      if (!byDay[bucket]) byDay[bucket] = [];
      byDay[bucket].push(item);
    });

    let html = '';
    Object.keys(byDay).sort((a, b) => Number(b) - Number(a)).forEach(day => {
      html += `<div class="archive-year"><h3 class="archive-year-label">${day === 'Undated' ? 'Undated' : 'Day ' + day}</h3><ul class="pub-list">`;
      byDay[day].forEach(item => {
        html += `<li class="pub-item">
          <span class="pub-badge ${typeBadge[item.type] ?? 'badge-law'}">${typeLabel[item.type] ?? item.type}</span>
          <div class="pub-meta">
            <span class="pub-title">${item.title || 'Untitled'}</span>
            <div class="pub-info">
              <span>${item.id || ''}</span>
              <span>${this.formatDate(item.day ?? item.date)}</span>
              ${item.publishedBy || item.author ? `<span>${item.publishedBy || item.author}</span>` : ''}
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
