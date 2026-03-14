# Publishing Kubiq to VS Code Marketplace

## Prerequisites

1. Microsoft/GitHub account
2. Azure DevOps organization

## Step-by-Step

### 1. Create Azure DevOps Personal Access Token (PAT)

1. Go to https://dev.azure.com
2. Sign in with your Microsoft/GitHub account
3. Create an organization if you don't have one
4. Click your profile icon (top right) → **Personal access tokens**
5. Click **New Token**
6. Configure:
   - **Name**: `kubiq-vsce-publish`
   - **Organization**: Select **All accessible organizations**
   - **Expiration**: 1 year (max)
   - **Scopes**: Click **Custom defined** → check **Marketplace → Manage**
7. Click **Create** → **Copy the token** (you won't see it again)

### 2. Create a Publisher on VS Code Marketplace

1. Go to https://marketplace.visualstudio.com/manage
2. Click **Create publisher**
3. Fill in:
   - **Name**: `Kubiq`
   - **ID**: `kubiq` (must match `publisher` field in package.json)
   - **Description**: Kubernetes intelligence dashboard for VS Code
   - **Website**: https://github.com/maddinenisri/kubiq
4. Click **Create**

### 3. Login with vsce CLI

```bash
npx @vscode/vsce login kubiq
# Paste your PAT when prompted
```

### 4. Verify Package Builds Clean

```bash
npm run package
# Should output: kubiq-0.5.0.vsix with no errors
```

### 5. Publish

```bash
# First time — manual publish
npx @vscode/vsce publish

# Subsequent releases — publish with version bump
npx @vscode/vsce publish patch   # 0.5.0 → 0.5.1
npx @vscode/vsce publish minor   # 0.5.0 → 0.6.0
npx @vscode/vsce publish major   # 0.5.0 → 1.0.0
```

### 6. Verify on Marketplace

Your extension will appear at:

```
https://marketplace.visualstudio.com/items?itemName=kubiq.kubiq
```

## Automated Publishing (GitHub Actions)

A publish workflow is configured at `.github/workflows/publish.yml`.

### Setup

1. Go to GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `VSCE_PAT`
4. Value: paste your Azure DevOps PAT
5. Click **Add secret**

### Usage

Push a version tag to trigger auto-publish:

```bash
# Bump version in package.json
npm version patch   # or minor/major

# Push with tag
git push origin main --tags
```

The workflow runs: test → build → publish to marketplace.

## Publisher ID

The `publisher` field in `package.json` must match the publisher ID you created on the marketplace. Currently set to `kubiq`.

If you want to use a different publisher ID (e.g., `maddinenisri`):

```bash
# Update package.json
sed -i '' 's/"publisher": "kubiq"/"publisher": "maddinenisri"/' package.json

# Rebuild and publish
npm run package
npx @vscode/vsce publish
```

## Marketplace Metadata

These fields in `package.json` control what appears on the marketplace page:

| Field           | Purpose                       | Current Value                                   |
| --------------- | ----------------------------- | ----------------------------------------------- |
| `displayName`   | Extension name                | Kubiq                                           |
| `description`   | One-line summary              | Standalone Kubernetes intelligence dashboard... |
| `version`       | Semantic version              | 0.5.0                                           |
| `publisher`     | Publisher ID                  | kubiq                                           |
| `icon`          | Extension icon (128x128+ PNG) | media/kubiq-icon.png                            |
| `galleryBanner` | Marketplace banner color      | #0d0f14 (dark)                                  |
| `categories`    | Marketplace categories        | Other, Debuggers                                |
| `keywords`      | Search keywords               | kubernetes, k8s, eks, gke, aks, pod, ...        |
| `repository`    | GitHub link                   | github.com/maddinenisri/kubiq                   |
| `license`       | License type                  | MIT                                             |

## Troubleshooting

**"Access Denied" on publish:**

- Ensure PAT has **Marketplace → Manage** scope
- Ensure PAT is set to **All accessible organizations**
- Re-login: `npx @vscode/vsce login kubiq`

**"Publisher not found":**

- Create publisher at https://marketplace.visualstudio.com/manage first
- Publisher ID must match exactly (case-sensitive)

**Build fails during publish:**

- `vsce publish` runs `vscode:prepublish` script automatically
- Ensure both `npm install` and `cd webview-ui && npm install` are done
- Run `npm run package` locally first to verify

**Extension not appearing after publish:**

- Takes 5-10 minutes to appear on marketplace
- Check https://marketplace.visualstudio.com/manage for status
