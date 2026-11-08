## Smart Tab Renamer

Firefox extension to permanently and automatically rename browser tabs using custom rules, container scoping, and persistent title enforcement.


### Overview

Smart Tab Renamer gives you permanent, rule-based control over tab titles, even if websites try to overwrite titles with notification count, alerts, etc.

Tabs can be renamed manually via the context menu or automatically using domain, subdomain, path prefix, or regex patterns. Titles remain persistent even when web applications attempt to overwrite them dynamically using SPA scripts or `document.title` updates.

### Features

- **Manual Tab Renaming**: Right-click any tab or page and choose **Rename Tab...** to set a custom title that survives page refreshes, tab switching, and session restores.
- **Persistent Title Enforcement**: Uses `MutationObserver` monitoring and `document.title` descriptor trapping to prevent sites such as Gmail, Outlook, Jira, Teams, and GitHub from overwriting custom titles.
- **Rule-Based Automation**: Rename tabs based on Exact URL, Path Prefix, Domain, Subdomain Wildcard (`*.company.com`), or Regular Expressions.
- **Regex Capture Groups**: Extract values from URLs or original titles using `$1`, `$2`, etc. in replacement strings.
- **Template Variables**: Use `%title%`, `%hostname%`, `%path%`, `%url%`, and `%container%` in dynamic titles.
- **Firefox Multi-Account Containers**: Apply different names per container (for example, "Work Mail" and "Personal Mail").
- **Bookmark-Based Naming**: Optionally inherit titles from matching Firefox bookmarks.
- **Quick Rule Setup**: Use **Copy Rule From Current Tab...** to create a starter rule automatically.
- **High Performance & Zero Telemetry**: Vanilla JavaScript implementation with precompiled regex caches, supporting 500+ rules and 100+ tabs with 0% idle CPU usage. No analytics, tracking, or remote scripts.
- **Sync & Backup**: Sync rules with `browser.storage.sync` and import/export verified JSON backups.

### Usage

#### Tab Context Menu

- **Rename Tab...**: Opens the quick rename dialog for the active tab.
- **Clear Custom Name**: Restores the rule-generated or original title.
- **Copy Rule From Current Tab...**: Creates a new rule pre-filled from the current page.

#### Toolbar Action

Click the Smart Tab Renamer toolbar icon to rename the active tab or view its container assignment.

#### Settings & Rule Configuration

Navigate to:

`about:addons > Smart Tab Renamer > Preferences`

Or click **Open All Rules & Settings** from the toolbar popup.

- **Quick Rules**: Configure domain, title, and container mappings without regex.
- **Advanced Rules**: Build prioritized rules, test regex capture groups, and reorder rule evaluation.
- **Administration**: Export or import rules as JSON backups.

### Permissions Used

- **tabs**: Monitor navigation, inspect URLs, and update tab titles.
- **storage**: Store rules, templates, manual names, and preferences.
- **menus**: Add context menu actions.
- **contextualIdentities**: Detect Firefox container IDs and names.
- **cookies**: Access container metadata via `cookieStoreId`.
- **bookmarks**: Retrieve bookmark titles for bookmark-based naming.
- **`<all_urls>`**: Monitor and enforce `<title>` elements across supported sites.

### Testing

1. Clone or download the repository.
2. Open Firefox and navigate to:
   ```
   about:debugging#/runtime/this-firefox
   ```
3. Click **Load Temporary Add-on...**
4. Select `manifest.json` from the `smart-tab-renamer/` folder.
5. Use the toolbar icon or tab context menu to test manual and rule-based renaming.