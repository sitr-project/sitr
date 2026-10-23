"use strict";

const STORAGE_KEY = "sitr.protection.v1";
const SCRIPT_ID = "sitr-media-blur";
const MAX_DOMAINS = 100;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

function normalizeDomains(domains) {
  if (!Array.isArray(domains)) {
    throw new Error("قائمة المواقع غير صالحة.");
  }

  const normalized = [...new Set(domains.map((domain) => {
    if (typeof domain !== "string") {
      throw new Error("أحد أسماء النطاقات غير صالح.");
    }
    const value = domain.trim().toLowerCase().replace(/\.$/, "");
    if (!DOMAIN_PATTERN.test(value)) {
      throw new Error(`اسم النطاق غير صالح: ${domain}`);
    }
    return value;
  }))];

  if (normalized.length > MAX_DOMAINS) {
    throw new Error(`الحد الأقصى ${MAX_DOMAINS} نطاقًا.`);
  }
  return normalized;
}

function normalizeBlurStrength(value) {
  const strength = Number(value);
  if (!Number.isFinite(strength) || strength < 1 || strength > 24) {
    throw new Error("درجة التغبيش يجب أن تكون بين 1 و24.");
  }
  return Math.round(strength);
}

function getOriginPatterns(domains) {
  return domains.map((domain) => `*://*.${domain}/*`);
}

async function removeRegisteredScripts() {
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (registered.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  }
}

async function registerBlurScript(domains) {
  await removeRegisteredScripts();
  if (domains.length === 0) return;

  await chrome.scripting.registerContentScripts([{
    id: SCRIPT_ID,
    matches: getOriginPatterns(domains),
    js: ["content-script.js"],
    allFrames: true,
    runAt: "document_start",
    persistAcrossSessions: true
  }]);
}

async function updateOpenTabs(configuration, domainsToUpdate) {
  const tabs = await chrome.tabs.query({});
  const failures = [];

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    let host;
    try {
      host = new URL(tab.url).hostname.toLowerCase();
    } catch {
      continue;
    }
    const needsUpdate = domainsToUpdate.some((domain) => host === domain || host.endsWith(`.${domain}`));
    if (!needsUpdate) continue;
    const shouldBlur = configuration.enabled
      && configuration.domains.some((domain) => host === domain || host.endsWith(`.${domain}`));

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: (enabled, blurStrength) => {
          const styleId = "sitr-local-media-blur";
          document.getElementById(styleId)?.remove();
          if (!enabled) return;
          const style = document.createElement("style");
          style.id = styleId;
          style.textContent = `img,video,canvas,svg image{filter:blur(${blurStrength}px)!important}`;
          (document.head || document.documentElement).append(style);
        },
        args: [shouldBlur, configuration.blurStrength]
      });
    } catch (error) {
      failures.push({ tabId: tab.id, error });
    }
  }

  if (failures.length) {
    console.warn("تعذر تحديث بعض التبويبات المفتوحة؛ أعد تحميلها يدويًا.", failures);
    throw new Error(`حُفظت الإعدادات، لكن تعذر تحديث ${failures.length} تبويب مفتوح. أعد تحميل الموقع لتطبيق التغيير.`);
  }
}

async function applyConfiguration(configuration) {
  if (!configuration || typeof configuration.enabled !== "boolean") {
    throw new Error("إعداد الحماية غير صالح.");
  }
  if (configuration.blurMode !== "all-media") {
    throw new Error("تغبيش الأشخاص فقط غير متاح بعد؛ اختر كل الصور والفيديوهات.");
  }

  const domains = normalizeDomains(configuration.domains);
  const blurStrength = normalizeBlurStrength(configuration.blurStrength);
  const enabled = configuration.enabled && domains.length > 0;
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const previousDomains = Array.isArray(stored[STORAGE_KEY]?.domains)
    ? stored[STORAGE_KEY].domains
    : [];
  const domainsToUpdate = [...new Set([...previousDomains, ...domains])];
  const origins = getOriginPatterns(domains);

  if (enabled && !await chrome.permissions.contains({ origins })) {
    throw new Error("لم تُمنح صلاحية الوصول للمواقع المختارة. احفظ الاختيارات ووافق على نافذة الصلاحيات.");
  }

  if (enabled) {
    await registerBlurScript(domains);
  } else {
    await removeRegisteredScripts();
  }

  const savedConfiguration = { enabled, domains, blurMode: "all-media", blurStrength };
  await chrome.storage.local.set({ [STORAGE_KEY]: savedConfiguration });
  await updateOpenTabs(savedConfiguration, domainsToUpdate);
  return savedConfiguration;
}

async function restoreConfiguration() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const storedConfiguration = stored[STORAGE_KEY];
  if (!storedConfiguration || !storedConfiguration.enabled) {
    await removeRegisteredScripts();
    return;
  }

  const domains = normalizeDomains(storedConfiguration.domains);
  const origins = getOriginPatterns(domains);
  if (!await chrome.permissions.contains({ origins })) {
    await removeRegisteredScripts();
    await chrome.storage.local.set({
      [STORAGE_KEY]: { ...storedConfiguration, enabled: false }
    });
    return;
  }
  const configuration = {
    enabled: true,
    domains,
    blurMode: "all-media",
    blurStrength: Number.isFinite(Number(storedConfiguration.blurStrength))
      ? normalizeBlurStrength(storedConfiguration.blurStrength)
      : 12
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: configuration });
  await registerBlurScript(domains);
  await updateOpenTabs(configuration, domains);
}

chrome.runtime.onInstalled.addListener(() => {
  restoreConfiguration().catch((error) => {
    console.error("تعذرت استعادة إعدادات ستر بعد التثبيت.", error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  restoreConfiguration().catch((error) => {
    console.error("تعذرت استعادة إعدادات ستر عند بدء المتصفح.", error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "sitr:apply-configuration") {
    return false;
  }

  applyConfiguration(message.configuration)
    .then((configuration) => sendResponse({ ok: true, configuration }))
    .catch((error) => {
      console.error("تعذر تطبيق إعدادات ستر.", error);
      sendResponse({ ok: false, error: error.message });
    });
  return true;
});
