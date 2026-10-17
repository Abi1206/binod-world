// ENDERGATE public gateway. This page has no console, no inputs and no network code (and its Content-Security-Policy forbids network requests).
// The only thing this script does: an earlier version of this page had a demo log that kept plain-text entries in this browser's
// localStorage. Erase anything it left behind, so nothing typed there lingers on this device.
try { localStorage.removeItem('bwn_demo_log_v1'); } catch { /* storage unavailable: nothing to erase */ }
