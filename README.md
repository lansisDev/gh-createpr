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

Before using this tool, make sure you have:

- **Node.js** (v16 or higher)
- **Git** configured with your credentials
- **GitHub CLI** (`gh`) installed and authenticated
- **Jira API access** with appropriate permissions
- A repository with a `develop` branch (default base branch)

## 🛠️ Installation

### Install as GitHub CLI Extension

```bash
# Install directly from GitHub
gh extension install lansisDev/gh-createpr
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/lansisDev/gh-createpr.git
cd gh-createpr

# Install dependencies
npm install

# Build the project
npm run build

# Install as GitHub CLI extension
gh extension install .
```

## ⚙️ Configuration

Set up the required environment variables:

```bash
# Jira Configuration
export JIRA_BASE_URL="https://your-company.atlassian.net"
export JIRA_EMAIL="your-email@company.com"
export JIRA_API_TOKEN="your-jira-api-token"
```

### Getting Jira API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a descriptive name
4. Copy the generated token

### Environment Variables Setup

Add these to your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
# ~/.zshrc or ~/.bashrc
export JIRA_BASE_URL="https://your-company.atlassian.net"
export JIRA_EMAIL="your-email@company.com"  
export JIRA_API_TOKEN="your-jira-api-token"
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
🔍 Obteniendo datos de LAN-123 desde Jira...
🔍 Validando datos obtenidos de Jira...
✅ Título: Add user authentication feature
📝 Descripción: Implement OAuth2 authentication for user login
👥 Team: Frontend
🌿 Nueva rama: lan-123-add-user-authentication-feature
🔄 Cambiando a develop y actualizando...
🚧 Creando nueva rama: lan-123-add-user-authentication-feature
📝 Creando commit inicial...
⬆️  Subiendo rama a origin...
🚀 Creando Pull Request desde lan-123-add-user-authentication-feature hacia develop...
🎉 Pull Request creada desde 'lan-123-add-user-authentication-feature' hacia 'develop'
✅ Ahora estás en la rama 'lan-123-add-user-authentication-feature' con commit inicial subido
🔗 La PR está ready en GitHub
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
git tag v1.0.0
git push origin v1.0.0

# Create a GitHub release
gh release create v1.0.0 --title "v1.0.0" --notes "Initial release"
```

### 3. Update Manifest

Ensure `manifest.yml` has the correct tag version:

```yaml
name: createpr
owner: lansisDev
host: github.com
tag: v1.0.0
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

### Version 1.0.0
- Initial release
- Jira integration for ticket data fetching
- Automated branch creation and PR generation
- Team detection and proper PR formatting
- Comprehensive error handling

---

Made with ❤️ by [lansisDev](https://github.com/lansisDev)
