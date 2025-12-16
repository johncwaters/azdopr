# Contributing to Azure DevOps PR Viewer

Thank you for your interest in contributing to Azure DevOps PR Viewer! This document provides guidelines and instructions for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 16 or higher
- npm (comes with Node.js)
- Visual Studio Code
- Git

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/azdopr.git
   cd azdopr
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Configure your Azure DevOps organization** (optional, for testing):
   - Open VS Code settings
   - Set `azureDevOpsPRViewer.organization` to your Azure DevOps organization name

## Development Workflow

### Building the Extension

- **Development build with watch mode**:
  ```bash
  npm run watch
  ```
  This will automatically recompile when you make changes.

- **Production build**:
  ```bash
  npm run compile
  ```

### Running and Debugging

1. Open the project in Visual Studio Code
2. Press `F5` to launch the Extension Development Host
3. This opens a new VS Code window with the extension loaded
4. Make changes to the code and reload the window to see updates

### Code Quality

We use Biome for linting and code formatting. Before submitting a pull request:

```bash
npm run lint
```

Fix any linting errors before committing your changes.

### Testing

Run the test suite:

```bash
npm test
```

Please ensure all tests pass before submitting a pull request.

## Making Contributions

### Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) to file bug reports. Include:

- A clear description of the issue
- Steps to reproduce the problem
- Expected vs. actual behavior
- Your environment (VS Code version, OS, extension version)
- Screenshots or error messages if applicable

### Suggesting Features

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) to suggest new features. Describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternative solutions you've considered

### Submitting Pull Requests

1. **Create a new branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
   or
   ```bash
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes** following our coding conventions:
   - Write clear, self-documenting code
   - Follow TypeScript best practices
   - Keep functions focused and modular
   - Add comments for complex logic

3. **Test your changes** thoroughly:
   - Run the extension in the Extension Development Host
   - Test with real Azure DevOps PRs if possible
   - Ensure all tests pass: `npm test`
   - Run the linter: `npm run lint`

4. **Commit your changes** with clear, descriptive commit messages:
   ```bash
   git add .
   git commit -m "feat: add support for filtering PRs by author"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** on GitHub:
   - Fill out the pull request template
   - Link any related issues
   - Describe your changes clearly
   - Include screenshots for UI changes

### Commit Message Guidelines

We follow conventional commit format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Build process or auxiliary tool changes

Example: `feat: add comment editing functionality`

## Project Structure

```
azdopr/
├── src/
│   ├── auth/                 # Authentication logic
│   ├── constants/            # Configuration constants
│   ├── providers/            # VS Code UI providers
│   ├── services/             # Core business logic
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utility functions
│   ├── views/                # UI views and webviews
│   └── extension.ts          # Extension entry point
├── resources/                # Static assets
├── .github/                  # GitHub templates
└── package.json              # Extension manifest
```

## Coding Conventions

- Use TypeScript's strict mode
- Prefer `const` over `let`
- Use descriptive variable and function names
- Keep functions small and focused
- Add JSDoc comments for public APIs
- Handle errors gracefully
- Use async/await for asynchronous operations

## Questions?

If you have questions or need help:

1. Check existing issues and discussions
2. Open a new issue with the "question" label
3. Reach out via the project's GitHub issues

## License

By contributing to Azure DevOps PR Viewer, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing!
