/**
 * Udemy Auto Translate - Background Service Worker
 *
 * 翻訳APIの呼び出しとメッセージルーティングを担当する。
 * Content Scriptからの翻訳リクエストを受け取り、Chrome翻訳を再トリガーする。
 * 失敗時はContent Scriptへフォールバック指示を送信する。
 */

/* global DEFAULT_SETTINGS, MESSAGE_TYPES, LOG_PREFIX, chrome */

// Service Workerでshared.jsを読み込む
try {
  importScripts('shared.js');
} catch (e) {
  // テスト環境ではimportScriptsが存在しない
}

/**
 * chrome.storage.localから設定を読み込む。
 * 保存された設定がない場合はDEFAULT_SETTINGSを返す。
 * @returns {Promise<{enabled: boolean, targetLang: string}>}
 */
async function getSettings() {
  try {
    const result = await chrome.storage.local.get(['enabled', 'targetLang']);
    return {
      enabled: result.enabled !== undefined ? result.enabled : DEFAULT_SETTINGS.enabled,
      targetLang: result.targetLang !== undefined ? result.targetLang : DEFAULT_SETTINGS.targetLang,
    };
  } catch (err) {
    console.error(LOG_PREFIX, 'ERROR: Failed to read settings -', err);
    return Object.assign({}, DEFAULT_SETTINGS);
  }
}

/**
 * chrome.storage.localに設定を保存する。
 * @param {{enabled?: boolean, targetLang?: string}} settings - 保存する設定
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  try {
    await chrome.storage.local.set(settings);
  } catch (err) {
    console.error(LOG_PREFIX, 'ERROR: Failed to save settings -', err);
  }
}

/**
 * chrome.scripting.executeScriptを使用してページのlang属性を変更し、
 * Chromeの組み込み翻訳を再トリガーする。
 * @param {number} tabId - 対象タブのID
 * @param {string} targetLang - 翻訳先言語コード
 * @returns {Promise<void>}
 */
async function triggerTranslation(tabId, targetLang) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (lang) => {
      const original = document.documentElement.lang;
      document.documentElement.lang = 'en';
      setTimeout(() => {
        document.documentElement.lang = lang;
        setTimeout(() => {
          document.documentElement.lang = original || '';
        }, 100);
      }, 50);
    },
    args: [targetLang],
  });
}

/**
 * 翻訳API失敗時のフォールバック処理。
 * Content ScriptへlangFallbackメッセージを送信し、
 * Quiz Containerのlang属性変更による翻訳再トリガーを指示する。
 * @param {number} tabId - 対象タブのID
 * @param {string} targetLang - 翻訳先言語コード
 * @returns {Promise<void>}
 */
async function triggerFallbackTranslation(tabId, targetLang) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPES.LANG_FALLBACK,
      targetLang,
    });
  } catch (err) {
    console.error(LOG_PREFIX, 'ERROR: Failed to send fallback message -', err);
  }
}

// ブラウザコンテキストでのみリスナーを登録（テスト時はスキップ）
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.TRANSLATE_PAGE) {
      const tabId = sender.tab && sender.tab.id;
      if (!tabId) {
        return;
      }

      getSettings().then(async (settings) => {
        if (!settings.enabled) {
          return;
        }

        try {
          await triggerTranslation(tabId, settings.targetLang);
        } catch (err) {
          console.error(LOG_PREFIX, 'ERROR: Translation trigger failed -', err);
          await triggerFallbackTranslation(tabId, settings.targetLang);
        }
      });

      // 非同期処理のためtrueを返す
      return true;
    }

    if (message.type === MESSAGE_TYPES.SETTINGS_UPDATE) {
      const newSettings = message.settings;
      if (!newSettings) {
        return;
      }

      saveSettings(newSettings).then(() => {
        // Content Scriptへ設定変更を伝播
        chrome.tabs.query({ url: '*://*.udemy.com/*' }, (tabs) => {
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              type: MESSAGE_TYPES.SETTINGS_CHANGED,
              settings: newSettings,
            }).catch(() => {
              // タブにContent Scriptがない場合は無視
            });
          }
        });
      });

      // 非同期処理のためtrueを返す
      return true;
    }
  });
}

// テスト互換性のためのmodule.exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSettings,
    saveSettings,
    triggerTranslation,
    triggerFallbackTranslation,
  };
}
