(function () {
  'use strict';

  var STORAGE_KEY = 'adin_lang';
  var SUPPORTED_LANGS = ['tr', 'en', 'ru', 'de'];

  function detectLanguage() {
    // 1. Cookie (user preference)
    var cookie = document.cookie.split('; ').find(function (r) { return r.startsWith(STORAGE_KEY + '='); });
    if (cookie) {
      var lang = cookie.split('=')[1];
      if (SUPPORTED_LANGS.indexOf(lang) !== -1) return lang;
    }
    // 2. Browser language (IP proxy)
    var browserLang = (navigator.language || navigator.userLanguage || '').substring(0, 2).toLowerCase();
    if (SUPPORTED_LANGS.indexOf(browserLang) !== -1) return browserLang;
    // 3. Default to English (international audience)
    return 'en';
  }

  var currentLang = detectLanguage();

  function getLangDir() {
    var scripts = document.querySelectorAll('script[src*="i18n.js"]');
    if (scripts.length > 0) {
      var src = scripts[0].src;
      return src.substring(0, src.lastIndexOf('/assets/js/i18n.js')) + '/lang/';
    }
    return '/adinbeach/lang/';
  }

  var langDir = getLangDir();
  var translations = null;
  var trTranslations = null;

  // Load JSON helper
  function loadJSON(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try { callback(null, JSON.parse(xhr.responseText)); }
        catch (e) { callback(e); }
      } else {
        callback(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = function () { callback(new Error('Network error')); };
    xhr.send();
  }

  function loadTranslations(callback) {
    var loaded = 0;
    function check() { loaded++; if (loaded === 2) callback(); }

    loadJSON(langDir + currentLang + '.json', function (err, data) {
      if (err) {
        console.warn('[i18n] Failed to load ' + currentLang + '.json');
        if (currentLang !== 'tr') {
          currentLang = 'tr';
          loadTranslations(callback);
          return;
        }
        check();
        return;
      }
      translations = data;
      check();
    });

    loadJSON(langDir + 'tr.json', function (err, data) {
      if (!err) trTranslations = data;
      check();
    });
  }

  window.setLanguage = function (lang) {
    if (SUPPORTED_LANGS.indexOf(lang) === -1) return;
    document.cookie = STORAGE_KEY + '=' + lang + '; path=/; max-age=31536000; SameSite=Lax';
    window.location.reload();
  };

  function normalizeText(t) {
    // Decode HTML entities: &amp; → &, &#39; → ', &rarr; → →, etc.
    var el = document.createElement('textarea');
    el.innerHTML = t;
    var result = el.textContent;
    // Normalize typographic (curly) quotes to straight quotes
    result = result.replace(/\u2018|\u2019|\u201b/g, "'");  // ', ', ' → '
    result = result.replace(/\u201c|\u201d|\u201e/g, '"');   // ", ", „ → "
    result = result.replace(/\u2026/g, '...');               // … → ...
    return result;
  }

  function getNestedValue(obj, key) {
    if (!obj) return null;
    var parts = key.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (typeof obj === 'object' && parts[i] in obj) {
        obj = obj[parts[i]];
      } else {
        return null;
      }
    }
    return typeof obj === 'string' ? obj : null;
  }

  function buildTextMap() {
    if (!translations) return {};
    var map = {};

    // Strategy 1: Flat key-value pairs in ALL sections where key = Turkish text
    Object.keys(translations).forEach(function (section) {
      var obj = translations[section];
      if (typeof obj === 'object' && !Array.isArray(obj)) {
        Object.keys(obj).forEach(function (k) {
          if (typeof obj[k] === 'string') {
            map[k] = obj[k];
          }
        });
      }
    });

    // Strategy 2: Cross-reference tr.json
    if (trTranslations) {
      function walkValues(langObj, trObj) {
        for (var key in langObj) {
          if (typeof langObj[key] === 'string' && trObj && typeof trObj[key] === 'string') {
            map[trObj[key]] = langObj[key];
          } else if (Array.isArray(langObj[key]) && trObj && Array.isArray(trObj[key])) {
            for (var i = 0; i < langObj[key].length; i++) {
              if (typeof langObj[key][i] === 'string' && trObj[key][i] && typeof trObj[key][i] === 'string') {
                map[trObj[key][i]] = langObj[key][i];
              } else if (typeof langObj[key][i] === 'object' && trObj[key][i] && typeof trObj[key][i] === 'object') {
                walkValues(langObj[key][i], trObj[key][i]);
              }
            }
          } else if (typeof langObj[key] === 'object' && !Array.isArray(langObj[key]) && trObj && typeof trObj[key] === 'object') {
            walkValues(langObj[key], trObj[key]);
          }
        }
      }
      walkValues(translations, trTranslations);
    }

    // Add normalized versions of all keys (handle &amp; &#39; &rarr; etc.)
    var allKeys = Object.keys(map);
    allKeys.forEach(function (k) {
      var nk = normalizeText(k);
      if (nk !== k && !map[nk]) {
        map[nk] = map[k];
      }
    });

    return map;
  }

  function translateNode(root, textMap) {
    if (!textMap) textMap = buildTextMap();

    // --- Apply text replacements via TreeWalker ---
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var node;
    var textReplacements = [];
    while ((node = walker.nextNode())) {
      var text = node.nodeValue.trim();
      if (!text || text.length < 2) continue;
      var parent = node.parentElement;
      if (!parent) continue;
      var tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;

      // Normalize HTML entities before lookup
      var normalized = normalizeText(text);
      if (normalized !== text && textMap[normalized]) {
        textReplacements.push({ node: node, newText: textMap[normalized] });
        continue;
      }
      if (textMap[text]) {
        textReplacements.push({ node: node, newText: textMap[text] });
      }
    }
    textReplacements.forEach(function (r) { r.node.nodeValue = r.newText; });

    // Handle split-text headings
    root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(function (heading) {
      var fullText = heading.textContent.trim();
      if (textMap[fullText]) {
        var goldSpan = heading.querySelector('.gold-word');
        var darkSpan = heading.querySelector('.dark-word');
        if (goldSpan && darkSpan) {
          var trans = textMap[fullText];
          var firstSpace = trans.indexOf(' ');
          if (firstSpace > 0) {
            goldSpan.textContent = trans.substring(0, firstSpace);
            darkSpan.textContent = trans.substring(firstSpace + 1);
          } else {
            goldSpan.textContent = trans;
            darkSpan.textContent = '';
          }
        }
      }
    });

    // Translate placeholder attributes
    root.querySelectorAll('[placeholder]').forEach(function (el) {
      var ph = el.getAttribute('placeholder').trim();
      if (textMap[ph]) el.setAttribute('placeholder', textMap[ph]);
    });

    // data-i18n attribute lookups
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      var val = getNestedValue(translations, el.getAttribute('data-i18n'));
      if (val) el.textContent = val;
    });
  }

  function applyTranslations() {
    if (!translations) return;
    var textMap = buildTextMap();

    // --- Language selector: mark current + make all clickable ---
    document.querySelectorAll('[data-lang-item]').forEach(function (el) {
      var lang = (el.getAttribute('data-lang') || '').toLowerCase();
      el.style.cursor = 'pointer';
      if (lang === currentLang) {
        el.className = 'text-gold';
      }
      el.addEventListener('click', function (e) {
        e.preventDefault();
        window.setLanguage(lang);
      });
    });

    // Translate the entire body
    translateNode(document.body, textMap);

    // Breadcrumb
    document.querySelectorAll('a[href="/adinbeach/"], nav[aria-label="breadcrumb"] a, nav[aria-label="Breadcrumb"] a').forEach(function (el) {
      if (el.textContent.trim() === 'Anasayfa' && textMap['Anasayfa']) {
        el.textContent = textMap['Anasayfa'];
      }
    });

    // Meta
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      var siteDesc = getNestedValue(translations, 'site.description');
      if (siteDesc) metaDesc.setAttribute('content', siteDesc);
    }

    document.documentElement.setAttribute('lang', currentLang === 'tr' ? 'tr' : currentLang);
  }

  // --- MutationObserver: re-translate when Vue adds content ---
  var translateTimer = null;
  function scheduleTranslate() {
    if (translateTimer) clearTimeout(translateTimer);
    translateTimer = setTimeout(function () {
      var textMap = buildTextMap();
      translateNode(document.body, textMap);
      translateTimer = null;
    }, 100);
  }

  // Initial translation after JSON loads
  loadTranslations(function () {
    applyTranslations();
    // Watch for DOM changes (Vue dynamic rendering)
    var observer = new MutationObserver(function () { scheduleTranslate(); });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  });
})();
