// The End (static edition): where restricted systems are found. They are reached only by typing their exact name.
import { el } from './static-api.js';
import { boot, main, serviceSearch } from './eg.js';

boot('end', async () => {
  main().append(
    el('h1', {}, 'The End'),
    el('p', { class: 'dim' }, 'Past the last node, the signal thins. Restricted systems do not appear in any list: they answer only to their exact name.'),
    serviceSearch());
});
