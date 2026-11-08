/**
 * Smart Tab Renamer - Settings Page Controller
 */
(() => {
  "use strict";

  let rulesList = [];
  let containersList = [];

  document.addEventListener("DOMContentLoaded", async () => {
    await initContainers();
    await loadSettingsAndRules();
    bindFormEvents();
    bindFilterEvents();
    bindAdminEvents();
    checkQueryPrefills();
  });

  async function initContainers() {
    if (browser.contextualIdentities) {
      try {
        const identities = await browser.contextualIdentities.query({});
        containersList = identities.map((i) => ({
          id: i.cookieStoreId,
          name: i.name,
        }));
      } catch {
        containersList = [];
      }
    }

    const quickSelect = document.getElementById("quickContainer");
    const advSelect = document.getElementById("advContainer");
    const filterSelect = document.getElementById("filterContainerSelect");

    const options = [
      '<option value="any">Any Container</option>',
      '<option value="firefox-default">Default (No Container)</option>',
      ...containersList.map(
        (c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`,
      ),
    ].join("");

    quickSelect.innerHTML = options;
    advSelect.innerHTML = options;
    filterSelect.innerHTML =
      '<option value="all">All Containers</option>' + options;
  }

  async function loadSettingsAndRules() {
    rulesList = await window.SmartTabStorage.getRules();
    const prefs = await window.SmartTabStorage.getPreferences();
    document.getElementById("prefBookmarkNaming").checked = Boolean(
      prefs.useBookmarkTitle,
    );
    document.getElementById("prefPersistentEnforcement").checked = Boolean(
      prefs.persistentEnforcement,
    );
    // Load saved days (defaults to 30)
    const cleanDaysInput = document.getElementById("prefAutoCleanDays");
    cleanDaysInput.value =
      typeof prefs.autoCleanOldManualsDays === "number"
        ? prefs.autoCleanOldManualsDays
        : 30;
    updateRulesTable();
  }

  function updateRulesTable() {
    const tbody = document.getElementById("rulesTableBody");
    const filterType = document.getElementById("filterTypeSelect").value;
    const filterContainer = document.getElementById(
      "filterContainerSelect",
    ).value;
    const search = document
      .getElementById("searchRulesInput")
      .value.toLowerCase()
      .trim();

    document.getElementById("ruleCountBadge").textContent =
      `${rulesList.length} Rules`;

    const filtered = rulesList.filter((rule) => {
      if (filterType !== "all" && rule.type !== filterType) return false;
      if (filterContainer !== "all") {
        const targetContainer = rule.containerId || "any";
        if (targetContainer !== filterContainer) return false;
      }
      if (search) {
        const inPattern = rule.pattern.toLowerCase().includes(search);
        const inRepl = rule.replacement.toLowerCase().includes(search);
        if (!inPattern && !inRepl) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">No rules match your filter criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((rule) => {
        const containerObj = containersList.find(
          (c) => c.id === rule.containerId,
        );
        const containerLabel =
          rule.containerId === "any"
            ? "Any"
            : containerObj
              ? containerObj.name
              : "Default";

        return `
        <tr data-id="${rule.id}">
          <td>
            <input type="checkbox" class="rule-enable-toggle" ${rule.enabled ? "checked" : ""}>
          </td>
          <td><span class="badge badge-info">${rule.type}</span></td>
          <td><code>${escapeHtml(rule.pattern)}</code></td>
          <td><strong>${escapeHtml(rule.replacement)}</strong></td>
          <td><span class="badge">${escapeHtml(containerLabel)}</span></td>
          <td>${rule.priority || 50}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-icon btn-dup" title="Duplicate Rule">⧉</button>
              <button class="btn-icon btn-up" title="Move Up">↑</button>
              <button class="btn-icon btn-down" title="Move Down">↓</button>
              <button class="btn-icon btn-del" title="Delete Rule">✕</button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");

    attachTableEventHandlers();
  }

  function attachTableEventHandlers() {
    const tbody = document.getElementById("rulesTableBody");

    tbody.querySelectorAll(".rule-enable-toggle").forEach((chk) => {
      chk.addEventListener("change", async (e) => {
        const id = e.target.closest("tr").dataset.id;
        const rule = rulesList.find((r) => r.id === id);
        if (rule) {
          rule.enabled = e.target.checked;
          await persistAndSync();
        }
      });
    });

    tbody.querySelectorAll(".btn-del").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest("tr").dataset.id;
        rulesList = rulesList.filter((r) => r.id !== id);
        await persistAndSync();
        updateRulesTable();
      });
    });

    tbody.querySelectorAll(".btn-dup").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest("tr").dataset.id;
        const rule = rulesList.find((r) => r.id === id);
        if (rule) {
          const clone = structuredClone(rule);
          clone.id = "rule-" + Date.now();
          clone.replacement += " (Copy)";
          rulesList.push(clone);
          await persistAndSync();
          updateRulesTable();
        }
      });
    });

    tbody.querySelectorAll(".btn-up").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest("tr").dataset.id;
        const idx = rulesList.findIndex((r) => r.id === id);
        if (idx > 0) {
          const temp = rulesList[idx - 1];
          rulesList[idx - 1] = rulesList[idx];
          rulesList[idx] = temp;
          await persistAndSync();
          updateRulesTable();
        }
      });
    });

    tbody.querySelectorAll(".btn-down").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.closest("tr").dataset.id;
        const idx = rulesList.findIndex((r) => r.id === id);
        if (idx >= 0 && idx < rulesList.length - 1) {
          const temp = rulesList[idx + 1];
          rulesList[idx + 1] = rulesList[idx];
          rulesList[idx] = temp;
          await persistAndSync();
          updateRulesTable();
        }
      });
    });
  }

  function bindFormEvents() {
    // Quick Rule Form
    const quickForm = document.getElementById("quickRuleForm");
    quickForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const site = document.getElementById("quickSite").value.trim();
      const title = document.getElementById("quickTitle").value.trim();
      const container = document.getElementById("quickContainer").value;

      let type = "domain";
      let pattern = site.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

      const newRule = {
        id: "rule-" + Date.now(),
        enabled: true,
        type,
        pattern,
        replacement: title,
        containerId: container,
        priority: 30,
        createdAt: Date.now(),
      };

      const val = window.SmartTabValidators.validateRule(newRule);
      if (!val.isValid) {
        alert("Validation error: " + val.errors.join(" "));
        return;
      }

      rulesList.unshift(newRule);
      await persistAndSync();
      updateRulesTable();
      quickForm.reset();
    });

    // Toggle Advanced Form Display
    const toggleAdvBtn = document.getElementById("toggleAdvFormBtn");
    const advContainer = document.getElementById("advRuleFormContainer");
    toggleAdvBtn.addEventListener("click", () => {
      advContainer.classList.toggle("hidden");
    });

    document
      .getElementById("cancelAdvRuleBtn")
      .addEventListener("click", () => {
        advContainer.classList.add("hidden");
      });

    // Advanced Rule Form Submit
    const advForm = document.getElementById("advRuleForm");
    advForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const type = document.getElementById("advType").value;
      const pattern = document.getElementById("advPattern").value.trim();
      const containerId = document.getElementById("advContainer").value;
      const replacement = document
        .getElementById("advReplacement")
        .value.trim();

      const priorityMap = {
        exact: 10,
        prefix: 20,
        domain: 30,
        subdomain: 40,
        regex: 50,
      };

      const newRule = {
        id: "rule-" + Date.now(),
        enabled: true,
        type,
        pattern,
        replacement,
        containerId,
        priority: priorityMap[type] || 50,
        createdAt: Date.now(),
      };

      const val = window.SmartTabValidators.validateRule(newRule);
      if (!val.isValid) {
        document.getElementById("advPatternError").textContent =
          val.errors.join(" ");
        return;
      }
      document.getElementById("advPatternError").textContent = "";

      rulesList.unshift(newRule);
      await persistAndSync();
      updateRulesTable();
      advForm.reset();
      advContainer.classList.add("hidden");
    });

    // Live Sandbox Tester
    const testPatternInput = document.getElementById("advPattern");
    const testReplInput = document.getElementById("advReplacement");
    const testUrlInput = document.getElementById("testInputUrl");
    const testTitleInput = document.getElementById("testInputTitle");
    const liveOutput = document.getElementById("testLiveOutput");

    function updateLiveTester() {
      const pattern = testPatternInput.value;
      const repl = testReplInput.value;
      const url = testUrlInput.value;
      const rawTitle = testTitleInput.value;
      const type = document.getElementById("advType").value;

      if (!pattern || !repl || !url) {
        liveOutput.textContent = "(enter pattern and test values)";
        return;
      }

      let regexMatches = [];
      if (type === "regex") {
        try {
          const re = new RegExp(pattern);
          const m = re.exec(url);
          if (m) regexMatches = Array.from(m);
        } catch {
          liveOutput.textContent = "Invalid RegExp";
          return;
        }
      }

      const result = window.SmartTabTemplates.resolve(repl, {
        rawTitle,
        url,
        containerName: "Work",
        regexMatches,
      });

      liveOutput.textContent = result || "(No Match)";
    }

    [testPatternInput, testReplInput, testUrlInput, testTitleInput].forEach(
      (el) => {
        el.addEventListener("input", updateLiveTester);
      },
    );
  }

  function bindFilterEvents() {
    ["searchRulesInput", "filterTypeSelect", "filterContainerSelect"].forEach(
      (id) => {
        document.getElementById(id).addEventListener("input", updateRulesTable);
      },
    );
  }

  function bindAdminEvents() {
    // Preferences toggles
    document
      .getElementById("prefBookmarkNaming")
      .addEventListener("change", async (e) => {
        await window.SmartTabStorage.setPreferences({
          useBookmarkTitle: e.target.checked,
        });
        await browser.runtime.sendMessage({ action: "RELOAD_RULES" });
      });

    document
      .getElementById("prefPersistentEnforcement")
      .addEventListener("change", async (e) => {
        await window.SmartTabStorage.setPreferences({
          persistentEnforcement: e.target.checked,
        });
        await browser.runtime.sendMessage({ action: "RELOAD_RULES" });
      });

    // Save autoCleanOldManualsDays on input change
    const cleanDaysInput = document.getElementById("prefAutoCleanDays");
    cleanDaysInput.addEventListener("change", async (e) => {
      let days = parseInt(e.target.value, 10);
      if (isNaN(days) || days < 0) {
        days = 0;
        e.target.value = 0;
      } else if (days > 365) {
        days = 365;
        e.target.value = 365;
      }

      await window.SmartTabStorage.setPreferences({
        autoCleanOldManualsDays: days,
      });
      // Trigger cleanup immediately with the new threshold
      await window.SmartTabStorage.cleanStaleManualNames();
    });

    // Export JSON
    document.getElementById("exportBtn").addEventListener("click", async () => {
      await window.SmartTabExporter.generateExport();
    });

    // Import JSON
    const fileInput = document.getElementById("importFileInput");
    document.getElementById("importBtn").addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const result = await window.SmartTabImporter.importFromJsonString(
          evt.target.result,
        );
        if (result.success) {
          alert(`Import successful! ${result.count} rules loaded.`);
          await loadSettingsAndRules();
        } else {
          alert("Import failed:\n" + result.error);
        }
        fileInput.value = "";
      };
      reader.readAsText(file);
    });

    // Factory Reset
    document.getElementById("resetBtn").addEventListener("click", async () => {
      if (
        confirm(
          "Are you sure you want to reset all rules and settings to factory defaults?",
        )
      ) {
        await window.SmartTabStorage.saveAll({
          rules: [],
          manualNames: {},
          preferences: {},
        });
        await browser.runtime.sendMessage({ action: "RELOAD_RULES" });
        await loadSettingsAndRules();
      }
    });
  }

  function checkQueryPrefills() {
    const params = new URLSearchParams(window.location.search);
    const prefillRaw = params.get("quickPrefill");
    if (prefillRaw) {
      try {
        const data = JSON.parse(decodeURIComponent(prefillRaw));
        if (data.pattern)
          document.getElementById("quickSite").value = data.pattern;
        if (data.replacement)
          document.getElementById("quickTitle").value = data.replacement;
      } catch (err) {
        console.warn("Prefill parse error:", err);
      }
    }
  }

  async function persistAndSync() {
    await window.SmartTabStorage.setRules(rulesList);
    await browser.runtime.sendMessage({ action: "RELOAD_RULES" });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
