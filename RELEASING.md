# Manual Release Process

## Prerequisites

1. Install vsce globally:
   ```bash
   npm install -g @vscode/vsce
   ```

2. Get a Personal Access Token (PAT) from Azure DevOps:
   - Go to https://dev.azure.com/
   - User Settings > Personal Access Tokens
   - Create token with **Marketplace > Manage** scope
   - Save the token securely

## Release Steps

### 1. Prepare the Release

```bash
# Ensure you're on master and up to date
git checkout master
git pull origin master

# Run tests and lint
npm test
npm run lint

# Build to verify everything compiles
npm run compile
```

### 2. Update Version

Edit `package.json` and update the `version` field, then update `CHANGELOG.md` with the new version's changes.

### 3. Commit and Push

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z"
git push origin master
```

### 4. Create Git Tag (Optional)

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

### 5. Publish to VS Code Marketplace

```bash
# Login (first time only, or if token expired)
vsce login johncwaters

# Publish
npm run publish
```

Or publish with the PAT inline:
```bash
vsce publish -p YOUR_PAT_TOKEN
```

### 6. Verify

- Check https://marketplace.visualstudio.com/items?itemName=johncwaters.azdopr
- Verify the new version appears (may take a few minutes)

## Creating a VSIX for Manual Distribution

```bash
npm run package:vsix
```

This creates a `.vsix` file you can share or install manually via:
- VS Code > Extensions > ... > Install from VSIX
