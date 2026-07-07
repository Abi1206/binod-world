// RIID Classified Network — data loader
// Reads assets/cases/manifest.json (same manual, no-backend manifest+JSON
// workflow as the public portal's assets/press_releases/ and assets/cases/).

const RC_DATA = {
  cases: [],

  async init() {
    try {
      const res = await fetch('assets/cases/manifest.json');
      if (res.ok) this.cases = await res.json();
    } catch (_) {}
    this.render();
  },

  clsClass(level) {
    const map = {
      'PUBLIC': 'cls-public', 'RESTRICTED': 'cls-restricted', 'CONFIDENTIAL': 'cls-confidential',
      'SECRET': 'cls-secret', 'TOP SECRET': 'cls-topsecret', 'OMEGA': 'cls-omega'
    };
    return map[level] || 'cls-restricted';
  },

  threatClass(level) {
    const map = { 'LOW': 'threat-low', 'GUARDED': 'threat-guarded', 'ELEVATED': 'threat-elevated', 'CRITICAL': 'threat-critical' };
    return map[level] || 'threat-guarded';
  },

  render() {
    // Dashboard counts
    const activeCount = document.getElementById('rc-active-ops-count');
    if (activeCount) activeCount.textContent = String(this.cases.filter(c => c.status === 'ACTIVE').length);
    const totalCount = document.getElementById('rc-intel-reports-count');
    if (totalCount) totalCount.textContent = String(this.cases.reduce((n, c) => n + (c.documents ? c.documents.length : 0), 0));

    // Case file detail (single lean example — first case in the manifest)
    const doc = document.getElementById('rc-case-doc');
    if (doc) {
      const c = this.cases[0];
      if (!c) {
        doc.innerHTML = '<div class="no-data-msg">No classified case files on record.</div>';
        return;
      }
      doc.innerHTML = `
        <div class="rc-doc-header">
          <div>
            <div class="rc-doc-id">${c.caseId} &nbsp;·&nbsp; ${c.operationName} &nbsp;·&nbsp; Status: ${c.status}</div>
            <div class="rc-doc-title">${c.operationName}</div>
          </div>
          <div><span class="cls-badge ${this.clsClass(c.classification)}" style="font-size:0.72rem; padding:6px 14px;">${c.classification}</span></div>
        </div>
        <div class="rc-meta">
          <div class="rc-meta-cell"><label>Case ID</label><span>${c.caseId}</span></div>
          <div class="rc-meta-cell"><label>Threat Level</label><span class="threat-badge ${this.threatClass(c.threatLevel)}" style="padding:3px 10px; font-size:0.62rem;">${c.threatLevel}</span></div>
          <div class="rc-meta-cell"><label>Status</label><span class="${c.status === 'ACTIVE' ? 'active' : 'pending'}">${c.status}</span></div>
          <div class="rc-meta-cell"><label>Date Opened</label><span>${c.dateOpened}</span></div>
          <div class="rc-meta-cell"><label>Lead Investigator</label><span>${c.leadInvestigator}</span></div>
          <div class="rc-meta-cell"><label>Assigned Agents</label><span>${(c.assignedAgents || []).join(', ') || '—'}</span></div>
          <div class="rc-meta-cell"><label>Distribution</label><span>${c.distribution || '—'}</span></div>
        </div>
        <div class="rc-body">
          <h4>Evidence</h4>
          <ul>${(c.evidence || []).map(e => `<li>${e}</li>`).join('') || '<li>None on file.</li>'}</ul>

          <h4>Witnesses</h4>
          <ul>${(c.witnesses || []).map(w => `<li>${w}</li>`).join('') || '<li>None on file.</li>'}</ul>

          <h4>Suspects</h4>
          <ul>${(c.suspects || []).map(s => `<li>${s}</li>`).join('') || '<li>None identified.</li>'}</ul>

          <h4>Timeline</h4>
          <ul class="rc-timeline-list">${(c.timeline || []).map(t => `<li><span class="rc-tdate">${t.date}</span>${t.event}</li>`).join('') || '<li>No timeline entries.</li>'}</ul>

          <h4>Documents on File</h4>
          <ul>${(c.documents || []).map(d => `<li>${d}</li>`).join('') || '<li>None.</li>'}</ul>

          <h4>Images</h4>
          <ul>${(c.images || []).map(d => `<li>${d}</li>`).join('') || '<li>None.</li>'}</ul>

          <h4>Audio</h4>
          <ul>${(c.audio || []).map(d => `<li>${d}</li>`).join('') || '<li>None.</li>'}</ul>

          <h4>Video</h4>
          <ul>${(c.video || []).map(d => `<li>${d}</li>`).join('') || '<li>None.</li>'}</ul>

          <h4>Final Report</h4>
          <p>${c.finalReport || 'PENDING.'}</p>
        </div>`;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => RC_DATA.init());
