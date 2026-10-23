"use strict";

const STORAGE_KEY = "sitr.protection.v1";
const RULE_ID_START = 1000;
const RULE_ID_END = 1099;
const MAX_DOMAINS = RULE_ID_END - RULE_ID_START + 1;
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

function makeRules(domains) {
  return domains.map((domain, index) => ({
    id: RULE_ID_START + index,
    priority: 1,
    action: { type: "block" },
    condition: {
      requestDomains: [domain],
      resourceTypes: ["main_frame"]
    }
  }));
}

async function applyConfiguration(configuration) {
  if (!configuration || typeof configuration.enabled !== "boolean") {
    throw new Error("إعداد الحماية غير صالح.");
  }

  const domains = normalizeDomains(configuration.domains);
  const enabled = configuration.enabled && domains.length > 0;
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ownedRuleIds = currentRules
    .filter((rule) => rule.id >= RULE_ID_START && rule.id <= RULE_ID_END)
    .map((rule) => rule.id);
  const newRules = enabled ? makeRules(domains) : [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ownedRuleIds,
    addRules: newRules
  });

  const savedConfiguration = { enabled, domains };
  await chrome.storage.local.set({ [STORAGE_KEY]: savedConfiguration });
  return savedConfiguration;
}

async function restoreConfiguration() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const configuration = stored[STORAGE_KEY] || { enabled: false, domains: [] };
  const domains = normalizeDomains(configuration.domains);
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ownedRuleIds = currentRules
    .filter((rule) => rule.id >= RULE_ID_START && rule.id <= RULE_ID_END)
    .map((rule) => rule.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ownedRuleIds,
    addRules: configuration.enabled ? makeRules(domains) : []
  });
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
