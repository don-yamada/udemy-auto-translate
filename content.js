/**
 * Udemy Auto Translate - Content Script
 *
 * Udemyページに注入され、Quiz Containerの変更を監視し、
 * 2モード（原文・翻訳）でテキストを切り替える。
 */

/* global DEFAULT_SETTINGS, TRANSLATE_MODES, MESSAGE_TYPES, LOG_PREFIX, chrome */

function debounce(fn, delay) {
  let timerId = null;
  return function (...args) {
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => { timerId = null; fn.apply(this, args); }, delay);
  };
}

function isSignificantChange(mutations) {
  for (const mutation of mutations) {
    if (mutation.type === 'characterData') return true;
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 3 || node.nodeType === 1) return true;
      }
    }
    if (mutation.type === 'attributes') {
      if (mutation.attributeName !== 'style' && mutation.attributeName !== 'class') return true;
    }
  }
  return false;
}

/** Google Translate（無料） */
async function translateText(text, targetLang) {
  if (!text || !text.trim()) return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data && data[0]) return data[0].map(item => item[0]).join('');
    return text;
  } catch (err) {
    console.error(LOG_PREFIX, 'ERROR: Translation failed -', err);
    return text;
  }
}

function getTextNodes(element) {
  const nodes = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let node;
  while ((node = walker.nextNode())) nodes.push(node);
  return nodes;
}

/** コンテナ内のテキストを翻訳する */
async function translateContainer(container, targetLang) {
  const textNodes = getTextNodes(container);
  for (const node of textNodes) {
    const parent = node.parentElement;
    if (!parent) continue;
    const currentText = node.textContent.trim();
    if (!currentText || currentText.length < 2) continue;
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(currentText)) continue;
    if (parent.dataset.uatTranslated === 'true' && parent.dataset.uatOriginal === currentText) continue;

    const translated = await translateText(currentText, targetLang);
    if (translated && translated !== currentText) {
      parent.dataset.uatOriginal = currentText;
      node.textContent = translated;
      parent.dataset.uatTranslated = 'true';
      parent.title = currentText;
    }
  }
}

/** コンテナ内のテキストを原文に戻す */
function restoreOriginal(container) {
  const translated = container.querySelectorAll('[data-uat-translated="true"]');
  for (const el of translated) {
    const original = el.dataset.uatOriginal;
    if (original) {
      // テキストノードを探して原文に戻す
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.trim()) {
          node.textContent = original;
          break;
        }
      }
      el.removeAttribute('data-uat-translated');
      el.removeAttribute('data-uat-original');
      el.removeAttribute('title');
    }
  }
}

const QUIZ_SELECTORS = [
  '[data-purpose="curriculum-item-viewer-content"]',
  '[data-purpose="questions-list"]',
  '[data-purpose="quiz-container"]',
  '.practice-test-container',
];

function findQuizContainer() {
  for (const selector of QUIZ_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

let debouncedTranslate;

function handleMutations(mutations) {
  if (isSignificantChange(mutations)) debouncedTranslate();
}

function initObserver() {
  const container = findQuizContainer();
  if (container) {
    const observer = new MutationObserver(handleMutations);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    console.log(LOG_PREFIX, 'Quiz Container found, MutationObserver started.');
    debouncedTranslate();
    return;
  }
  console.warn(LOG_PREFIX, 'WARN: Quiz Container not found. Retrying every 2s...');
  const retryInterval = setInterval(() => {
    const c = findQuizContainer();
    if (c) {
      clearInterval(retryInterval);
      const observer = new MutationObserver(handleMutations);
      observer.observe(c, { childList: true, subtree: true, characterData: true });
      console.log(LOG_PREFIX, 'Quiz Container found on retry, MutationObserver started.');
      debouncedTranslate();
    }
  }, 2000);
}

// ブラウザコンテキストでのみ初期化
if (typeof chrome !== 'undefined' && chrome.runtime) {
  let settings = Object.assign({}, DEFAULT_SETTINGS);

  debouncedTranslate = debounce(() => {
    const container = findQuizContainer();
    if (!container) return;
    if (settings.translateMode === TRANSLATE_MODES.ORIGINAL) {
      restoreOriginal(container);
    } else {
      console.log(LOG_PREFIX, 'Translating container...');
      translateContainer(container, settings.targetLang);
    }
  }, 500);

  /** ページ内に翻訳切り替えボタンを注入する */
  function injectToggleButton() {
    // 既に注入済みならスキップ
    if (document.getElementById('uat-toggle-btn')) return;

    const footerRight = document.querySelector('.curriculum-item-footer--right--M9ikS');
    if (!footerRight) return;

    const btn = document.createElement('button');
    btn.id = 'uat-toggle-btn';
    btn.type = 'button';
    btn.className = 'ud-btn ud-btn-small ud-btn-ghost ud-btn-text-sm';
    btn.style.cssText = 'margin-right: 8px; font-weight: 600; color: #5624d0; border: 1px solid #5624d0; border-radius: 4px; padding: 4px 10px;';
    btn.textContent = settings.translateMode === TRANSLATE_MODES.ORIGINAL ? '翻訳ON' : '原文に戻す';

    btn.addEventListener('click', () => {
      if (settings.translateMode === TRANSLATE_MODES.ORIGINAL) {
        settings.translateMode = TRANSLATE_MODES.STANDARD;
        btn.textContent = '原文に戻す';
      } else {
        settings.translateMode = TRANSLATE_MODES.ORIGINAL;
        btn.textContent = '翻訳ON';
      }
      // 設定を保存して反映
      chrome.storage.local.set({ translateMode: settings.translateMode });
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SETTINGS_UPDATE, settings });
      debouncedTranslate();
    });

    footerRight.insertBefore(btn, footerRight.firstChild);
    console.log(LOG_PREFIX, 'Toggle button injected.');
  }

  /** ボタン注入をリトライ付きで実行 */
  function tryInjectButton() {
    if (document.getElementById('uat-toggle-btn')) return;
    injectToggleButton();
    if (!document.getElementById('uat-toggle-btn')) {
      const interval = setInterval(() => {
        injectToggleButton();
        if (document.getElementById('uat-toggle-btn')) clearInterval(interval);
      }, 2000);
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.type === MESSAGE_TYPES.SETTINGS_CHANGED) {
      if (message.settings) {
        const oldMode = settings.translateMode;
        settings = Object.assign({}, settings, message.settings);
        console.log(LOG_PREFIX, 'Settings updated:', settings);
        // モードが変わったら即座に反映
        if (oldMode !== settings.translateMode) {
          debouncedTranslate();
          // ボタンのテキストも更新
          const btn = document.getElementById('uat-toggle-btn');
          if (btn) btn.textContent = settings.translateMode === TRANSLATE_MODES.ORIGINAL ? '翻訳ON' : '原文に戻す';
        }
      }
    }
  });

  initObserver();
  tryInjectButton();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    debounce, isSignificantChange, translateText, getTextNodes,
    translateContainer, restoreOriginal, QUIZ_SELECTORS, findQuizContainer,
    handleMutations, initObserver,
  };
}
