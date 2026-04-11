const { DEFAULT_SETTINGS, MESSAGE_TYPES, LOG_PREFIX } = require('../../shared');

describe('shared.js', () => {
  describe('DEFAULT_SETTINGS', () => {
    test('enabled defaults to true', () => {
      expect(DEFAULT_SETTINGS.enabled).toBe(true);
    });

    test('targetLang defaults to "ja"', () => {
      expect(DEFAULT_SETTINGS.targetLang).toBe('ja');
    });
  });

  describe('MESSAGE_TYPES', () => {
    test('TRANSLATE_PAGE is "translatePage"', () => {
      expect(MESSAGE_TYPES.TRANSLATE_PAGE).toBe('translatePage');
    });

    test('LANG_FALLBACK is "langFallback"', () => {
      expect(MESSAGE_TYPES.LANG_FALLBACK).toBe('langFallback');
    });

    test('SETTINGS_UPDATE is "settingsUpdate"', () => {
      expect(MESSAGE_TYPES.SETTINGS_UPDATE).toBe('settingsUpdate');
    });

    test('SETTINGS_CHANGED is "settingsChanged"', () => {
      expect(MESSAGE_TYPES.SETTINGS_CHANGED).toBe('settingsChanged');
    });
  });

  describe('LOG_PREFIX', () => {
    test('is "[Udemy Auto Translate]"', () => {
      expect(LOG_PREFIX).toBe('[Udemy Auto Translate]');
    });
  });
});
