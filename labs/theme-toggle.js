/**
 * @file theme-toggle.js
 * @description Dark and Light theme switcher for Codelabs.
 *
 * Provides instant theme switching by toggling the `data-theme` attribute on the root
 * `<html>` element (`data-theme="dark"` or `data-theme="light"`).
 *
 * Key features:
 *   - Injects a toggle button into `#codelab-title` dynamically.
 *   - Synchronizes icon states (`dark_mode` / `light_mode`) via Material Icons.
 *   - Persists user preference in `localStorage` under key `codelab-theme`.
 *   - Pre-applies stored theme immediately on script execution to eliminate FOUC (flash of unstyled content).
 *   - Uses a `MutationObserver` to attach as soon as `#codelab-title` is mounted by `codelab.js`.
 */

(function () {
  'use strict';

  /**
   * Storage key for local storage theme persistence.
   * @type {string}
   */
  var STORAGE_KEY = 'codelab-theme';

  /**
   * Reference to the rendered theme toggle button DOM element.
   * @type {HTMLAnchorElement|null}
   */
  var button = null;

  /**
   * Reads the current theme from the root `<html>` element.
   *
   * @returns {'dark'|'light'} Active theme mode name.
   */
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  /**
   * Applies the theme attribute to the root `<html>` tag and synchronizes
   * the mobile browser <meta name="theme-color"> with the computed `--neo-primary` CSS token.
   *
   * @param {'dark'|'light'} theme - Target theme name.
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Synchronize meta theme-color with the active CSS custom property (--neo-primary)
    try {
      var computedColor = getComputedStyle(document.documentElement).getPropertyValue('--neo-primary').trim();
      if (computedColor) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'theme-color';
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', computedColor);
      }
    } catch (e) {
      // Ignore errors in environments without full style computation at load
    }
  }

  /**
   * Updates button ARIA attributes, tooltip, and inner Material Icon according to active theme.
   */
  function updateButton() {
    if (!button) {
      return;
    }
    var dark = currentTheme() === 'dark';
    button.setAttribute('aria-pressed', String(dark));
    button.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
    button.innerHTML = '<i class="material-icons">' + (dark ? 'light_mode' : 'dark_mode') + '</i>';
  }

  /**
   * Event handler for theme toggle button clicks.
   * Toggles active theme, updates DOM, syncs to localStorage, and updates button UI.
   *
   * @param {MouseEvent} event - Click event.
   */
  function toggleTheme(event) {
    event.preventDefault();
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      // Ignore storage failures (e.g. private browsing mode).
    }
    updateButton();
  }

  /**
   * Creates and appends the theme toggle anchor button into the `#codelab-title` header bar.
   *
   * @param {HTMLElement} titleBar - The `#codelab-title` header container.
   */
  function createButton(titleBar) {
    if (titleBar.querySelector('#theme-toggle')) {
      return;
    }
    button = document.createElement('a');
    button.href = '#';
    button.id = 'theme-toggle';
    button.setAttribute('role', 'button');
    button.addEventListener('click', toggleTheme);
    titleBar.appendChild(button);
    updateButton();
  }

  /**
   * Attempts to locate the title bar and inject the toggle button.
   *
   * @returns {boolean} True if successfully mounted, false otherwise.
   */
  function tryInit() {
    var titleBar = document.querySelector('#codelab-title');
    if (!titleBar) {
      return false;
    }
    createButton(titleBar);
    return true;
  }

  // Immediately apply persisted theme from localStorage before render to avoid flash of light mode
  var stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // Ignore storage failures (e.g. private browsing).
  }
  applyTheme(stored === 'dark' ? 'dark' : 'light');

  // Mount button if titleBar is already in DOM, or observe DOM until codelab.js creates it
  if (!tryInit()) {
    var observer = new MutationObserver(function () {
      if (tryInit()) {
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}());
