(() => {
  "use strict";

  const menuToggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector("#main-nav");
  if (menuToggle && navigation) {
    menuToggle.addEventListener("click", () => {
      const expanded = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!expanded));
      navigation.classList.toggle("nav-open", !expanded);
    });
    navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      menuToggle.setAttribute("aria-expanded", "false");
      navigation.classList.remove("nav-open");
    }));
  }

  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
