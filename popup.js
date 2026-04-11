/**
 * Udemy Auto Translate - Popup UI Script
 */

/* global DEFAULT_SETTINGS, TRANSLATE_MODES, MESSAGE_TYPES, LOG_PREFIX, chrome */

const MODE_LABELS = {
  original: '原文（英語）',
  standard: '翻訳',
};

function updateUI(settings) {
  const radios = document.querySelectorAll('input[name="translateMode"]');
  for (const radio of radios) {
    radio.checked = radio.value === settings.translateMode;
  }
  const targetLang = document.getElementById('targetLang');
  if (targetLang) targetLang.value = settings.targetLang;
  const statusText = document.getElementById('statusText');
  if (statusText) statusText.textContent = MODE_LABELS[settings.translateMode] || '翻訳';
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['enabled', 'targetLang', 'translateMode']);
    const settings = {
      enabled: result.enabled !== undefined ? result.enabled : DEFAULT_SETTINGS.enabled,
      targetLang: result.targetLang || DEFAULT_SETTINGS.targetLang,
      translateMode: result.translateMode || DEFAULT_SETTINGS.translateMode,
    };
    updateUI(settings);
  } catch (err) {
    console.error(LOG_PREFIX, 'ERROR: Failed to load settings -', err);
    updateUI(DEFAULT_SETTINGS);
  }
}

async function saveSettings() {
  const selectedMode = document.querySelector('input[name="translateMode"]:checked');
  const targetLang = document.getElementById('targetLang');

  const settings = {
    enabled: selectedMode ? selectedMode.value !== 'original' : true,
    targetLang: targetLang ? targetLang.value : DEFAULT_SETTINGS.targetLang,
    translateMode: selectedMode ? selectedMode.value : DEFAULT_SETTINGS.translateMode,
  };

  try { await chrome.storage.local.set(settings); } catch (err) {
    console.error(LOG_PREFIX, 'ERROR: Failed to save settings -', err);
  }
  try {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SETTINGS_UPDATE, settings });
  } catch (err) {
    console.error(LOG_PREFIX, 'ERROR: Failed to send settings update -', err);
  }
  updateUI(settings);
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    const radios = document.querySelectorAll('input[name="translateMode"]');
    for (const radio of radios) radio.addEventListener('change', saveSettings);
    const targetLang = document.getElementById('targetLang');
    if (targetLang) targetLang.addEventListener('change', saveSettings);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadSettings, saveSettings, updateUI };
}
