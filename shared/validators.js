/**
 * Smart Tab Renamer - Validators Module
 * Provides validation for URL patterns, regex, capture groups, and import structures.
 */
(() => {
  "use strict";

  class ValidatorService {
    /**
     * Validates a rule object according to its configured type.
     */
    validateRule(rule) {
      const errors = [];

      if (!rule || typeof rule !== "object") {
        return {
          isValid: false,
          errors: ["Rule must be a valid JSON object."],
        };
      }

      if (
        !rule.type ||
        !["exact", "prefix", "domain", "subdomain", "regex"].includes(rule.type)
      ) {
        errors.push(
          `Invalid match type: "${rule.type}". Must be exact, prefix, domain, subdomain, or regex.`,
        );
      }

      if (typeof rule.pattern !== "string" || rule.pattern.trim() === "") {
        errors.push("Rule pattern cannot be blank.");
      } else {
        const pattern = rule.pattern.trim();

        switch (rule.type) {
          case "exact":
          case "prefix":
            if (!this.isValidUrl(pattern)) {
              errors.push(
                `Invalid URL format for ${rule.type} rule: "${pattern}". Must include protocol (e.g. https://).`,
              );
            }
            break;

          case "domain":
            if (!this.isValidDomain(pattern)) {
              errors.push(
                `Invalid domain format: "${pattern}". Do not include protocol or path.`,
              );
            }
            break;

          case "subdomain":
            if (!this.isValidSubdomainWildcard(pattern)) {
              errors.push(
                `Invalid subdomain wildcard format: "${pattern}". Format must be *.example.com or company.com.`,
              );
            }
            break;

          case "regex":
            try {
              new RegExp(pattern);
            } catch (err) {
              errors.push(`Invalid Regular Expression: ${err.message}`);
            }
            break;
        }
      }

      if (
        typeof rule.replacement !== "string" ||
        rule.replacement.trim() === ""
      ) {
        errors.push("Replacement template cannot be blank.");
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    }

    isValidUrl(str) {
      try {
        const parsed = new URL(str);
        return ["http:", "https:", "ftp:", "file:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    }

    isValidDomain(domain) {
      // Must not contain slashes, colons with ports, or wildcards
      if (/[\/\?\:\*]/g.test(domain)) return false;
      return /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(
        domain,
      );
    }

    isValidSubdomainWildcard(pattern) {
      if (pattern.startsWith("*.")) {
        const base = pattern.slice(2);
        return this.isValidDomain(base);
      }
      return this.isValidDomain(pattern);
    }

    validateImportData(data) {
      if (!data || typeof data !== "object") {
        return {
          isValid: false,
          errors: ["Import file does not contain a JSON object."],
        };
      }

      if (!Array.isArray(data.rules)) {
        return { isValid: false, errors: ['Missing root "rules" array.'] };
      }

      const errors = [];
      data.rules.forEach((rule, idx) => {
        const result = this.validateRule(rule);
        if (!result.isValid) {
          errors.push(
            `Rule #${idx + 1} (${rule.pattern || "unnamed"}): ${result.errors.join(" ")}`,
          );
        }
      });

      return {
        isValid: errors.length === 0,
        errors,
      };
    }
  }

  window.SmartTabValidators = new ValidatorService();
})();
