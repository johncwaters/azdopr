# Change Log

All notable changes to the Azure DevOps PR Viewer extension.

## [1.0.0] - 2025-01-11

### Added

- **Organization-wide pull request discovery** across all projects and repositories
- **Microsoft Entra ID OAuth authentication** via VS Code's built-in authentication provider
- **Hierarchical tree view** automatically organized by project → repository → pull request
  - Projects sorted alphabetically
  - Repositories sorted alphabetically within each project
  - PRs sorted by age (oldest first) within each repository
- **PR File Viewer** with side-by-side diff comparison
  - View file changes directly from Azure DevOps without local checkout
  - Support for all file change types (added, modified, deleted)
  - Virtual file system for seamless PR file browsing
- **Inline PR Commenting**
  - Add comments directly to specific lines in PR diffs
  - CodeLens integration with configurable "Add Comment" buttons
  - Works on both sides of diff (original and modified)
  - Context menu support for adding comments
  - Comments posted immediately to Azure DevOps
- **Auto-refresh** with configurable interval (default: 5 minutes)
- **Rich PR information display** with tooltips showing:
  - Author, creation date, and age
  - Source and target branches
  - Reviewer status with vote indicators
  - PR description preview
  - Draft status
- **Interactive actions**:
  - Click any PR to view details in VS Code
  - Right-click to open PR in web browser
  - Add inline comments via CodeLens or context menu
- **Visual indicators**:
  - Icons for projects (📁), repositories (📦), PRs, and draft PRs
  - Approval status indicators (✅ ❌ 👍 ⏳ ⏸️)
  - PR counts displayed for each project and repository
- **Configuration settings**:
  - Organization name
  - Auto-refresh interval
  - Max PRs to fetch per project
  - Enable/disable inline comment CodeLens
  - CodeLens interval (show on every N lines)
- **Activity bar icon** for easy access to PR view
- **Commands** for refresh, sign in/out, view PR, open in browser, and add comments
