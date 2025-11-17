# Azure DevOps PR Viewer

View all Pull Requests across your Azure DevOps organization in VS Code.

## Features

- View all PRs across all projects and repositories in your organization
- Microsoft Entra ID authentication
- PRs grouped by Project → Repository → Pull Request
- View and diff PR files without local checkout
- Add inline comments directly to PR diffs
- Auto-refresh and manual refresh options

## Quick Start

### 1. Configure Your Organization

Click the gear icon (⚙️) in the Azure DevOps PR Viewer sidebar and enter your organization name.

**How to find your organization name:**

- If your URL is `https://dev.azure.com/myorg` → enter `myorg`
- If your URL is `https://myorg.visualstudio.com` → enter `myorg`

### 2. Sign In

1. Click "Sign in to Azure DevOps PR Viewer"
2. Authenticate with your Microsoft account
3. Approve Azure DevOps permissions

Your PRs will load automatically.

## Settings

- `azureDevOpsPRViewer.organization`: Your Azure DevOps organization name
- `azureDevOpsPRViewer.autoRefreshInterval`: Auto-refresh interval in seconds (default: 300, set to 0 to disable)
- `azureDevOpsPRViewer.maxPRsToFetch`: Maximum PRs to fetch per project (default: 500)
- `azureDevOpsPRViewer.enableInlineComments`: Enable inline comment CodeLens (default: true)
- `azureDevOpsPRViewer.codeLensInterval`: Show 'Add Comment' CodeLens every N lines (default: 1)

## Usage

### View PRs

PRs are displayed hierarchically:

- Projects (sorted alphabetically)
- Repositories within each project (sorted alphabetically)
- PRs within each repository (sorted by age, oldest first)

Click any PR to view details. Right-click to open in browser.

### Add Comments to PR Diffs

1. Click on a file in the PR viewer to open the diff
2. Click "Add Comment" CodeLens on any line
3. Enter your comment

Alternatively, right-click in the diff and select "Add PR Comment to Line".

### Troubleshooting

**Authentication Issues:**

- Sign out and back in from the Command Palette
- Ensure your Microsoft account has access to your Azure DevOps organization
- Verify your organization is connected to Microsoft Entra ID

**PRs Not Loading:**

- Click the refresh icon in the sidebar
- Check Output panel (View → Output) → "Azure DevOps PR Viewer" for errors
- Verify your organization name in settings

## Release Notes

### 1.0.0

Initial release
