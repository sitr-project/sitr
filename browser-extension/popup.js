"use strict";

(() => {
  const STORAGE_KEY = "sitr.protection.v1";
  const PRESETS = {
    "tiktok.com": ["tiktok.com"],
    "youtube.com": ["youtube.com", "youtube-nocookie.com", "youtu.be"],
    "instagram.com": ["instagram.com"],
    "x.com": ["x.com", "twitter.com"]
  };
  const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  const status = document.querySelector("#status");
  const customDomains = document.querySelector("#custom-domains");
  const domainInput = document.querySelector("#domain-input");
  const saveButton = document.querySelector("#save-button");
  const protectionButton = document.querySelector("#protection-button");
  let currentConfiguration = { enabled: false, domains: [] };

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
    document.querySelectorAll('input[name="custom-domain"]:checked').forEach((input) => {
      domains.add(input.value);
    });
    return [...domains];
  }

  function updateProtectionButton() {
    protectionButton.disabled = !currentConfiguration.enabled && selectedDomains().length === 0;
    protectionButton.textContent = currentConfiguration.enabled ? "إيقاف الحماية مؤقتًا" : "تشغيل الحماية";
    protectionButton.classList.toggle("stop", currentConfiguration.enabled);
  }

  function renderConfiguration(configuration) {
    currentConfiguration = configuration;
    document.querySelectorAll('input[name="preset"]').forEach((input) => {
      const expectedDomains = PRESETS[input.value];
      input.checked = expectedDomains.every((domain) => configuration.domains.includes(domain));
    });
    renderCustomDomains(configuration.domains);
    setStatus(configuration.enabled
      ? `الحماية تعمل على ${configuration.domains.length} نطاقًا.`
      : "الحماية متوقفة. اختر المواقع ثم شغّلها.");
    updateProtectionButton();
  }

  async function applyConfiguration(enabled) {
    const response = await chrome.runtime.sendMessage({
      type: "sitr:apply-configuration",
      configuration: { enabled, domains: selectedDomains() }
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
      setStatus(nextEnabled ? "الحماية تعمل الآن على المواقع المختارة." : "تم إيقاف الحماية.");
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      updateProtectionButton();
    }
  });

  chrome.storage.local.get(STORAGE_KEY)
    .then((stored) => renderConfiguration(stored[STORAGE_KEY] || { enabled: false, domains: [] }))
    .catch((error) => setStatus(`تعذر تحميل إعدادات الإضافة: ${error.message}`, true));
})();
