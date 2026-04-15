/**
 * app.js — Social Media Analytics Project Hub
 * ─────────────────────────────────────────────
 * Responsibilities:
 *  1. Detect whether the current page is in the root or a subfolder.
 *  2. Fetch and inject navbar.html into #nav-placeholder.
 *  3. Rewrite all data-path links inside the navbar to correct relative URLs.
 *  4. Wire up the dropdown toggle interaction.
 */

(function () {
  "use strict";

  /* ── 1. Path Detection ────────────────────────────────────────
   *
   * Strategy: compare the page's pathname depth to the repo root.
   *
   * GitHub Pages serves files at:
   *   Root page  →  /repo-name/index.html          (1 segment after host)
   *   Subfolder  →  /repo-name/MILESTONE 1/index.html  (2 segments)
   *
   * We detect depth by counting pathname segments, then decide whether
   * navbar.html lives at "./navbar.html" (root) or "../navbar.html" (subfolder).
   *
   * Works identically on localhost (file:// or http://localhost).
   * ─────────────────────────────────────────────────────────────*/

  /**
   * Returns the relative prefix needed to reach the project root from the
   * current page.
   *
   * Root page    → ""   (files are siblings of the current page)
   * One level in → "../"
   *
   * @returns {string}
   */
  function getRootPrefix() {
    const pathname = window.location.pathname;

    // Normalise: strip leading slash, split into non-empty parts.
    const parts = pathname
      .replace(/^\//, "")
      .split("/")
      .filter(Boolean);

    /*
     * parts for common cases:
     *
     *  /index.html                    → ["index.html"]        depth = 1
     *  /repo/index.html               → ["repo","index.html"] depth = 2
     *  /repo/MILESTONE 1/index.html   → ["repo","MILESTONE 1","index.html"] depth = 3
     *
     * The last part is always a filename (contains ".") or is empty ("/" URL).
     * Depth of DIRECTORIES = parts.length - 1  (subtract the filename part).
     *
     * For GitHub Pages the repo name is always the first directory segment,
     * so pages at the repo root have directory-depth = 1 (just the repo name)
     * and subfolder pages have directory-depth ≥ 2.
     *
     * For a plain localhost/file:// setup without a repo-name prefix,
     * a root page has directory-depth = 0 and subfolders have depth ≥ 1.
     *
     * We unify both cases: if the LAST directory segment looks like one of our
     * known subfolders, we are one level deep and need "../".
     * Otherwise we are at the root and need "./".
     */
    const knownSubfolders = [
      "milestone 1",
      "milestone 2",
      "milestone 3",
      "final submission",
    ];

    // The parent directory of the current file.
    const parentDir = parts.length >= 2
      ? parts[parts.length - 2].toLowerCase()
      : "";

    const isInSubfolder = knownSubfolders.includes(parentDir);

    return isInSubfolder ? "../" : "./";
  }

  /* ── 2. Fetch & Inject Navbar ────────────────────────────────*/

  async function injectNavbar() {
    const placeholder = document.getElementById("nav-placeholder");
    if (!placeholder) {
      console.warn("[app.js] #nav-placeholder not found. Skipping navbar injection.");
      return;
    }

    const rootPrefix = getRootPrefix();
    const navbarURL  = rootPrefix + "navbar.html";

    let html;
    try {
      const response = await fetch(navbarURL);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${navbarURL}`);
      }
      html = await response.text();
    } catch (err) {
      console.error("[app.js] Could not load navbar:", err);
      return;
    }

    // Parse the fetched HTML so we can rewrite paths before inserting.
    const parser = new DOMParser();
    const doc    = parser.parseFromString(html, "text/html");

    /* ── 3. Rewrite data-path → href ──────────────────────────
     *
     * navbar.html stores destination paths as data-path attributes so they
     * are path-agnostic.  We convert each one to a proper relative href here.
     * ──────────────────────────────────────────────────────────*/
    doc.querySelectorAll("[data-path]").forEach((anchor) => {
      const rawPath = anchor.getAttribute("data-path");
      anchor.setAttribute("href", rootPrefix + rawPath);
      anchor.removeAttribute("data-path");
    });

    // Insert the rewritten navbar HTML.
    placeholder.innerHTML = doc.body.innerHTML;

    /* ── 4. Dropdown Interaction ──────────────────────────────*/
    initDropdown();
  }

  /* ── Dropdown Toggle Logic ───────────────────────────────────*/

  function initDropdown() {
    // Query inside #nav-placeholder because the navbar was just injected.
    const placeholder = document.getElementById("nav-placeholder");
    const dropdown    = placeholder && placeholder.querySelector(".dropdown");
    const toggle      = dropdown && dropdown.querySelector(".dropdown-toggle");

    if (!dropdown || !toggle) return;

    // Open / close on button click.
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    // Close when clicking anywhere outside.
    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) {
        closeDropdown(dropdown, toggle);
      }
    });

    // Close on Escape key.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeDropdown(dropdown, toggle);
        toggle.focus(); // return focus for accessibility
      }
    });

    // Allow keyboard navigation inside the menu (arrow keys).
    const menu = dropdown.querySelector(".dropdown-menu");
    if (menu) {
      menu.addEventListener("keydown", (e) => {
        const items = [...menu.querySelectorAll(".dropdown-item")];
        const idx   = items.indexOf(document.activeElement);

        if (e.key === "ArrowDown") {
          e.preventDefault();
          items[(idx + 1) % items.length].focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          items[(idx - 1 + items.length) % items.length].focus();
        }
      });
    }
  }

  function closeDropdown(dropdown, toggle) {
    dropdown.classList.remove("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  /* ── Boot ────────────────────────────────────────────────────*/

  // Run after the DOM is ready.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectNavbar);
  } else {
    injectNavbar();
  }
})();