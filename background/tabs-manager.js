/**
 * Smart Tab Renamer - Tabs Manager
 * Tracks per-tab states, handles manual overrides, queries bookmark titles,
 * and communicates persistent titles to content scripts.
 */
(() => {
  "use strict";

  class TabsManager {
    constructor() {
      // Map of tabId -> { manualName, calculatedTitle, originalTitle, url }
      this.tabStates = new Map();
    }

    getTabState(tabId) {
      if (!this.tabStates.has(tabId)) {
        this.tabStates.set(tabId, {
          manualName: null,
          calculatedTitle: null,
          originalTitle: "",
          url: "",
        });
      }
      return this.tabStates.get(tabId);
    }

    async resolveTabTitle(tab) {
      if (
        !tab ||
        !tab.id ||
        !tab.url ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("moz-extension:")
      ) {
        return null;
      }

      const state = this.getTabState(tab.id);
      state.url = tab.url;
      const prefs = await window.SmartTabStorage.getPreferences();

      // Tier 1: Check Manual Tab Name Override
      const storedManual = await window.SmartTabStorage.getManualName(tab.url);
      const activeManual = state.manualName || storedManual;
      if (activeManual) {
        state.calculatedTitle = activeManual;
        return activeManual;
      }

      // Tier 2: Check Bookmark Name (if enabled in user preferences)
      if (prefs.useBookmarkTitle && browser.bookmarks) {
        try {
          const bookmarks = await browser.bookmarks.search({ url: tab.url });
          if (bookmarks && bookmarks.length > 0 && bookmarks[0].title) {
            state.calculatedTitle = bookmarks[0].title;
            return bookmarks[0].title;
          }
        } catch (err) {
          console.warn(
            "[SmartTabRenamer:TabsManager] Bookmark lookup error:",
            err,
          );
        }
      }

      // Tier 3: Apply Matching Rule
      const containerName = await window.SmartTabContainers.getContainerName(
        tab.cookieStoreId,
      );
      const match = window.SmartTabRulesEngine.findMatchingRule(
        tab.url,
        tab.cookieStoreId,
      );

      if (match) {
        const resolvedTitle = window.SmartTabTemplates.resolve(
          match.rule.replacement,
          {
            rawTitle: state.originalTitle || tab.title || "",
            url: tab.url,
            containerName,
            regexMatches: match.regexMatches,
          },
        );
        state.calculatedTitle = resolvedTitle;
        return resolvedTitle;
      }

      // Tier 4: No rule matched, keep original
      state.calculatedTitle = null;
      return null;
    }

    async applyTitleToTab(tabId, title) {
      if (!title) return;
      try {
        await browser.tabs.sendMessage(tabId, {
          action: "ENFORCE_TITLE",
          payload: { title },
        });
      } catch (err) {
        // Tab may still be loading or restricted; benign failure caught cleanly
      }
    }

    async setManualTabName(tabId, url, customTitle) {
      const state = this.getTabState(tabId);
      state.manualName = customTitle;
      await window.SmartTabStorage.setManualName(url, customTitle);

      if (customTitle) {
        await this.applyTitleToTab(tabId, customTitle);
      } else {
        // Clear: recalculate rules or revert to original
        const restored = await this.resolveTabTitle({ id: tabId, url });
        await browser.tabs.sendMessage(tabId, {
          action: "CLEAR_TITLE",
          payload: { fallbackTitle: restored || state.originalTitle },
        });
      }
    }

    cleanupTab(tabId) {
      this.tabStates.delete(tabId);
    }
  }

  window.SmartTabManager = new TabsManager();
})();
