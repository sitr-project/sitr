(() => {
  "use strict";

  const installButton = document.querySelector("#install-pwa-button");
  const installDialog = document.querySelector("#install-dialog");
  let deferredPrompt = null;

  if (!installButton || !installDialog) return;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("تعذر تسجيل وضع العمل دون اتصال.", error);
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.textContent = "ثبّت واجهة ستر على جهازك ";
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "↧";
    installButton.append(icon);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installButton.textContent = "تم تثبيت واجهة ستر";
    installButton.disabled = true;
  });

  installButton.addEventListener("click", async () => {
    if (!deferredPrompt) {
      installDialog.showModal();
      return;
    }

    const prompt = deferredPrompt;
    deferredPrompt = null;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome !== "accepted") {
        installButton.textContent = "جرّب التثبيت من قائمة المتصفح";
        return;
      }
      installButton.textContent = "جارٍ تثبيت واجهة ستر…";
    } catch (error) {
      console.error("تعذر بدء تثبيت واجهة ستر.", error);
      document.querySelector("#install-note").textContent = "تعذر بدء التثبيت تلقائيًا؛ استخدم تعليمات التثبيت اليدوي.";
      installDialog.showModal();
    }
  });
})();
