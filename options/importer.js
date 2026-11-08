/**
 * Smart Tab Renamer - Importer Module
 * Validates, checks schema, and cleanly merges or replaces rule sets.
 */
(() => {
  'use strict';
  class ConfigImporter {
    async importFromJsonString(jsonString) {
      let payload;
      try {
        payload = JSON.parse(jsonString);
      } catch (err) {
        return { success: false, error: 'Malformed JSON file: ' + err.message };
      }
      const validation = window.SmartTabValidators.validateImportData(payload);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Validation failed:\n' + validation.errors.join('\n')
        };
      }
      // Save imported configuration
      const existing = await window.SmartTabStorage.getAll();
      const mergedRules = [...payload.rules];
      existing.rules = mergedRules;
      if (payload.preferences) {
        existing.preferences = { ...existing.preferences, ...payload.preferences };
      }
      const ok = await window.SmartTabStorage.saveAll(existing);
      if (ok) {
        // Trigger background reload
        await browser.runtime.sendMessage({ action: 'RELOAD_RULES' });
        return { success: true, count: mergedRules.length };
      }
      return { success: false, error: 'Storage persistence failed.' };
    }
  }
  window.SmartTabImporter = new ConfigImporter();
})();
