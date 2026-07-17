// Persistence for the Kimi chat app. Everything lives in localStorage —
// the API keys never leave the user's browser.

const SETTINGS_KEY = 'kimiChat.settings';
const TABS_KEY = 'kimiChat.tabs';
const ACTIVE_KEY = 'kimiChat.activeTab';

export const DEFAULT_SETTINGS = {
  provider: 'moonshot',
  baseUrl: 'https://api.moonshot.ai/v1',
  apiKey: '',
  model: 'kimi-k2-0905-preview',
  githubToken: '',
  systemPrompt: '',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / private mode — the app keeps working in-memory
  }
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

export function newTab() {
  return {
    id: `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'משימה חדשה',
    createdAt: Date.now(),
    messages: [],
  };
}

export function loadTabs() {
  const tabs = read(TABS_KEY, null);
  if (Array.isArray(tabs) && tabs.length) return tabs;
  return [newTab()];
}

export function saveTabs(tabs) {
  write(TABS_KEY, tabs);
}

export function loadActiveTabId() {
  return read(ACTIVE_KEY, null);
}

export function saveActiveTabId(id) {
  write(ACTIVE_KEY, id);
}
