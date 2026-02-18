import * as api from '../api';

export async function resolveWikilink(campaignId, name) {
  const results = await api.searchEntities(campaignId, name);
  const exact = results.find(r => r.name.toLowerCase() === name.toLowerCase());
  const match = exact || results[0];
  if (!match) return null;

  switch (match.entity_type) {
    case 'character': return `/characters/${match.id}`;
    case 'location': return '/locations';
    case 'item': return '/items';
    case 'effect': return '/status-effects';
    default: return null;
  }
}
