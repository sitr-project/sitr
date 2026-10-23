(() => {
  "use strict";

  const preferencesKey = "sitr.preferences.v1";
  const reportsKey = "sitr.local-reports.v1";
  const form = document.querySelector("#preferences-form");
  const saveStatus = document.querySelector("#save-status");
  const reportForm = document.querySelector("#report-form");
  const reportStatus = document.querySelector("#report-status");

  function readStoredValue(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.warn(`Could not read ${key} from local storage.`, error);
      return fallback;
    }
  }

  function writeStoredValue(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Could not save ${key} to local storage.`, error);
      return false;
    }
  }

  function applyPreferences(preferences) {
    if (!preferences || typeof preferences !== "object") return;
    form.querySelectorAll('input[name="content"]').forEach((input) => {
      input.checked = Array.isArray(preferences.content) && preferences.content.includes(input.value);
    });
    form.querySelectorAll('input[name="platform"]').forEach((input) => {
      input.checked = Array.isArray(preferences.platforms) && preferences.platforms.includes(input.value);
    });
    const selectedLevel = form.querySelector(`input[name="level"][value="${CSS.escape(preferences.level || "")}"]`);
    if (selectedLevel) selectedLevel.checked = true;
  }

  function collectPreferences() {
    return {
      content: [...form.querySelectorAll('input[name="content"]:checked')].map((input) => input.value),
      platforms: [...form.querySelectorAll('input[name="platform"]:checked')].map((input) => input.value),
      level: form.querySelector('input[name="level"]:checked')?.value || "medium"
    };
  }

  applyPreferences(readStoredValue(preferencesKey, null));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const saved = writeStoredValue(preferencesKey, collectPreferences());
    saveStatus.textContent = saved ? "تم الحفظ على جهازك" : "تعذّر الحفظ — تحقق من إعدادات المتصفح";
    saveStatus.classList.toggle("save-error", !saved);
  });

  reportForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const category = document.querySelector("#report-category").value;
    if (!category) return;
    const reports = readStoredValue(reportsKey, []);
    reports.push({
      category,
      note: document.querySelector("#report-note").value.trim(),
      createdAt: new Date().toISOString()
    });
    if (writeStoredValue(reportsKey, reports)) {
      reportForm.reset();
      reportStatus.textContent = "حُفظت الملاحظة محليًا في هذا المتصفح فقط؛ لم يتم إرسالها.";
    } else {
      reportStatus.textContent = "تعذّر حفظ الملاحظة. تحقق من إعدادات التخزين في المتصفح.";
    }
  });

  const menuToggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector("#main-nav");
  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    navigation.classList.toggle("nav-open", !expanded);
  });
  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    menuToggle.setAttribute("aria-expanded", "false");
    navigation.classList.remove("nav-open");
  }));

  document.querySelector("#year").textContent = new Date().getFullYear();
})();
