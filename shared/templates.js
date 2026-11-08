/**
 * Smart Tab Renamer - Templates Engine
 * Resolves template tags (%title%, %hostname%, %path%, %url%, %container%) and regex capture groups ($1..$9).
 */
(() => {
  'use strict';

  class TemplateEngine {
    /**
     * Resolves all variables and regex replacements.
     * @param {string} template Replacement text template.
     * @param {Object} context Context data: { rawTitle, url, containerName, regexMatches }
     * @returns {string} Final resolved title.
     */
    resolve(template, context = {}) {
      if (!template || typeof template !== 'string') {
        return context.rawTitle || '';
      }

      let parsedUrl = null;
      try {
        if (context.url) {
          parsedUrl = new URL(context.url);
        }
      } catch {
        parsedUrl = { hostname: '', pathname: '', href: context.url || '' };
      }

      let output = template;

      // 1. Process standard named template tokens
      const tokenMap = {
        '%title%': context.rawTitle || '',
        '%hostname%': parsedUrl ? parsedUrl.hostname : '',
        '%path%': parsedUrl ? parsedUrl.pathname : '',
        '%url%': context.url || '',
        '%container%': context.containerName || 'Default'
      };

      for (const [token, value] of Object.entries(tokenMap)) {
        output = output.replaceAll(token, value);
      }

      // 2. Process Regex capture groups ($1, $2, etc.) if matched
      if (Array.isArray(context.regexMatches) && context.regexMatches.length > 0) {
        output = output.replace(/\$([0-9]{1,2})/g, (match, digit) => {
          const index = parseInt(digit, 10);
          return typeof context.regexMatches[index] !== 'undefined'
            ? context.regexMatches[index]
            : match;
        });
      }

      // Sanitize multi-space and line breaks
      return output.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    }
  }

  window.SmartTabTemplates = new TemplateEngine();
})();