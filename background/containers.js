/**
 * Smart Tab Renamer - Containers Bridge
 * Safely accesses and maps Firefox Multi-Account Containers (contextualIdentities).
 */
(() => {
  'use strict';

  class ContainersBridge {
    constructor() {
      this.cache = new Map();
      this.hasPermission = Boolean(browser.contextualIdentities);
      if (this.hasPermission) {
        this.bindEvents();
        this.refreshCache();
      }
    }

    bindEvents() {
      if (!browser.contextualIdentities) return;
      browser.contextualIdentities.onCreated?.addListener(() => this.refreshCache());
      browser.contextualIdentities.onRemoved?.addListener(() => this.refreshCache());
      browser.contextualIdentities.onUpdated?.addListener(() => this.refreshCache());
    }

    async refreshCache() {
      if (!browser.contextualIdentities) return;
      try {
        const identities = await browser.contextualIdentities.query({});
        this.cache.clear();
        identities.forEach(id => {
          this.cache.set(id.cookieStoreId, id.name);
        });
      } catch (err) {
        console.warn('[SmartTabRenamer:Containers] Query failed:', err);
      }
    }

    async getContainerName(cookieStoreId) {
      if (!cookieStoreId || cookieStoreId === 'firefox-default') {
        return 'Default';
      }
      if (this.cache.has(cookieStoreId)) {
        return this.cache.get(cookieStoreId);
      }
      if (browser.contextualIdentities) {
        try {
          const identity = await browser.contextualIdentities.get(cookieStoreId);
          if (identity) {
            this.cache.set(cookieStoreId, identity.name);
            return identity.name;
          }
        } catch {
          // Non-existent or default container
        }
      }
      return 'Default';
    }

    async getAllContainers() {
      if (!browser.contextualIdentities) {
        return [{ id: 'any', name: 'Any Container' }, { id: 'firefox-default', name: 'Default' }];
      }
      try {
        const identities = await browser.contextualIdentities.query({});
        const list = identities.map(i => ({ id: i.cookieStoreId, name: i.name, color: i.color }));
        return [
          { id: 'any', name: 'Any Container' },
          { id: 'firefox-default', name: 'Default' },
          ...list
        ];
      } catch {
        return [{ id: 'any', name: 'Any Container' }];
      }
    }
  }

  window.SmartTabContainers = new ContainersBridge();
})();