import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import * as api from './api';
import EnvironmentBar from './components/EnvironmentBar';
import CampaignModal from './components/CampaignModal';
import CharactersPage from './pages/CharactersPage';
import CharacterDetailPage from './pages/CharacterDetailPage';
import StatusEffectsPage from './pages/StatusEffectsPage';
import ItemsPage from './pages/ItemsPage';
import EncountersPage from './pages/EncountersPage';
import RulesPage from './pages/RulesPage';
import LocationsPage from './pages/LocationsPage';
import EnvironmentSettingsPage from './pages/EnvironmentSettingsPage';
import SessionLogPage from './pages/SessionLogPage';
import JournalPage from './pages/JournalPage';
import DiceRoller from './components/DiceRoller';

export default function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [activeCampaignId, setActiveCampaignId] = useState(null);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [environment, setEnvironment] = useState(null);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const navigate = useNavigate();

  const loadCampaigns = useCallback(async () => {
    const data = await api.getCampaigns();
    setCampaigns(data);
    if (data.length > 0 && !activeCampaignId) {
      setActiveCampaignId(data[0].id);
    }
  }, [activeCampaignId]);

  const loadEnvironment = useCallback(async () => {
    if (!activeCampaignId) return;
    try {
      const env = await api.getEnvironment(activeCampaignId);
      setEnvironment(env);
    } catch { /* environment may not exist yet */ }
  }, [activeCampaignId]);

  const loadCampaign = useCallback(async () => {
    if (!activeCampaignId) return;
    const c = await api.getCampaign(activeCampaignId);
    setActiveCampaign(c);
  }, [activeCampaignId]);

  useEffect(() => { loadCampaigns(); }, []);

  useEffect(() => {
    if (activeCampaignId) {
      loadCampaign();
      loadEnvironment();
    }
  }, [activeCampaignId]);

  const switchCampaign = (id) => {
    setActiveCampaignId(id);
    setShowCampaignModal(false);
    navigate('/characters');
  };

  const refreshEnvironment = () => loadEnvironment();
  const refreshCampaign = () => { loadCampaign(); loadCampaigns(); };

  if (!activeCampaignId && campaigns.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Almanac</h1>
        <p style={{ color: 'var(--text-secondary)' }}>No campaigns found. Create one to get started.</p>
        <button className="btn btn-primary" onClick={() => setShowCampaignModal(true)}>Create Campaign</button>
        {showCampaignModal && (
          <CampaignModal
            campaigns={campaigns}
            onClose={() => setShowCampaignModal(false)}
            onSelect={switchCampaign}
            onRefresh={() => { loadCampaigns(); }}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1>Almanac</h1>
            <div className="campaign-name" onClick={() => setShowCampaignModal(true)}>
              {activeCampaign?.name || 'Select Campaign'} &#9662;
            </div>
          </div>
          <nav className="sidebar-nav">
            <NavLink to="/characters">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Characters
            </NavLink>
            <NavLink to="/status-effects">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Status Effects
            </NavLink>
            <NavLink to="/items">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
              Items
            </NavLink>
            <NavLink to="/encounters">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              Encounters
            </NavLink>
            <NavLink to="/rules">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
              Rules
            </NavLink>
            <NavLink to="/locations">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Locations
            </NavLink>
            <NavLink to="/journal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
              Journal
            </NavLink>
            <NavLink to="/environment">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              Settings
            </NavLink>
            <NavLink to="/session-log">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Session Log
            </NavLink>
          </nav>
          <DiceRoller campaignId={activeCampaignId} campaign={activeCampaign} />
        </aside>
        <div className="main-content">
          {environment && <EnvironmentBar environment={environment} campaignId={activeCampaignId} onUpdate={refreshEnvironment} campaign={activeCampaign} />}
          <Routes>
            <Route path="/" element={<Navigate to="/characters" replace />} />
            <Route path="/characters" element={<CharactersPage campaignId={activeCampaignId} campaign={activeCampaign} />} />
            <Route path="/characters/:charId" element={<CharacterDetailPage campaignId={activeCampaignId} campaign={activeCampaign} />} />
            <Route path="/status-effects" element={<StatusEffectsPage campaignId={activeCampaignId} campaign={activeCampaign} />} />
            <Route path="/items" element={<ItemsPage campaignId={activeCampaignId} campaign={activeCampaign} />} />
            <Route path="/encounters" element={<EncountersPage campaignId={activeCampaignId} campaign={activeCampaign} />} />
            <Route path="/rules" element={<RulesPage campaignId={activeCampaignId} campaign={activeCampaign} />} />
            <Route path="/locations" element={<LocationsPage campaignId={activeCampaignId} campaign={activeCampaign} environment={environment} onUpdate={() => { refreshEnvironment(); }} />} />
            <Route path="/journal" element={<JournalPage campaignId={activeCampaignId} />} />
            <Route path="/environment" element={<EnvironmentSettingsPage campaignId={activeCampaignId} campaign={activeCampaign} onUpdate={() => { refreshCampaign(); refreshEnvironment(); }} />} />
            <Route path="/session-log" element={<SessionLogPage campaignId={activeCampaignId} />} />
          </Routes>
        </div>
      </div>
      {showCampaignModal && (
        <CampaignModal
          campaigns={campaigns}
          activeCampaignId={activeCampaignId}
          onClose={() => setShowCampaignModal(false)}
          onSelect={switchCampaign}
          onRefresh={loadCampaigns}
        />
      )}
    </>
  );
}
