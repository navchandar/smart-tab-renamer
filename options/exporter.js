/**
 * Smart Tab Renamer - Exporter Module
 * Generates verified JSON export dumps without tracking tokens or stale states.
 */
(() => {
  'use strict';

  class ConfigExporter {
    async generateExport() {
      const data = await window.SmartTabStorage.getAll();
      const exportObject = {
        version: 1,
        exportedAt: new Date().toISOString(),
        rules: data.rules || [],
        preferences: data.preferences || {}
      };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `smart-tab-renamer-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
    }
  }

  window.SmartTabExporter = new ConfigExporter();
})();