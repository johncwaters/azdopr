import * as vscode from "vscode";
import { PRContextManager } from "../services/prContextManager";

/**
 * Provides gutter decorations for adding comments to PR diff lines
 * This creates a clickable icon in the gutter that allows users to add comments
 */
export class PRCommentDecorationProvider {
	private readonly decorationType: vscode.TextEditorDecorationType;
	private readonly disposables: vscode.Disposable[] = [];

	constructor() {
		// Create a decoration type for the comment icon in the gutter
		// Note: Currently using CodeLens instead of gutter decorations
		this.decorationType = vscode.window.createTextEditorDecorationType({
			// gutterIconPath would require a file path or URI, not a ThemeIcon
			// If re-enabled, provide an actual icon file path here
		});

		// Listen for active editor changes
		this.disposables.push(
			vscode.window.onDidChangeActiveTextEditor((editor) => {
				if (editor) {
					this.updateDecorations(editor);
				}
			}),
			vscode.workspace.onDidChangeTextDocument((event) => {
				const editor = vscode.window.activeTextEditor;
				if (editor && event.document === editor.document) {
					this.updateDecorations(editor);
				}
			}),
		);

		// Update decorations for the current editor
		if (vscode.window.activeTextEditor) {
			this.updateDecorations(vscode.window.activeTextEditor);
		}
	}

	/**
	 * Update decorations for an editor
	 */
	private updateDecorations(editor: vscode.TextEditor): void {
		const document = editor.document;

		// Only show decorations for PR diff files
		if (!this.isPRDiffDocument(document)) {
			editor.setDecorations(this.decorationType, []);
			return;
		}

		const contextManager = PRContextManager.getInstance();
		const fileContext = contextManager.getPRFileContext(document.uri);

		if (!fileContext) {
			editor.setDecorations(this.decorationType, []);
			return;
		}

		// Don't show decorations on deleted files
		const isDeletedFile =
			fileContext.changeType.includes("delete") && fileContext.side === "base";
		if (isDeletedFile) {
			editor.setDecorations(this.decorationType, []);
			return;
		}

		// For now, we'll use CodeLens instead of gutter decorations
		// Gutter decorations are less interactive in VS Code
		// This class is kept for potential future enhancements
		editor.setDecorations(this.decorationType, []);
	}

	/**
	 * Check if a document is a PR diff document
	 */
	private isPRDiffDocument(document: vscode.TextDocument): boolean {
		return document.uri.scheme === "azdo-pr";
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		this.decorationType.dispose();
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}
