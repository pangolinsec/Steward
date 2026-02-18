const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Campaigns
export const getCampaigns = () => request('/campaigns');
export const getCampaign = (id) => request(`/campaigns/${id}`);
export const createCampaign = (data) => request('/campaigns', { method: 'POST', body: JSON.stringify(data) });
export const updateCampaign = (id, data) => request(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCampaign = (id) => request(`/campaigns/${id}`, { method: 'DELETE' });

// Characters
export const getCharacters = (cId, params = '') => request(`/campaigns/${cId}/characters${params ? '?' + params : ''}`);
export const getCharacter = (cId, charId) => request(`/campaigns/${cId}/characters/${charId}`);
export const getComputedStats = (cId, charId) => request(`/campaigns/${cId}/characters/${charId}/computed`);
export const createCharacter = (cId, data) => request(`/campaigns/${cId}/characters`, { method: 'POST', body: JSON.stringify(data) });
export const updateCharacter = (cId, charId, data) => request(`/campaigns/${cId}/characters/${charId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCharacter = (cId, charId) => request(`/campaigns/${cId}/characters/${charId}`, { method: 'DELETE' });

// Applied Effects
export const applyEffect = (cId, charId, effectDefId) => request(`/campaigns/${cId}/characters/${charId}/effects`, { method: 'POST', body: JSON.stringify({ status_effect_definition_id: effectDefId }) });
export const removeEffect = (cId, charId, effectId) => request(`/campaigns/${cId}/characters/${charId}/effects/${effectId}`, { method: 'DELETE' });

// Character Items
export const assignItem = (cId, charId, itemDefId, quantity = 1) => request(`/campaigns/${cId}/characters/${charId}/items`, { method: 'POST', body: JSON.stringify({ item_definition_id: itemDefId, quantity }) });
export const updateCharacterItemQty = (cId, charId, itemId, quantity) => request(`/campaigns/${cId}/characters/${charId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) });
export const removeCharacterItem = (cId, charId, itemId) => request(`/campaigns/${cId}/characters/${charId}/items/${itemId}`, { method: 'DELETE' });

