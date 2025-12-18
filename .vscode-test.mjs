import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
	{
		label: 'unit',
		files: 'out/test/unit/**/*.test.js',
		version: 'stable',
		mocha: {
			ui: 'bdd',
			timeout: 10000,
			color: true
		}
	},
	{
		label: 'integration',
		files: 'out/test/integration/**/*.test.js',
		version: 'stable',
		mocha: {
			ui: 'bdd',
			timeout: 20000,
			color: true
		}
	},
	{
		label: 'e2e',
		files: 'out/test/e2e/**/*.test.js',
		version: 'stable',
		mocha: {
			ui: 'bdd',
			timeout: 30000,
			color: true
		}
	}
]);
