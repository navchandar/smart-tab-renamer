/**
 * Smart Tab Renamer - Storage Module
 * Manages synchronisation across Firefox storage engines with atomic migrations.
 */
(() => {
  "use strict";

  const STORAGE_SCHEMA_VERSION = 1;

  const DEFAULT_SETTINGS = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    rules: [
      {
        id: "default-github",
        enabled: true,
        type: "domain",
        pattern: "github.com",
        replacement: "GitHub - %title%",
        containerId: "any",
        priority: 30,
        createdAt: Date.now(),
      },
      {
        id: "default-jira",
        enabled: true,
        type: "subdomain",
        pattern: "*.atlassian.net",
        replacement: "[Jira] %title%",
        containerId: "any",
        priority: 40,
        createdAt: Date.now(),
      },
    ],
    manualNames: {}, // Keyed by tab URL or persistence token: { [url]: customTitle }
    preferences: {
      useBookmarkTitle: true,
      persistentEnforcement: true,
      autoCleanOldManualsDays: 30,
    },
  };

  class StorageManager {
    constructor() {
      this.isSyncAvailable = Boolean(browser.storage && browser.storage.sync);
    }

    async getBackend() {
      if (this.isSyncAvailable) {
        try {
          // Perform test read to confirm sync quota hasn't failed
          await browser.storage.sync.get("schemaVersion");
          return browser.storage.sync;
        } catch (err) {
          console.warn(
            "[SmartTabRenamer:Storage] Sync storage inaccessible; falling back to local.",
            err,
          );
          this.isSyncAvailable = false;
        }
      }
      return browser.storage.local;
    }

    async getAll() {
      try {
        const backend = await this.getBackend();
        const data = await backend.get(null);
        if (!data || Object.keys(data).length === 0 || !data.rules) {
          await this.saveAll(DEFAULT_SETTINGS);
          return structuredClone(DEFAULT_SETTINGS);
        }
        return this.migrateSchema(data);
      } catch (error) {
        console.error(
          "[SmartTabRenamer:Storage] Failed reading configuration:",
          error,
        );
        return structuredClone(DEFAULT_SETTINGS);
      }
    }

    async saveAll(data) {
      try {
        const payload = {
          ...data,
          schemaVersion: STORAGE_SCHEMA_VERSION,
          updatedAt: Date.now(),
        };
        const backend = await this.getBackend();
        await backend.set(payload);
        return true;
      } catch (error) {
        console.error(
          "[SmartTabRenamer:Storage] Save operation failed:",
          error,
        );
        // Secondary fallback try local directly if sync choked on quota limits
        try {
          await browser.storage.local.set(data);
          return true;
        } catch (fatal) {
          console.error(
            "[SmartTabRenamer:Storage] Fatal persistence failure:",
            fatal,
          );
          return false;
        }
      }
    }

    async setManualName(url, customTitle) {
      if (!url) return false;
      const data = await this.getAll();
      if (!data.manualNames) data.manualNames = {};
      if (!customTitle || customTitle.trim() === "") {
        delete data.manualNames[url];
      } else {
        // Store title and last-accessed timestamp
        data.manualNames[url] = {
          title: customTitle.trim(),
          updatedAt: Date.now(),
        };
      }
      return await this.saveAll(data);
    }
    async getManualName(url) {
      if (!url) return null;
      const data = await this.getAll();
      const entry = data.manualNames?.[url];
      if (!entry) return null;
      // Support both legacy string values and new timestamped objects
      if (typeof entry === "string") {
        return entry;
      }
      return entry.title || null;
    }
    async cleanStaleManualNames() {
      const data = await this.getAll();
      const maxDays = data.preferences?.autoCleanOldManualsDays ?? 30;
      // 0 disables cleanup
      if (maxDays <= 0 || !data.manualNames) return;
      const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
      let changed = false;
      for (const [url, entry] of Object.entries(data.manualNames)) {
        const timestamp = typeof entry === "object" ? entry.updatedAt : null;
        if (timestamp && timestamp < cutoff) {
          delete data.manualNames[url];
          changed = true;
        }
      }
      if (changed) {
        console.info(
          "[SmartTabRenamer:Storage] Cleaned stale manual tab names older than",
          maxDays,
          "days",
        );
        await this.saveAll(data);
      }
    }

    async getRules() {
      const data = await this.getAll();
      return Array.isArray(data.rules) ? data.rules : [];
    }

    async setRules(rules) {
      const data = await this.getAll();
      data.rules = rules;
      return await this.saveAll(data);
    }

    async getManualName(url) {
      if (!url) return null;
      const data = await this.getAll();
      return data.manualNames?.[url] || null;
    }

    async setManualName(url, customTitle) {
      if (!url) return false;
      const data = await this.getAll();
      if (!data.manualNames) data.manualNames = {};

      if (!customTitle || customTitle.trim() === "") {
        delete data.manualNames[url];
      } else {
        data.manualNames[url] = customTitle.trim();
      }
      return await this.saveAll(data);
    }

    async removeManualName(url) {
      return this.setManualName(url, null);
    }

    async getPreferences() {
      const data = await this.getAll();
      return data.preferences || DEFAULT_SETTINGS.preferences;
    }

    async setPreferences(prefs) {
      const data = await this.getAll();
      data.preferences = { ...data.preferences, ...prefs };
      return await this.saveAll(data);
    }

    migrateSchema(data) {
      if (!data.schemaVersion || data.schemaVersion < STORAGE_SCHEMA_VERSION) {
        console.info(
          "[SmartTabRenamer:Storage] Migrating schema version to",
          STORAGE_SCHEMA_VERSION,
        );
        data.schemaVersion = STORAGE_SCHEMA_VERSION;
        data.rules = Array.isArray(data.rules) ? data.rules : [];
        data.manualNames = data.manualNames || {};
        data.preferences = {
          ...DEFAULT_SETTINGS.preferences,
          ...(data.preferences || {}),
        };
      }
      return data;
    }
  }

  window.SmartTabStorage = new StorageManager();
})();