// Status Effects
export const getStatusEffects = (cId, params = '') => request(`/campaigns/${cId}/status-effects${params ? '?' + params : ''}`);
export const getStatusEffect = (cId, id) => request(`/campaigns/${cId}/status-effects/${id}`);
export const createStatusEffect = (cId, data) => request(`/campaigns/${cId}/status-effects`, { method: 'POST', body: JSON.stringify(data) });
export const updateStatusEffect = (cId, id, data) => request(`/campaigns/${cId}/status-effects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteStatusEffect = (cId, id) => request(`/campaigns/${cId}/status-effects/${id}`, { method: 'DELETE' });

// Items
export const getItems = (cId, params = '') => request(`/campaigns/${cId}/items${params ? '?' + params : ''}`);
export const getItem = (cId, id) => request(`/campaigns/${cId}/items/${id}`);
export const createItem = (cId, data) => request(`/campaigns/${cId}/items`, { method: 'POST', body: JSON.stringify(data) });
export const updateItem = (cId, id, data) => request(`/campaigns/${cId}/items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteItem = (cId, id) => request(`/campaigns/${cId}/items/${id}`, { method: 'DELETE' });

// Encounters
export const getEncounters = (cId, params = '') => request(`/campaigns/${cId}/encounters${params ? '?' + params : ''}`);
export const getEncounter = (cId, id) => request(`/campaigns/${cId}/encounters/${id}`);
export const createEncounter = (cId, data) => request(`/campaigns/${cId}/encounters`, { method: 'POST', body: JSON.stringify(data) });
export const updateEncounter = (cId, id, data) => request(`/campaigns/${cId}/encounters/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteEncounter = (cId, id) => request(`/campaigns/${cId}/encounters/${id}`, { method: 'DELETE' });

// Locations
export const getLocations = (cId) => request(`/campaigns/${cId}/locations`);
export const getLocation = (cId, id) => request(`/campaigns/${cId}/locations/${id}`);
export const createLocation = (cId, data) => request(`/campaigns/${cId}/locations`, { method: 'POST', body: JSON.stringify(data) });
export const updateLocation = (cId, id, data) => request(`/campaigns/${cId}/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteLocation = (cId, id) => request(`/campaigns/${cId}/locations/${id}`, { method: 'DELETE' });
export const createEdge = (cId, data) => request(`/campaigns/${cId}/locations/edges`, { method: 'POST', body: JSON.stringify(data) });
export const updateEdge = (cId, id, data) => request(`/campaigns/${cId}/locations/edges/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteEdge = (cId, id) => request(`/campaigns/${cId}/locations/edges/${id}`, { method: 'DELETE' });
export const travel = (cId, edgeId) => request(`/campaigns/${cId}/locations/travel`, { method: 'POST', body: JSON.stringify({ edge_id: edgeId }) });
export const updatePartyPosition = (cId, locationId) => request(`/campaigns/${cId}/locations/position`, { method: 'PATCH', body: JSON.stringify({ location_id: locationId }) });

// Environment
export const getEnvironment = (cId) => request(`/campaigns/${cId}/environment`);
export const updateEnvironment = (cId, data) => request(`/campaigns/${cId}/environment`, { method: 'PATCH', body: JSON.stringify(data) });
export const advanceTime = (cId, data) => request(`/campaigns/${cId}/environment/advance`, { method: 'POST', body: JSON.stringify(data) });

// Session Log
export const getSessionLog = (cId, params = '') => request(`/campaigns/${cId}/session-log${params ? '?' + params : ''}`);
export const addLogEntry = (cId, data) => request(`/campaigns/${cId}/session-log`, { method: 'POST', body: JSON.stringify(data) });
export const clearSessionLog = (cId) => request(`/campaigns/${cId}/session-log`, { method: 'DELETE' });

// Rules
export const getRules = (cId, params = '') => request(`/campaigns/${cId}/rules${params ? '?' + params : ''}`);
export const getRule = (cId, id) => request(`/campaigns/${cId}/rules/${id}`);
export const createRule = (cId, data) => request(`/campaigns/${cId}/rules`, { method: 'POST', body: JSON.stringify(data) });
export const updateRule = (cId, id, data) => request(`/campaigns/${cId}/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteRule = (cId, id) => request(`/campaigns/${cId}/rules/${id}`, { method: 'DELETE' });
export const toggleRule = (cId, id) => request(`/campaigns/${cId}/rules/${id}/toggle`, { method: 'PATCH' });
export const getRuleTemplates = (cId) => request(`/campaigns/${cId}/rules/templates`);
export const importRuleTemplate = (cId, templateName) => request(`/campaigns/${cId}/rules/templates/${templateName}`, { method: 'POST' });
export const testRule = (cId, ruleId, characterId) => request(`/campaigns/${cId}/rules/${ruleId}/test`, { method: 'POST', body: JSON.stringify({ character_id: characterId || null }) });
export const getRuleReferences = (cId, entityType, entityName, entityId) => {
  const params = new URLSearchParams();
  if (entityType) params.set('entity_type', entityType);
  if (entityName) params.set('entity_name', entityName);
  if (entityId) params.set('entity_id', entityId);
  return request(`/campaigns/${cId}/rules/references?${params}`);
};

// Rest
export const rest = (cId, restType) => request(`/campaigns/${cId}/rest`, { method: 'POST', body: JSON.stringify({ rest_type: restType }) });

// Notifications
export const getNotifications = (cId, params = '') => request(`/campaigns/${cId}/notifications${params ? '?' + params : ''}`);
export const getNotificationCount = (cId) => request(`/campaigns/${cId}/notifications/count`);
export const markNotificationRead = (cId, nId) => request(`/campaigns/${cId}/notifications/${nId}/read`, { method: 'PATCH' });
export const dismissNotification = (cId, nId) => request(`/campaigns/${cId}/notifications/${nId}/dismiss`, { method: 'PATCH' });
export const applyNotification = (cId, nId) => request(`/campaigns/${cId}/notifications/${nId}/apply`, { method: 'POST' });
export const undoNotification = (cId, nId) => request(`/campaigns/${cId}/notifications/${nId}/undo`, { method: 'POST' });
export const clearNotifications = (cId) => request(`/campaigns/${cId}/notifications`, { method: 'DELETE' });

// Export / Import
export const exportCampaign = (cId) => request(`/campaigns/${cId}/export`);
export const importCampaign = (cId, data) => request(`/campaigns/${cId}/import`, { method: 'POST', body: JSON.stringify(data) });
export const previewImport = (cId, data, entityTypes) => request(`/campaigns/${cId}/import/preview`, { method: 'POST', body: JSON.stringify({ data, entityTypes }) });
export const mergeImport = (cId, data, entityTypes, decisions) => request(`/campaigns/${cId}/import/merge`, { method: 'POST', body: JSON.stringify({ data, entityTypes, decisions }) });
