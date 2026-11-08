/**
 * Smart Tab Renamer - Rules Engine
 * High-performance rule execution with priority indexing and precompiled regex cache.
 * Evaluates in priority order: Exact URL > Path Prefix > Domain > Subdomain Wildcard > Regex.
 */
(() => {
  'use strict';

  class RulesEngine {
    constructor() {
      this.regexCache = new Map();
      this.rules = [];
      this.init();
    }

    async init() {
      await this.reloadRules();
    }

    async reloadRules() {
      this.rules = await window.SmartTabStorage.getRules();
      this.regexCache.clear();

      // Precompile regexes for immediate execution
      this.rules.forEach(rule => {
        if (rule.enabled && rule.type === 'regex') {
          try {
            this.regexCache.set(rule.id, new RegExp(rule.pattern));
          } catch (err) {
            console.error(`[SmartTabRenamer:Rules] Failed to compile regex for rule ${rule.id}:`, err);
          }
        }
      });
    }

    /**
     * Determines highest priority match for a given URL and container context.
     * @param {string} rawUrl Current Tab URL
     * @param {string} cookieStoreId Tab's container store ID
     * @returns {Object|null} Matching rule and regex capture array if any.
     */
    findMatchingRule(rawUrl, cookieStoreId = 'firefox-default') {
      if (!rawUrl || rawUrl.startsWith('about:') || rawUrl.startsWith('moz-extension:')) {
        return null;
      }

      let parsedUrl = null;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        return null;
      }

      const activeRules = this.rules.filter(r => {
        if (!r.enabled) return false;
        if (r.containerId && r.containerId !== 'any' && r.containerId !== cookieStoreId) {
          return false;
        }
        return true;
      });

      // Sort order by priority ascending (1 is highest priority)
      activeRules.sort((a, b) => (a.priority || 50) - (b.priority || 50));

      for (const rule of activeRules) {
        const matchData = this.checkRuleMatch(rule, parsedUrl, rawUrl);
        if (matchData.isMatch) {
          return {
            rule,
            regexMatches: matchData.regexMatches || []
          };
        }
      }

      return null;
    }

    checkRuleMatch(rule, parsedUrl, rawUrl) {
      const pattern = rule.pattern.trim();

      switch (rule.type) {
        case 'exact': {
          return { isMatch: rawUrl === pattern };
        }

        case 'prefix': {
          return { isMatch: rawUrl.startsWith(pattern) };
        }

        case 'domain': {
          const host = parsedUrl.hostname.toLowerCase();
          const cleanPattern = pattern.toLowerCase().replace(/^www\./, '');
          const cleanHost = host.replace(/^www\./, '');
          return { isMatch: cleanHost === cleanPattern };
        }

        case 'subdomain': {
          const host = parsedUrl.hostname.toLowerCase();
          let baseDomain = pattern.toLowerCase();
          if (baseDomain.startsWith('*.')) {
            baseDomain = baseDomain.slice(2);
          }
          const isMatch = host === baseDomain || host.endsWith('.' + baseDomain);
          return { isMatch };
        }

        case 'regex': {
          let compiled = this.regexCache.get(rule.id);
          if (!compiled) {
            try {
              compiled = new RegExp(rule.pattern);
              this.regexCache.set(rule.id, compiled);
            } catch {
              return { isMatch: false };
            }
          }
          const matches = compiled.exec(rawUrl);
          return {
            isMatch: Boolean(matches),
            regexMatches: matches ? Array.from(matches) : []
          };
        }

        default:
          return { isMatch: false };
      }
    }
  }

  window.SmartTabRulesEngine = new RulesEngine();
})();