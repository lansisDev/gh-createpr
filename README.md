# gh-createpr

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![GitHub CLI Extension](https://img.shields.io/badge/GitHub_CLI-Extension-blue.svg)](https://cli.github.com/)

A powerful GitHub CLI extension that streamlines the process of creating GitHub Pull Requests directly from Jira tickets. This extension automates the entire workflow from ticket information extraction to PR creation, making development workflows more efficient and consistent.

## 🚀 Features

- **🎫 Jira Integration**: Automatically fetches ticket information including title, description, and team details
- **🌿 Branch Management**: Creates appropriately named feature branches based on ticket information
- **📝 Smart PR Creation**: Generates well-formatted Pull Requests with proper titles and descriptions
- **⚡ Workflow Automation**: Handles git operations including branch creation, commits, and pushes
- **🏷️ Team Detection**: Automatically detects and includes team information in PR titles
- **🔗 Cross-linking**: Links PRs back to their corresponding Jira tickets

## 📋 Prerequisites

Before using this extension, make sure you have:

- **GitHub CLI** (v2.0.0 or higher) - [Install here](https://cli.github.com/)
- **GitHub CLI authenticated** - Run `gh auth login` if not already done
- **Node.js** (v16 or higher) - Required for the extension runtime
- **Git** configured with your credentials
- **Jira API access** with appropriate permissions
- A repository with a `develop` branch (default base branch for PRs)

### Quick Setup Check

```bash
# Verify GitHub CLI is installed and authenticated
gh --version
gh auth status

# Verify Git is configured
git config --global user.name
git config --global user.email

# Verify Node.js version
node --version
```

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- **Node.js 18 or higher** (required for native fetch support)
- Access to Jira REST API with appropriate permissions

## Installation

### Quick Install (Recommended)

```bash
# Install the extension directly from GitHub
gh extension install lansisDev/gh-createpr
```

That's it! The extension is now available as `gh createpr`.

### Verify Installation

```bash
# Check if the extension is installed
gh extension list

# Test the extension
gh createpr --help
```

### Prerequisites for GitHub CLI Extensions

Before installing, ensure you have:

1. **GitHub CLI installed**: [Download here](https://cli.github.com/) or install via:
   ```bash
   # macOS
   brew install gh
   
   # Windows
   winget install --id GitHub.cli
   
   # Linux (Ubuntu/Debian)
   sudo apt install gh
   ```

2. **GitHub CLI authenticated**:
   ```bash
   gh auth login
   ```

### Manual Installation (for Development)

If you want to contribute or modify the extension:

```bash
# Clone the repository
git clone https://github.com/lansisDev/gh-createpr.git
cd gh-createpr

# Install dependencies
npm install

# Build the project
npm run build

# Install as local GitHub CLI extension
gh extension install .
```

### Troubleshooting Installation

If you encounter issues:

```bash
# Uninstall and reinstall
gh extension remove createpr
gh extension install lansisDev/gh-createpr

# Check GitHub CLI version (requires v2.0.0+)
gh --version

# Verify GitHub CLI authentication
gh auth status
```

## 🚀 Quick Start

1. **Install the extension**:
   ```bash
   gh extension install lansisDev/gh-createpr
   ```

2. **Set up Jira credentials** (see [Configuration](#%EF%B8%8F-configuration) section below):
   ```bash
   export JIRA_BASE_URL="https://your-company.atlassian.net"
   export JIRA_EMAIL="your-email@company.com"
   export JIRA_API_TOKEN="your-jira-api-token"
   ```

3. **Navigate to your git repository** and run:
   ```bash
   gh createpr LAN-123
   ```

That's it! The extension will create a branch, commit, and pull request automatically.

## ⚙️ Configuration

### Required Environment Variables

The extension requires these Jira credentials to fetch ticket information:

```bash
export JIRA_BASE_URL="https://your-company.atlassian.net"
export JIRA_EMAIL="your-email@company.com"
export JIRA_API_TOKEN="your-jira-api-token"
```

### Step-by-Step Configuration

#### 1. Get Your Jira API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a descriptive name (e.g., "gh-createpr-extension")
4. Copy the generated token (save it securely!)

#### 2. Find Your Jira Details

- **JIRA_BASE_URL**: Your company's Jira URL (e.g., `https://mycompany.atlassian.net`)
- **JIRA_EMAIL**: The email address associated with your Jira account

#### 3. Set Environment Variables

**Option A: Temporary (current session only)**
```bash
export JIRA_BASE_URL="https://your-company.atlassian.net"
export JIRA_EMAIL="your-email@company.com"
export JIRA_API_TOKEN="your-jira-api-token"
```

**Option B: Permanent (recommended)**

Add to your shell profile file (`~/.zshrc`, `~/.bashrc`, or `~/.bash_profile`):

```bash
# GitHub CLI createpr extension - Jira Configuration
export JIRA_BASE_URL="https://your-company.atlassian.net"
export JIRA_EMAIL="your-email@company.com"
export JIRA_API_TOKEN="your-jira-api-token"
```

Then reload your shell:
```bash
source ~/.zshrc  # or ~/.bashrc
```

#### 4. Verify Configuration

```bash
# Test that environment variables are set
echo $JIRA_BASE_URL
echo $JIRA_EMAIL
echo $JIRA_API_TOKEN

# Test the extension with a real ticket
gh createpr YOUR-TICKET-123
```

## 🎯 Usage

### Basic Usage

```bash
gh createpr <JIRA_TICKET>
```

### Examples

```bash
# Create PR for ticket LAN-123
gh createpr LAN-123

# Create PR for ticket PROJ-456
gh createpr PROJ-456
```

### What the tool does:

1. **Fetches Jira ticket data** including title, description, and team information
2. **Switches to develop branch** and pulls latest changes
3. **Creates a new feature branch** with format: `{ticket-id}-{slugified-title}`
4. **Makes an initial commit** with a conventional commit message
5. **Pushes the branch** to the remote repository
6. **Creates a Pull Request** with proper title and description linking back to Jira

### Example Output

```bash
🔍 Fetching data for LAN-123 from Jira...
🔍 Validating data obtained from Jira...
✅ Title: Add user authentication feature
📝 Description: Implement OAuth2 authentication for user login
👥 Team: Frontend
🌿 New branch: lan-123-add-user-authentication-feature
🔄 Switching to develop and updating...
🚧 Creating new branch: lan-123-add-user-authentication-feature
📝 Creating initial commit...
⬆️  Pushing branch to origin...
🚀 Creating Pull Request from lan-123-add-user-authentication-feature to develop...
🎉 Pull Request created from 'lan-123-add-user-authentication-feature' to 'develop'
✅ You are now on branch 'lan-123-add-user-authentication-feature' with initial commit pushed
🔗 The PR is ready on GitHub
```

## 📁 Project Structure

```
gh-createpr/
├── src/
│   └── index.ts          # Main CLI application
├── dist/                 # Compiled JavaScript output
├── manifest.yml          # GitHub CLI extension manifest
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
├── LICENSE              # ISC License
└── README.md            # This file
```

## 🛠️ Development

### Available Scripts

```bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Start the built version
npm start

# Prepare for publishing
npm run prepare
```

### Building from Source

```bash
# Clone and setup
git clone https://github.com/lansisDev/gh-createpr.git
cd gh-createpr
npm install

# Build
npm run build

# Test the extension locally
gh createpr LAN-123
```

## 🏗️ Architecture

This GitHub CLI extension is built with:

- **TypeScript** for type safety and modern JavaScript features
- **Commander.js** for CLI argument parsing and command structure
- **Node-fetch** for HTTP requests to Jira API
- **Node.js Child Process** for Git operations
- **GitHub CLI** as the platform for the extension

### Key Components

- **Jira API Integration**: Fetches ticket data using REST API
- **Git Operations**: Automated branch management and commits
- **GitHub CLI Integration**: Leverages `gh pr create` for PR creation
- **Data Processing**: Intelligent parsing of ticket information and team detection

## 🔧 Configuration Options

### Branch Naming

Branches are automatically named using the format:
```
{ticket-id-lowercase}-{slugified-title}
```

Example: `lan-123-add-user-authentication-feature`

### PR Title Format

```
[{JIRA_TICKET}][{TEAM}] {TITLE}
```

Example: `[LAN-123][Frontend] Add user authentication feature`

### Commit Message Format

```
feat({JIRA_TICKET}): initial commit for {TITLE}
```

Example: `feat(LAN-123): initial commit for Add user authentication feature`

## 🚨 Error Handling

The extension includes comprehensive error handling for:

- **Missing environment variables**
- **Invalid Jira tickets**
- **Network connectivity issues**
- **Git operation failures**
- **GitHub CLI authentication problems**

## 📦 Extension Management

```bash
# List installed extensions
gh extension list

# Upgrade the extension
gh extension upgrade createpr

# Uninstall the extension
gh extension remove createpr
```

## 🚀 Publishing the Extension

To make the extension available for installation via `gh extension install lansisDev/gh-createpr`:

### 1. Build and Prepare

```bash
# Build the project
npm run build

# Make the binary executable
chmod +x dist/index.js
```

### 2. Create a Release

```bash
# Create and push a tag
git tag v1.1.0
git push origin v1.1.0

# Create a GitHub release
gh release create v1.1.0 --title "v1.1.0" --notes "English translation release"
```

### 3. Update Manifest

Ensure `manifest.yml` has the correct tag version:

```yaml
name: createpr
owner: lansisDev
host: github.com
tag: v1.1.0
```

### 4. Test Installation

```bash
# Test the installation
gh extension install lansisDev/gh-createpr

# Verify it works
gh createpr --help
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Gonzalo Buasso**

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/lansisDev/gh-createpr/issues) page
2. Create a new issue with detailed information about your problem
3. Include relevant error messages and environment details

## 🔄 Changelog

### Version 1.1.0
- **English Translation**: Translated all Spanish text to English for international accessibility
- **Improved User Interface**: All console messages, error messages, and help text now in English
- **Better Documentation**: Example output updated to reflect English interface
- **Enhanced Usability**: More professional appearance for global developer community

### Version 1.0.0
- Initial release
- Jira integration for ticket data fetching
- Automated branch creation and PR generation
- Team detection and proper PR formatting
- Comprehensive error handling

---

Made with ❤️ by [lansisDev](https://github.com/lansisDev)
