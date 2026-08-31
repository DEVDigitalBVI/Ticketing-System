/**
 * Progressive enhancements for the standalone Peter Island design.
 *
 * Supported hooks:
 * - `[data-current-year]` receives the current year.
 * - `[data-design-nav] a[href]` receives `aria-current="page"` when active.
 * - `[data-disclosure-button][aria-controls]` controls a matching disclosure.
 * - `<html>` receives `data-js` and `data-motion` state for CSS enhancements.
 *
 * The production Next.js application does not depend on this file.
 */

(() => {
  "use strict";

  const root = document.documentElement;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  root.dataset.js = "enabled";

  function syncMotionPreference(event) {
    root.dataset.motion = event.matches ? "reduced" : "full";
  }

  function setCurrentYear() {
    const year = String(new Date().getFullYear());

    document.querySelectorAll("[data-current-year]").forEach((element) => {
      element.textContent = year;
    });
  }

  function markCurrentNavigationItem() {
    const currentPath = normalizePath(window.location.pathname);

    document.querySelectorAll("[data-design-nav] a[href]").forEach((link) => {
      const destination = new URL(link.href, window.location.href);
      const isCurrent =
        destination.origin === window.location.origin &&
        normalizePath(destination.pathname) === currentPath;

      if (isCurrent) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function normalizePath(pathname) {
    const normalized = pathname.replace(/\/+$/, "");
    return normalized || "/";
  }

  function initializeDisclosures() {
    document.querySelectorAll("[data-disclosure-button][aria-controls]").forEach((button) => {
      const targetId = button.getAttribute("aria-controls");
      const target = targetId ? document.getElementById(targetId) : null;

      if (!target) {
        return;
      }

      const syncDisclosure = (expanded) => {
        button.setAttribute("aria-expanded", String(expanded));
        target.hidden = !expanded;
      };

      syncDisclosure(button.getAttribute("aria-expanded") === "true");

      button.addEventListener("click", () => {
        syncDisclosure(button.getAttribute("aria-expanded") !== "true");
      });
    });
  }

  syncMotionPreference(reducedMotionQuery);
  reducedMotionQuery.addEventListener("change", syncMotionPreference);
  setCurrentYear();
  markCurrentNavigationItem();
  initializeDisclosures();
})();
