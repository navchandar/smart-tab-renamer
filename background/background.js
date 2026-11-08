/**
 * Smart Tab Renamer - Background Controller (MV3)
 * Orchestrates menus, browser events, tab lifecycle, and message passing.
 */
(() => {
  "use strict";

  async function initializeExtension() {
    console.info("[SmartTabRenamer] Background service activating...");
    setupContextMenus();
    setupEventListeners();
  }

  function setupContextMenus() {
    browser.menus
      .removeAll()
      .then(() => {
        browser.menus.create({
          id: "smarttab-rename-tab",
          title: "Rename Tab...",
          contexts: ["tab", "page"],
        });

        browser.menus.create({
          id: "smarttab-clear-rename",
          title: "Clear Custom Name",
          contexts: ["tab", "page"],
        });

        browser.menus.create({
          id: "smarttab-copy-rule",
          title: "Copy Rule From Current Tab...",
          contexts: ["tab", "page"],
        });
      })
      .catch((err) =>
        console.error("[SmartTabRenamer] Context menu creation error:", err),
      );
  }

  function setupEventListeners() {
    // Context Menu Handler
    browser.menus.onClicked.addListener(async (info, tab) => {
      if (!tab || !tab.id) return;

      switch (info.menuItemId) {
        case "smarttab-rename-tab": {
          browser.action.openPopup
            ? browser.action.openPopup()
            : openDirectRenamePrompt(tab);
          break;
        }

        case "smarttab-clear-rename": {
          await window.SmartTabManager.setManualTabName(tab.id, tab.url, null);
          break;
        }

        case "smarttab-copy-rule": {
          const url = new URL(tab.url);
          const domain = url.hostname;
          const prefill = encodeURIComponent(
            JSON.stringify({
              pattern: domain,
              type: "domain",
              replacement: tab.title || domain,
            }),
          );
          browser.tabs.create({
            url: browser.runtime.getURL(
              `options/settings.html?quickPrefill=${prefill}`,
            ),
          });
          break;
        }
      }
    });

    // Tab Event Handlers
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (
        changeInfo.status === "loading" ||
        changeInfo.title ||
        changeInfo.url
      ) {
        const state = window.SmartTabManager.getTabState(tabId);
        if (changeInfo.title && changeInfo.title !== state.calculatedTitle) {
          state.originalTitle = changeInfo.title;
        }

        const targetTitle = await window.SmartTabManager.resolveTabTitle(tab);
        if (targetTitle) {
          await window.SmartTabManager.applyTitleToTab(tabId, targetTitle);
        }
      }
    });

    browser.tabs.onRemoved.addListener((tabId) => {
      window.SmartTabManager.cleanupTab(tabId);
    });

    // Content Script Message Dispatcher
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.action) return false;

      (async () => {
        try {
          switch (message.action) {
            case "TAB_TITLE_MUTATED": {
              if (sender.tab) {
                const state = window.SmartTabManager.getTabState(sender.tab.id);
                if (message.payload.newTitle !== state.calculatedTitle) {
                  state.originalTitle = message.payload.newTitle;
                }
                const enforcedTitle =
                  await window.SmartTabManager.resolveTabTitle(sender.tab);
                sendResponse({ enforcedTitle });
              }
              break;
            }

            case "GET_ACTIVE_TAB_CONTEXT": {
              const [activeTab] = await browser.tabs.query({
                active: true,
                currentWindow: true,
              });
              if (!activeTab) {
                sendResponse({ error: "No active tab" });
                return;
              }
              const manualName = await window.SmartTabStorage.getManualName(
                activeTab.url,
              );
              const containerName =
                await window.SmartTabContainers.getContainerName(
                  activeTab.cookieStoreId,
                );
              sendResponse({
                tabId: activeTab.id,
                url: activeTab.url,
                title: activeTab.title,
                manualName,
                containerName,
              });
              break;
            }

            case "MANUAL_RENAME_SUBMIT": {
              const { tabId, url, newTitle } = message.payload;
              await window.SmartTabManager.setManualTabName(
                tabId,
                url,
                newTitle,
              );
              sendResponse({ success: true });
              break;
            }

            case "RELOAD_RULES": {
              await window.SmartTabRulesEngine.reloadRules();
              // Apply immediately to all open tabs
              const tabs = await browser.tabs.query({});
              for (const t of tabs) {
                const resolved =
                  await window.SmartTabManager.resolveTabTitle(t);
                if (resolved) {
                  await window.SmartTabManager.applyTitleToTab(t.id, resolved);
                }
              }
              sendResponse({ success: true });
              break;
            }

            default:
              sendResponse({ unknown: true });
          }
        } catch (err) {
          console.error("[SmartTabRenamer] Message handling error:", err);
          sendResponse({ error: err.message });
        }
      })();

      return true; // Keep channel open for async response
    });
  }

  function openDirectRenamePrompt(tab) {
    browser.tabs
      .sendMessage(tab.id, { action: "PROMPT_MANUAL_RENAME" })
      .catch(() => {
        // Fallback: open extension options page if script inaccessible
        browser.runtime.openOptionsPage();
      });
  }

  initializeExtension();
})();
