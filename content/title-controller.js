/**
 * Smart Tab Renamer - Content Title Controller
 * Observes and enforces tab titles on active web pages without aggressive polling.
 * Uses MutationObserver on <title> and intercepts document.title property setters.
 */
(() => {
  "use strict";

  // Prevent multiple injections
  if (window.__smartTabRenamerInjected) return;
  window.__smartTabRenamerInjected = true;

  let enforcedTitle = null;
  let isInternalUpdate = false;
  let observer = null;

  function initObserver() {
    const head = document.head || document.documentElement;
    let titleElem = document.querySelector("title");

    if (!titleElem) {
      titleElem = document.createElement("title");
      head.appendChild(titleElem);
    }

    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(() => {
      if (isInternalUpdate) return;

      if (enforcedTitle && document.title !== enforcedTitle) {
        applyEnforcedTitle();
      } else if (!enforcedTitle) {
        // Inform background of legitimate title change for template calculations
        browser.runtime
          .sendMessage({
            action: "TAB_TITLE_MUTATED",
            payload: { newTitle: document.title },
          })
          .then((response) => {
            if (response && response.enforcedTitle) {
              enforcedTitle = response.enforcedTitle;
              applyEnforcedTitle();
            }
          })
          .catch(() => {});
      }
    });

    observer.observe(titleElem, {
      subtree: true,
      characterData: true,
      childList: true,
    });
  }

  function applyEnforcedTitle() {
    if (!enforcedTitle) return;
    try {
      isInternalUpdate = true;
      document.title = enforcedTitle;
    } finally {
      isInternalUpdate = false;
    }
  }

  // Intercept setter on document.title to trap SPA updates (Jira, Gmail, Teams)
  function interceptDocumentTitle() {
    try {
      const originalTitleDesc =
        Object.getOwnPropertyDescriptor(Document.prototype, "title") ||
        Object.getOwnPropertyDescriptor(HTMLDocument.prototype, "title");

      if (originalTitleDesc && originalTitleDesc.set) {
        Object.defineProperty(document, "title", {
          get: function () {
            return enforcedTitle || originalTitleDesc.get.call(this);
          },
          set: function (newVal) {
            if (isInternalUpdate) {
              originalTitleDesc.set.call(this, newVal);
              return;
            }

            if (enforcedTitle) {
              // Ignore website attempts to overwrite enforced title
              originalTitleDesc.set.call(this, enforcedTitle);
            } else {
              originalTitleDesc.set.call(this, newVal);
              browser.runtime
                .sendMessage({
                  action: "TAB_TITLE_MUTATED",
                  payload: { newTitle: newVal },
                })
                .then((resp) => {
                  if (resp && resp.enforcedTitle) {
                    enforcedTitle = resp.enforcedTitle;
                    applyEnforcedTitle();
                  }
                })
                .catch(() => {});
            }
          },
          configurable: true,
          enumerable: true,
        });
      }
    } catch (err) {
      console.warn(
        "[SmartTabRenamer:Content] Prototype interception bypassed:",
        err,
      );
    }
  }

  // Runtime Message Receiver
  browser.runtime.onMessage.addListener((message) => {
    if (!message || !message.action) return;

    switch (message.action) {
      case "ENFORCE_TITLE": {
        enforcedTitle = message.payload.title;
        applyEnforcedTitle();
        break;
      }

      case "CLEAR_TITLE": {
        enforcedTitle = null;
        if (message.payload.fallbackTitle) {
          isInternalUpdate = true;
          document.title = message.payload.fallbackTitle;
          isInternalUpdate = false;
        }
        break;
      }

      case "PROMPT_MANUAL_RENAME": {
        const input = window.prompt(
          "Smart Tab Renamer - Enter new title for this tab:",
          document.title,
        );
        if (input !== null) {
          browser.runtime.sendMessage({
            action: "MANUAL_RENAME_SUBMIT",
            payload: {
              url: window.location.href,
              newTitle: input.trim(),
            },
          });
        }
        break;
      }
    }
  });

  // Startup hook
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        initObserver();
        interceptDocumentTitle();
      },
      { once: true },
    );
  } else {
    initObserver();
    interceptDocumentTitle();
  }
})();
