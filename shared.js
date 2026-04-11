/**
 * Udemy Auto Translate - 共通定数・デフォルト設定
 *
 * Chrome拡張機能の各コンポーネント（Content Script, Background SW, Popup）で
 * 共有される定数とデフォルト値を定義する。
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  targetLang: 'ja',
  translateMode: 'standard', // 'original' | 'standard'
};

const TRANSLATE_MODES = {
  ORIGINAL: 'original',
  STANDARD: 'standard',
};

const MESSAGE_TYPES = {
  TRANSLATE_PAGE: 'translatePage',
  LANG_FALLBACK: 'langFallback',
  SETTINGS_UPDATE: 'settingsUpdate',
  SETTINGS_CHANGED: 'settingsChanged',
};

const LOG_PREFIX = '[Udemy Auto Translate]';

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_SETTINGS, TRANSLATE_MODES, MESSAGE_TYPES, LOG_PREFIX };
}
