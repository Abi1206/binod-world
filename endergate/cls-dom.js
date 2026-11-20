// Tiny DOM helpers for the classified portals (re-exports the shared safe builder; text only, never innerHTML).
import { el } from './dom.js';
export { el };
export const field_ = (label, input) => el('label', {}, label, input);
