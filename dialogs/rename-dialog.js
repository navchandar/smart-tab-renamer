/**
 * Smart Tab Renamer - Dialog Script
 */
(() => {
  "use strict";

  let currentTabId = null;
  let currentTabUrl = null;

  document.addEventListener("DOMContentLoaded", async () => {
    const urlInput = document.getElementById("currentUrl");
    const titleInput = document.getElementById("customTitleInput");
    const containerBadge = document.getElementById("containerBadge");
    const saveBtn = document.getElementById("saveBtn");
    const clearBtn = document.getElementById("clearBtn");
    const openOptionsLink = document.getElementById("openOptionsLink");

    try {
      const context = await browser.runtime.sendMessage({
        action: "GET_ACTIVE_TAB_CONTEXT",
      });
      if (context && !context.error) {
        currentTabId = context.tabId;
        currentTabUrl = context.url;
        urlInput.value = context.url;
        containerBadge.textContent = context.containerName || "Default";

        if (context.manualName) {
          titleInput.value = context.manualName;
        } else {
          titleInput.placeholder = context.title || "Enter custom title...";
        }
      }
    } catch (err) {
      console.error("[SmartTabRenamer:Dialog] Context fetch failed:", err);
    }

    saveBtn.addEventListener("click", async () => {
      const newTitle = titleInput.value.trim();
      await browser.runtime.sendMessage({
        action: "MANUAL_RENAME_SUBMIT",
        payload: {
          tabId: currentTabId,
          url: currentTabUrl,
          newTitle,
        },
      });
      window.close();
    });

    clearBtn.addEventListener("click", async () => {
      await browser.runtime.sendMessage({
        action: "MANUAL_RENAME_SUBMIT",
        payload: {
          tabId: currentTabId,
          url: currentTabUrl,
          newTitle: "",
        },
      });
      window.close();
    });

    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        saveBtn.click();
      } else if (e.key === "Escape") {
        window.close();
      }
    });

    openOptionsLink.addEventListener("click", (e) => {
      e.preventDefault();
      browser.runtime.openOptionsPage();
      window.close();
    });
  });
})();
