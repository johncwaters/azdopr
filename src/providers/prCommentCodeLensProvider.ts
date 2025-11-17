import * as vscode from "vscode";
import { PRContextManager } from "../services/prContextManager";

/**
 * CodeLens provider that adds "Add Comment" actions to lines in PR diff views
 */
export class PRCommentCodeLensProvider implements vscode.CodeLensProvider {
	private readonly _onDidChangeCodeLenses: vscode.EventEmitter<void> =
		new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> =
		this._onDidChangeCodeLenses.event;

	/**
	 * Refresh the CodeLens display
	 */
	public refresh(): void {
		this._onDidChangeCodeLenses.fire();
	}

	/**
	 * Provide CodeLens items for a document
	 */
	public provideCodeLenses(
		document: vscode.TextDocument,
	): vscode.ProviderResult<vscode.CodeLens[]> {
		// Check if inline comments are enabled
		const config = vscode.workspace.getConfiguration("azureDevOpsPRViewer");
		const enabled = config.get<boolean>("enableInlineComments", true);
		if (!enabled) {
			return [];
		}

		// Only show CodeLens for PR diff files
		if (!this.isPRDiffDocument(document)) {
			return [];
		}

		const codeLenses: vscode.CodeLens[] = [];
		const contextManager = PRContextManager.getInstance();
		const fileContext = contextManager.getPRFileContext(document.uri);

		if (!fileContext) {
			return [];
		}

		// Don't show CodeLens on deleted files (base side of delete changes)
		const isDeletedFile =
			fileContext.changeType.includes("delete") && fileContext.side === "base";
		if (isDeletedFile) {
			return [];
		}

		// Add CodeLens to every line in the document
		// We'll add them at intervals to avoid cluttering the UI
		const lineCount = document.lineCount;
		const interval = this.getCodeLensInterval();

		for (let i = 0; i < lineCount; i += interval) {
			const line = document.lineAt(i);
			const range = new vscode.Range(i, 0, i, line.text.length);

			const codeLens = new vscode.CodeLens(range, {
				title: "$(comment) Add Comment",
				tooltip: "Add a comment to this line in the pull request",
				command: "azureDevOpsPRs.addLineCommentFromCodeLens",
				arguments: [document.uri, i + 1], // Pass 1-based line number
			});

			codeLenses.push(codeLens);
		}

		return codeLenses;
	}

	/**
	 * Check if a document is a PR diff document
	 */
	private isPRDiffDocument(document: vscode.TextDocument): boolean {
		return document.uri.scheme === "azdo-pr";
	}

	/**
	 * Get the interval for showing CodeLens (every N lines)
	 * This can be configured via settings
	 */
	private getCodeLensInterval(): number {
		const config = vscode.workspace.getConfiguration("azureDevOpsPRViewer");
		return config.get<number>("codeLensInterval", 1); // Default: show on every line
	}
}
