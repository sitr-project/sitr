"use strict";

(() => {
  const STORAGE_KEY = "sitr.protection.v1";
  const PRESETS = {
    "tiktok.com": ["tiktok.com"],
    "youtube.com": ["youtube.com", "youtube-nocookie.com", "youtu.be"],
    "instagram.com": ["instagram.com"],
    "x.com": ["x.com", "twitter.com"],
    "facebook.com": ["facebook.com", "fb.watch"],
    "telegram.org": ["telegram.org"],
    "google.com": ["google.com", "google.sa"],
    "custom-browser": []
  };
  const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  const status = document.querySelector("#status");
  const customDomains = document.querySelector("#custom-domains");
  const domainInput = document.querySelector("#domain-input");
  const saveButton = document.querySelector("#save-button");
  const protectionButton = document.querySelector("#protection-button");
  const blurStrengthInput = document.querySelector("#blur-strength");
  const blurValue = document.querySelector("#blur-value");
  let currentConfiguration = { enabled: false, domains: [], blurMode: "all-media", blurStrength: 12 };

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function getPresetDomains() {
    return Object.values(PRESETS).flat();
  }

  function renderCustomDomains(domains) {
    customDomains.replaceChildren();
    const presetDomains = new Set(getPresetDomains());
    domains.filter((domain) => !presetDomains.has(domain)).forEach((domain) => {
      const row = document.createElement("label");
      row.className = "custom-domain";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "custom-domain";
      checkbox.value = domain;
      checkbox.checked = true;
      const name = document.createElement("span");
      name.textContent = domain;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "حذف";
      remove.setAttribute("aria-label", `حذف ${domain}`);
      remove.addEventListener("click", () => {
        row.remove();
        updateProtectionButton();
      });
      row.append(checkbox, name, remove);
      customDomains.append(row);
    });
  }

  function selectedDomains() {
    const domains = new Set();
    document.querySelectorAll('input[name="preset"]:checked').forEach((input) => {
      PRESETS[input.value].forEach((domain) => domains.add(domain));
    });
    const customSelected = document.querySelector('input[name="preset"][value="custom-browser"]').checked;
    if (customSelected) {
      document.querySelectorAll('input[name="custom-domain"]:checked').forEach((input) => domains.add(input.value));
    }
    return [...domains];
  }

  function updateProtectionButton() {
    protectionButton.disabled = !currentConfiguration.enabled && selectedDomains().length === 0;
    protectionButton.textContent = currentConfiguration.enabled ? "إيقاف الحماية مؤقتًا" : "تشغيل الحماية";
    protectionButton.classList.toggle("stop", currentConfiguration.enabled);
  }

  function renderConfiguration(configuration) {
    currentConfiguration = {
      enabled: configuration.enabled === true,
      domains: Array.isArray(configuration.domains) ? configuration.domains : [],
      blurMode: "all-media",
      blurStrength: Number.isFinite(Number(configuration.blurStrength))
        ? Math.max(1, Math.min(24, Math.round(Number(configuration.blurStrength))))
        : 12
    };
    document.querySelectorAll('input[name="preset"]').forEach((input) => {
      if (input.value === "custom-browser") {
        input.checked = currentConfiguration.domains.some((domain) => !getPresetDomains().includes(domain));
        return;
      }
      const expectedDomains = PRESETS[input.value];
      input.checked = expectedDomains.every((domain) => configuration.domains.includes(domain));
    });
    const customEnabled = document.querySelector('input[name="preset"][value="custom-browser"]').checked;
    domainInput.disabled = !customEnabled;
    document.querySelector("#add-domain").disabled = !customEnabled;
    document.querySelector('input[name="blur-mode"][value="all-media"]').checked = true;
    document.querySelectorAll(".mode-card").forEach((card) => {
      card.classList.toggle("selected", card.querySelector('input[name="blur-mode"]').checked);
    });
    blurStrengthInput.value = String(currentConfiguration.blurStrength);
    blurValue.value = String(currentConfiguration.blurStrength);
    blurValue.textContent = String(currentConfiguration.blurStrength);
    renderCustomDomains(currentConfiguration.domains);
    setStatus(configuration.enabled
      ? `التغبيش يعمل على ${currentConfiguration.domains.length} نطاقًا.`
      : currentConfiguration.domains.length
        ? "الإعدادات محفوظة. شغّل التغبيش عند رغبتك."
        : "اختر المواقع ودرجة التغبيش، ثم احفظ الإعدادات.");
    updateProtectionButton();
  }

  async function requestSitePermissions(domains) {
    if (!domains.length) return;
    const origins = domains.map((domain) => `*://*.${domain}/*`);
    const granted = await chrome.permissions.request({ origins });
    if (!granted) {
      throw new Error("لم تُمنح صلاحية المواقع. وافق على النافذة للمتابعة.");
    }
  }

  async function applyConfiguration(enabled) {
    const domains = selectedDomains();
    const blurStrength = Number(blurStrengthInput.value);
    if (enabled || currentConfiguration.enabled) {
      await requestSitePermissions(domains);
    }
    const response = await chrome.runtime.sendMessage({
      type: "sitr:apply-configuration",
      configuration: {
        enabled,
        domains,
        blurMode: "all-media",
        blurStrength
      }
    });
    if (!response || !response.ok) {
      throw new Error(response?.error || "تعذر تطبيق الإعدادات.");
    }
    renderConfiguration(response.configuration);
    return response.configuration;
  }

  document.querySelectorAll('input[name="preset"]').forEach((input) => {
    input.addEventListener("change", updateProtectionButton);
  });
  customDomains.addEventListener("change", updateProtectionButton);
  document.querySelectorAll('input[name="blur-mode"]').forEach((input) => {
    input.addEventListener("change", () => {
      document.querySelectorAll(".mode-card").forEach((card) => {
        card.classList.toggle("selected", card.querySelector('input[name="blur-mode"]').checked);
      });
    });
  });
  blurStrengthInput.addEventListener("input", () => {
    blurValue.value = blurStrengthInput.value;
    blurValue.textContent = blurStrengthInput.value;
    document.documentElement.style.setProperty("--preview-blur", `${Number(blurStrengthInput.value) / 5}px`);
  });
  document.querySelector('input[name="preset"][value="custom-browser"]').addEventListener("change", () => {
    const enabled = document.querySelector('input[name="preset"][value="custom-browser"]').checked;
    domainInput.disabled = !enabled;
    document.querySelector("#add-domain").disabled = !enabled;
    updateProtectionButton();
  });

  document.querySelector("#add-domain").addEventListener("click", () => {
    const domain = domainInput.value.trim().toLowerCase().replace(/\.$/, "");
    if (!DOMAIN_PATTERN.test(domain)) {
      setStatus("اكتب نطاقًا صحيحًا مثل example.com، دون رابط أو مسار.", true);
      return;
    }
    if (selectedDomains().includes(domain)) {
      setStatus("هذا النطاق موجود ضمن اختيارك بالفعل.", true);
      return;
    }
    if (selectedDomains().length >= 100) {
      setStatus("وصلت إلى الحد الأقصى: 100 نطاق.", true);
      return;
    }
    document.querySelector('input[name="preset"][value="custom-browser"]').checked = true;
    const current = selectedDomains();
    current.push(domain);
    renderCustomDomains(current);
    domainInput.value = "";
    setStatus("أُضيف النطاق إلى الاختيارات. اضغط حفظ المواقع.");
    updateProtectionButton();
  });

  domainInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      document.querySelector("#add-domain").click();
    }
  });

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    try {
      await applyConfiguration(currentConfiguration.enabled);
      setStatus("تم حفظ المواقع المختارة محليًا.");
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      saveButton.disabled = false;
    }
  });

  protectionButton.addEventListener("click", async () => {
    protectionButton.disabled = true;
    try {
      const nextEnabled = !currentConfiguration.enabled;
      await applyConfiguration(nextEnabled);
      setStatus(nextEnabled ? "التغبيش يعمل على المواقع المختارة. حدّث التبويبات المفتوحة." : "تم إيقاف التغبيش.");
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      updateProtectionButton();
    }
  });

  document.querySelector('input[name="preset"][value="custom-browser"]').checked = false;
  domainInput.disabled = true;
  document.querySelector("#add-domain").disabled = true;

  chrome.storage.local.get(STORAGE_KEY)
    .then((stored) => renderConfiguration(stored[STORAGE_KEY] || { enabled: false, domains: [], blurMode: "all-media", blurStrength: 12 }))
    .catch((error) => setStatus(`تعذر تحميل إعدادات الإضافة: ${error.message}`, true));
})();
