"use strict";

(() => {
  const STORAGE_KEY = "sitr.protection.v1";
  const STYLE_ID = "sitr-local-media-blur";
  const host = window.location.hostname.toLowerCase();

  function matchesDomain(domains) {
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  function applyBlur(blurStrength) {
    const currentStyle = document.getElementById(STYLE_ID);
    if (currentStyle) currentStyle.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      img, video, canvas, svg image {
        filter: blur(${blurStrength}px) !important;
      }
    `;
    (document.head || document.documentElement).append(style);
  }

  chrome.storage.local.get(STORAGE_KEY)
    .then((stored) => {
      const configuration = stored[STORAGE_KEY];
      if (!configuration || !configuration.enabled || !matchesDomain(configuration.domains)) return;
      if (configuration.blurMode !== "all-media") return;

      const strength = Number(configuration.blurStrength);
      if (!Number.isFinite(strength) || strength < 1 || strength > 24) return;
      applyBlur(Math.round(strength));
    })
    .catch((error) => console.error("تعذر تطبيق تغبيش ستر المحلي.", error));
})();
