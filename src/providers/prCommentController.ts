import * as vscode from "vscode";
import { PRContextManager } from "../services/prContextManager";
import type {
	AzureDevOpsClient,
	PRThread,
} from "../services/azureDevOpsClient";
import {
	ConventionalCommentLabel,
	type ConventionalCommentDecoration,
	LABEL_METADATA,
	DECORATION_METADATA,
	formatConventionalComment,
	type ConventionalComment,
} from "../types/conventionalComments";
import { processCommentContent } from "../utils/markdownProcessor";

/**
 * Metadata stored for each comment thread
 */
interface CommentThreadMetadata {
	/** The Azure DevOps PR thread ID */
	prThreadId?: number;
	/** Map of comment body hash to comment ID for finding comments */
	commentIdMap?: Map<string, number>;
	/** PR context for API calls */
	prContext?: {
		projectId: string;
		repositoryId: string;
		pullRequestId: number;
	};
}

/**
 * ============================================================================
 * PRCommentController - CRITICAL COMPONENT FOR INLINE COMMENT DISPLAY
 * ============================================================================
 *
 * This controller is responsible for displaying Azure DevOps PR comments
 * inline in file diff views. It uses VS Code's native Comment API to:
 *
 * 1. Fetch PR thread comments from Azure DevOps API
 * 2. Filter comments relevant to the current file
 * 3. Display comments at the correct line numbers in diff views
 * 4. Allow users to add new comments and reply to existing threads
 *
 * HOW IT WORKS:
 * - When a PR diff document (scheme: "azdo-pr") is opened/activated
 * - Event listeners in extension.ts call loadCommentsForDocument()
 * - This fetches all PR threads and filters by file path
 * - Comments are displayed using VS Code's Comment API
 * - Comments appear as decorations in the editor gutter
 *
 * DEPENDENCIES:
 * - Requires PRContextManager to associate files with PR data
 * - Requires event listeners in extension.ts (onDidOpenTextDocument, onDidChangeActiveTextEditor)
 * - Virtual documents created by PullRequestViewerPanel with "azdo-pr" scheme
 *
 * DO NOT MODIFY WITHOUT TESTING:
 * - Changes can break inline comment display in diff views
 * - Test by: opening a PR, clicking a file with comments, verify comments appear
 *
 * @see extension.ts for event listener setup
 * @see PullRequestViewerPanel._openFileDiff for virtual document creation
 */
export class PRCommentController {
	private readonly commentController: vscode.CommentController;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly commentThreads: Map<string, vscode.CommentThread> =
		new Map();
	/** Metadata storage for comment threads, keyed by thread key */
	private readonly threadMetadata: Map<string, CommentThreadMetadata> =
		new Map();
	/** Track documents currently being loaded to prevent duplicate loads */
	private readonly loadingDocuments: Set<string> = new Set();

	constructor(private readonly azureDevOpsClient: AzureDevOpsClient) {
		console.log("[PRCommentController] Initializing PR Comment Controller");

		// Create the comment controller
		this.commentController = vscode.comments.createCommentController(
			"azdo-pr-comments",
			"Azure DevOps PR Viewer Comments",
		);

		// Configure comment controller options
		this.commentController.options = {
			prompt: "Add a comment",
			placeHolder: "Write your comment here...",
		};

		this.setupCommentingRangeProvider();

		this.disposables.push(
			vscode.commands.registerCommand(
				"azdo-pr-comments.createOrReplyComment",
				async (reply: vscode.CommentReply) => {
					await this.handleCommentSubmit(reply);
				},
			),
			vscode.commands.registerCommand(
				"azdo-pr-comments.createConventionalComment",
				async (reply: vscode.CommentReply) => {
					await this.handleConventionalCommentCreate(reply);
				},
			),
			vscode.commands.registerCommand(
				"azdo-pr-comments.editComment",
				async (comment: vscode.Comment) => {
					await this.handleEditComment(comment);
				},
			),
			vscode.commands.registerCommand(
				"azdo-pr-comments.deleteComment",
				async (comment: vscode.Comment) => {
					await this.handleDeleteComment(comment);
				},
			),
			vscode.commands.registerCommand(
				"azdo-pr-comments.resolveThread",
				async (thread: vscode.CommentThread) => {
					await this.handleResolveThread(thread);
				},
			),
			vscode.commands.registerCommand(
				"azdo-pr-comments.unresolveThread",
				async (thread: vscode.CommentThread) => {
					await this.handleUnresolveThread(thread);
				},
			),
		);
	}

	/**
	 * Initialize the comment controller and load comments for the current editor.
	 * This should be called after construction to avoid async operations in the constructor.
	 */
	public async initialize(): Promise<void> {
		// Load comments for the current editor
		if (vscode.window.activeTextEditor) {
			console.log(
				`[PRCommentController] Loading comments for current editor: ${vscode.window.activeTextEditor.document.uri.toString()}`,
			);
			await this.loadCommentsForDocument(
				vscode.window.activeTextEditor.document,
			);
		} else {
			console.log("[PRCommentController] No active editor on initialization");
		}
	}

	/**
	 * Setup the commenting range provider for the comment controller
	 */
	private setupCommentingRangeProvider(): void {
		this.commentController.commentingRangeProvider = {
			provideCommentingRanges: (
				document: vscode.TextDocument,
			): vscode.Range[] | undefined => {
				// Allow commenting on any line in PR diff documents
				if (document.uri.scheme === "azdo-pr") {
					const lineCount = document.lineCount;
					return [new vscode.Range(0, 0, lineCount - 1, 0)];
				}
				return undefined;
			},
		};
	}

	/**
	 * Load and display comments for a document
	 *
	 * CRITICAL METHOD - Called by event listeners in extension.ts
	 * This is the main entry point for loading comments when:
	 * - A PR diff document is first opened
	 * - User switches to a PR diff tab
	 *
	 * @param document The text document to load comments for (must have scheme "azdo-pr")
	 */
	public async loadCommentsForDocument(
		document: vscode.TextDocument,
	): Promise<void> {
		const uriString = document.uri.toString();
		console.log(
			`[PRCommentController] loadCommentsForDocument called for: ${uriString} (scheme: ${document.uri.scheme})`,
		);

		// Only process PR diff documents
		if (document.uri.scheme !== "azdo-pr") {
			console.log(
				`[PRCommentController] Skipping document - wrong scheme: ${document.uri.scheme}`,
			);
			return;
		}

		// Prevent duplicate loads for the same document
		if (this.loadingDocuments.has(uriString)) {
			console.log(
				`[PRCommentController] Already loading comments for: ${uriString}`,
			);
			return;
		}
		this.loadingDocuments.add(uriString);

		const contextManager = PRContextManager.getInstance();
		const fileContext = contextManager.getPRFileContext(document.uri);

		if (!fileContext) {
			console.log(
				`[PRCommentController] No file context found for: ${document.uri.toString()}`,
			);
			return;
		}

		console.log(
			`[PRCommentController] File context found - PR #${fileContext.pullRequest.pullRequestId}, file: ${fileContext.filePath}, side: ${fileContext.side}`,
		);

		// Clean up existing comment threads for this document
		this.clearCommentsForDocument(document.uri);

		try {
			// Fetch PR threads
			const threads = await this.azureDevOpsClient.getPullRequestThreads(
				fileContext.pullRequest.repository.project.id,
				fileContext.pullRequest.repository.id,
				fileContext.pullRequest.pullRequestId,
			);

			console.log(
				`Fetched ${threads.length} total threads for PR #${fileContext.pullRequest.pullRequestId}`,
			);

			// Filter threads for this file
			console.log(`[PRCommentController] Filtering threads for file: "${fileContext.filePath}"`);
			console.log(`[PRCommentController] Normalized current path: "${this.normalizePath(fileContext.filePath)}"`);

			const fileThreads = threads.filter((thread) => {
				if (!thread.threadContext?.filePath) {
					return false;
				}
				// Normalize file paths for comparison
				const threadPath = this.normalizePath(thread.threadContext.filePath);
				const currentPath = this.normalizePath(fileContext.filePath);
				const matches = threadPath === currentPath;

				if (thread.comments && thread.comments.length > 0) {
					console.log(`[PRCommentController] Thread ${thread.id}: path="${thread.threadContext.filePath}", normalized="${threadPath}", matches=${matches}`);
				}

				return matches;
			});

			console.log(
				`[PRCommentController] Found ${fileThreads.length} threads for file: ${fileContext.filePath} (side: ${fileContext.side})`,
			);

			if (fileThreads.length > 0) {
				console.log(`[PRCommentController] Matched threads:`, fileThreads.map(t => ({
					id: t.id,
					filePath: t.threadContext?.filePath,
					commentCount: t.comments?.length || 0,
				})));
			}

			// Create comment threads for this document
			let createdCount = 0;
			const prContext = {
				projectId: fileContext.pullRequest.repository.project.id,
				repositoryId: fileContext.pullRequest.repository.id,
				pullRequestId: fileContext.pullRequest.pullRequestId,
			};
			for (const thread of fileThreads) {
				await this.createCommentThread(document, thread, fileContext.side, prContext);
				createdCount++;
			}

			console.log(
				`Created ${createdCount} comment threads in the editor for ${fileContext.filePath}`,
			);
		} catch (error) {
			console.error("Failed to load comments for document:", error);
		} finally {
			// Always remove from loading set when done
			this.loadingDocuments.delete(uriString);
		}
	}

	/**
	 * Clear all comment threads for a specific document
	 */
	private clearCommentsForDocument(uri: vscode.Uri): void {
		const uriString = uri.toString();
		const threadsToRemove: string[] = [];

		for (const [key, thread] of this.commentThreads) {
			if (key.startsWith(uriString)) {
				thread.dispose();
				threadsToRemove.push(key);
			}
		}

		for (const key of threadsToRemove) {
			this.commentThreads.delete(key);
			this.threadMetadata.delete(key);
		}
	}

	/**
	 * Normalize file path for comparison (remove leading slash, normalize separators)
	 */
	private normalizePath(path: string): string {
		return path.replace(/^\/+/, "").replaceAll('\\', "/").toLowerCase();
	}

	/**
	 * Check if comment content contains code suggestions
	 */
	private hasSuggestion(content: string): boolean {
		return /```suggestion/i.test(content);
	}

	/**
	 * Create a VS Code comment thread from a PR thread
	 */
	private async createCommentThread(
		document: vscode.TextDocument,
		thread: PRThread,
		side: "base" | "modified",
		prContext: {
			projectId: string;
			repositoryId: string;
			pullRequestId: number;
		},
	): Promise<void> {
		// Determine which line to show the comment on based on the side
		// Try the primary side first, then fall back to the other side
		// This handles cases where comments are on deleted/added lines
		let lineNumber: number | undefined;
		let usedSide: string;

		if (side === "modified") {
			// For the modified side, prefer the right file position
			lineNumber = thread.threadContext?.rightFileStart?.line;
			usedSide = "right";

			// Fall back to left side if right side not available
			// This happens when comment is on a deleted line in base
			if (!lineNumber || lineNumber < 1) {
				lineNumber = thread.threadContext?.leftFileStart?.line;
				usedSide = "left (fallback)";
			}
		} else {
			// For the base side, prefer the left file position
			lineNumber = thread.threadContext?.leftFileStart?.line;
			usedSide = "left";

			// Fall back to right side if left side not available
			// This happens when comment is on an added line in modified
			if (!lineNumber || lineNumber < 1) {
				lineNumber = thread.threadContext?.rightFileStart?.line;
				usedSide = "right (fallback)";
			}
		}

		// If no line number is available on either side, this is a file-level comment
		// File-level comments should appear in the Conversation tab, not inline in the diff
		if (!lineNumber || lineNumber < 1) {
			console.log(
				`Skipping thread ${thread.id}: File-level comment (no specific line). This should appear in Conversation tab.`,
			);
			console.log(
				`Thread ${thread.id} threadContext:`,
				JSON.stringify(thread.threadContext, null, 2)
			);
			return;
		}

		console.log(
			`Thread ${thread.id}: Using ${usedSide} line number ${lineNumber} for ${side} document`,
		);

		// Convert to 0-based line number
		const zeroBasedLine = lineNumber - 1;

		// Ensure line number is within document bounds
		if (zeroBasedLine >= document.lineCount) {
			console.log(
				`Skipping thread ${thread.id}: Line ${lineNumber} is out of bounds (document has ${document.lineCount} lines)`,
			);
			return;
		}

		// Create range for the comment
		const range = new vscode.Range(zeroBasedLine, 0, zeroBasedLine, 0);

		// Get current user for permission checks
		let currentUserId: string | undefined;
		try {
			const currentUser = await this.azureDevOpsClient.getCurrentUser();
			currentUserId = currentUser.id;
		} catch (error) {
			console.warn("Failed to get current user for context value:", error);
		}

		// Get organization URL for markdown processing
		let organizationUrl: string | undefined;
		try {
			organizationUrl = this.azureDevOpsClient.getOrganizationUrl();
		} catch (error) {
			// Organization not configured, markdown processor will work without links
			console.warn("Organization URL not available for markdown processing:", error);
		}

		// Create comment ID map for metadata
		const commentIdMap = new Map<string, number>();

		// Create comment objects that conform to vscode.Comment interface
		const comments: vscode.Comment[] = thread.comments.map((comment) => {
			// Determine context values for this comment
			const contextValues: string[] = [];

			// Check if user can edit/delete (must be comment author)
			if (currentUserId && comment.author.id === currentUserId) {
				contextValues.push('canEdit', 'canDelete');
			}

			// Check if comment has suggestion code
			if (this.hasSuggestion(comment.content)) {
				contextValues.push('hasSuggestion');
			}

			const vscodeComment: vscode.Comment = {
				body: processCommentContent(comment.content, organizationUrl),
				mode: vscode.CommentMode.Preview,
				author: {
					name: comment.author.displayName,
					iconPath: comment.author.imageUrl
						? vscode.Uri.parse(comment.author.imageUrl)
						: undefined,
				},
				timestamp: comment.publishedDate,
				label: comment.commentType === "1" ? "Pending" : undefined,
				contextValue: contextValues.length > 0 ? contextValues.join(',') : undefined,
			};

			// Store comment ID in metadata map using comment body as key
			commentIdMap.set(comment.content, comment.id);

			return vscodeComment;
		});

		// Create the comment thread
		const commentThread = this.commentController.createCommentThread(
			document.uri,
			range,
			comments,
		);

		// Set thread properties
		const statusNum = typeof thread.status === 'string' ? Number.parseInt(thread.status, 10) : thread.status;

		// Set thread state based on status
		// Status 2 = Resolved, Status 4 = Closed
		if (statusNum === 2 || statusNum === 4) {
			commentThread.state = vscode.CommentThreadState.Resolved;
		} else {
			commentThread.state = vscode.CommentThreadState.Unresolved;
		}

		// Only show label for non-active threads (resolved, closed, etc.)
		if (statusNum !== undefined && statusNum !== null && statusNum !== 1 && statusNum !== 0) {
			commentThread.label = this.getThreadStatusLabel(thread.status);
		}
		commentThread.canReply = true;
		commentThread.collapsibleState =
			vscode.CommentThreadCollapsibleState.Expanded;

		// Track this comment thread for cleanup
		const threadKey = `${document.uri.toString()}#${thread.id}`;
		this.commentThreads.set(threadKey, commentThread);

		// Store thread metadata for future operations
		this.threadMetadata.set(threadKey, {
			prThreadId: thread.id,
			commentIdMap,
			prContext,
		});

		console.log(
			`Created comment thread ${thread.id} at line ${lineNumber} with ${comments.length} comment(s)`,
		);
	}

	/**
	 * Get the metadata for a comment thread by searching through stored threads
	 */
	private getThreadMetadata(
		thread: vscode.CommentThread,
	): CommentThreadMetadata | undefined {
		// Search for this thread in our stored threads
		for (const [key, storedThread] of this.commentThreads) {
			if (storedThread === thread) {
				return this.threadMetadata.get(key);
			}
		}
		return undefined;
	}

	/**
	 * Handle comment submission (both new threads and replies)
	 */
	private async handleCommentSubmit(reply: vscode.CommentReply): Promise<void> {
		try {
			const commentText = reply.text.trim();
			if (!commentText) {
				vscode.window.showWarningMessage("Comment cannot be empty");
				return;
			}

			// Get PR context from the document
			const contextManager = PRContextManager.getInstance();
			const fileContext = contextManager.getPRFileContext(reply.thread.uri);

			if (!fileContext) {
				vscode.window.showErrorMessage("No PR context found for this file");
				return;
			}

			const pr = fileContext.pullRequest;
			const metadata = this.getThreadMetadata(reply.thread);
			const prThreadId = metadata?.prThreadId;

			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: prThreadId ? "Adding reply..." : "Creating comment...",
					cancellable: false,
				},
				async (progress) => {
					progress.report({ increment: 0 });

					if (prThreadId) {
						// Reply to existing thread
						await this.azureDevOpsClient.replyToPRThread(
							pr.repository.project.id,
							pr.repository.id,
							pr.pullRequestId,
							prThreadId,
							commentText,
						);
					} else {
						// Create new thread
						if (!reply.thread.range) {
							throw new Error("Cannot create new thread without a range");
						}
						const lineNumber = reply.thread.range.start.line + 1;
						await this.azureDevOpsClient.createPRThread(
							pr.repository.project.id,
							pr.repository.id,
							pr.pullRequestId,
							fileContext.filePath,
							lineNumber,
							commentText,
							fileContext.side,
						);
					}

					progress.report({ increment: 100 });
				},
			);

			// Find the document for the thread URI
			const document = vscode.workspace.textDocuments.find(
				(doc) => doc.uri.toString() === reply.thread.uri.toString(),
			);

			// Refresh comments to show the new comment
			if (document) {
				await this.loadCommentsForDocument(document);
			}

			vscode.window.showInformationMessage(
				prThreadId ? "Reply added successfully" : "Comment added successfully",
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			vscode.window.showErrorMessage(`Failed to add comment: ${errorMessage}`);
			console.error("Error adding comment:", error);
		}
	}

	/**
	 * Handle conventional comment creation flow
	 * This method guides the user through selecting a label and decorations,
	 * then shows an editable preview before submission
	 */
	private async handleConventionalCommentCreate(
		reply: vscode.CommentReply,
	): Promise<void> {
		try {
			// Step 1: Select label
			const label = await this.selectCommentLabel();
			if (!label) {
				return; // User cancelled
			}

			// Step 2: Select decorations (optional)
			const decorations = await this.selectCommentDecorations();
			// User can cancel decorations, we'll continue with empty array

			// Step 3: Get the comment subject
			let commentText = reply.text.trim();

			// If the user already typed something, use it as the subject
			// Otherwise, prompt for it
			if (!commentText) {
				const promptedText = await this.promptForCommentSubject(label);
				if (!promptedText) {
					return; // User cancelled
				}
				commentText = promptedText;
			}

			// Step 4: Optionally ask for discussion/reasoning
			const discussion = await this.promptForCommentDiscussion();

			// Step 5: Format the conventional comment
			const conventionalComment: ConventionalComment = {
				label,
				decorations: decorations || [],
				subject: commentText,
				discussion,
			};

			const formattedComment = formatConventionalComment(conventionalComment);

			// Step 6: Show editable preview before submission
			const finalComment = await this.showEditableCommentPreview(formattedComment, label);
			if (!finalComment) {
				return; // User cancelled
			}

			// Step 7: Submit the final comment
			await this.submitComment(reply, finalComment);

			vscode.window.showInformationMessage(
				"Conventional comment added successfully",
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			vscode.window.showErrorMessage(
				`Failed to add conventional comment: ${errorMessage}`,
			);
			console.error("Error adding conventional comment:", error);
		}
	}

	/**
	 * Show QuickPick to select a conventional comment label
	 */
	private async selectCommentLabel(): Promise<
		ConventionalCommentLabel | undefined
	> {
		const items = LABEL_METADATA.map((meta) => ({
			label: `${meta.icon} ${meta.label}`,
			description: meta.description.replace(`${meta.label}: `, ""),
			detail: meta.detail,
			value: meta.label,
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: "Select a comment type",
			title: "Conventional Comment - Select Label",
			ignoreFocusOut: true,
		});

		return selected?.value;
	}

	/**
	 * Show QuickPick to select comment decorations (optional, multi-select)
	 */
	private async selectCommentDecorations(): Promise<
		ConventionalCommentDecoration[] | undefined
	> {
		const items = DECORATION_METADATA.map((meta) => ({
			label: meta.decoration,
			description: meta.description,
			picked: false,
		}));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: "Select decorations (optional, press Escape to skip)",
			title: "Conventional Comment - Select Decorations (Optional)",
			canPickMany: true,
			ignoreFocusOut: true,
		});

		if (!selected) {
			return []; // User cancelled or skipped
		}

		return selected.map((item) => item.label);
	}

	/**
	 * Prompt user to enter the comment subject
	 */
	private async promptForCommentSubject(
		label: ConventionalCommentLabel,
	): Promise<string | undefined> {
		const labelMeta = LABEL_METADATA.find((m) => m.label === label);
		const placeholder = this.getSubjectPlaceholder(label);

		return await vscode.window.showInputBox({
			prompt: `Enter the subject for your ${label} comment`,
			placeHolder: placeholder,
			title: `Conventional Comment - ${labelMeta?.icon} ${label}`,
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value.trim()) {
					return "Subject cannot be empty";
				}
				return null;
			},
		});
	}

	/**
	 * Prompt user to enter optional discussion/reasoning
	 */
	private async promptForCommentDiscussion(): Promise<string | undefined> {
		const discussion = await vscode.window.showInputBox({
			prompt: "Add optional discussion or reasoning (press Escape to skip)",
			placeHolder: "Explain your reasoning, provide context...",
			title: "Conventional Comment - Discussion (Optional)",
			ignoreFocusOut: true,
		});

		return discussion?.trim() || undefined;
	}

	/**
	 * Get placeholder text for subject based on label
	 */
	private getSubjectPlaceholder(label: ConventionalCommentLabel): string {
		const placeholders: Record<ConventionalCommentLabel, string> = {
			[ConventionalCommentLabel.Praise]: "Great work on...",
			[ConventionalCommentLabel.Nitpick]:
				"Consider using a different variable name",
			[ConventionalCommentLabel.Suggestion]:
				"We could improve this by...",
			[ConventionalCommentLabel.Issue]:
				"This will cause a bug when...",
			[ConventionalCommentLabel.Todo]:
				"Add error handling here",
			[ConventionalCommentLabel.Question]:
				"Why did you choose this approach?",
			[ConventionalCommentLabel.Thought]:
				"We might want to consider...",
			[ConventionalCommentLabel.Chore]:
				"This needs to follow our code style guide",
			[ConventionalCommentLabel.Note]:
				"This is related to issue #123",
		};

		return placeholders[label] || "Enter your comment...";
	}

	/**
	 * Show an editable preview of the formatted conventional comment
	 * Uses an InputBox with the formatted comment pre-filled for easy editing
	 */
	private async showEditableCommentPreview(
		formattedComment: string,
		label: ConventionalCommentLabel,
	): Promise<string | undefined> {
		const labelMeta = LABEL_METADATA.find((m) => m.label === label);

		// Show InputBox with the formatted comment pre-filled
		const result = await vscode.window.showInputBox({
			value: formattedComment,
			prompt: "Review and edit your conventional comment (Ctrl+Enter to submit)",
			title: `${labelMeta?.icon || ""} Conventional Comment - Review & Submit`,
			ignoreFocusOut: true,
			validateInput: (value) => {
				if (!value.trim()) {
					return "Comment cannot be empty";
				}
				return null;
			},
		});

		return result?.trim();
	}

	/**
	 * Submit a comment (extracted from handleCommentSubmit for reuse)
	 */
	private async submitComment(
		reply: vscode.CommentReply,
		commentText: string,
	): Promise<void> {
		// Get PR context from the document
		const contextManager = PRContextManager.getInstance();
		const fileContext = contextManager.getPRFileContext(reply.thread.uri);

		if (!fileContext) {
			throw new Error("No PR context found for this file");
		}

		const pr = fileContext.pullRequest;
		const metadata = this.getThreadMetadata(reply.thread);
		const prThreadId = metadata?.prThreadId;

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: prThreadId ? "Adding reply..." : "Creating comment...",
				cancellable: false,
			},
			async (progress) => {
				progress.report({ increment: 0 });

				if (prThreadId) {
					// Reply to existing thread
					await this.azureDevOpsClient.replyToPRThread(
						pr.repository.project.id,
						pr.repository.id,
						pr.pullRequestId,
						prThreadId,
						commentText,
					);
				} else {
					// Create new thread
					if (!reply.thread.range) {
						throw new Error("Cannot create new thread without a range");
					}
					const lineNumber = reply.thread.range.start.line + 1;
					await this.azureDevOpsClient.createPRThread(
						pr.repository.project.id,
						pr.repository.id,
						pr.pullRequestId,
						fileContext.filePath,
						lineNumber,
						commentText,
						fileContext.side,
					);
				}

				progress.report({ increment: 100 });
			},
		);

		// Find the document for the thread URI
		const document = vscode.workspace.textDocuments.find(
			(doc) => doc.uri.toString() === reply.thread.uri.toString(),
		);

		// Refresh comments to show the new comment
		if (document) {
			await this.loadCommentsForDocument(document);
		}
	}

	/**
	 * Handle comment edit action
	 */
	private async handleEditComment(comment: vscode.Comment): Promise<void> {
		try {
			// Get current comment content
			const currentContent = typeof comment.body === 'string'
				? comment.body
				: comment.body.value;

			// Prompt user to edit
			const newContent = await vscode.window.showInputBox({
				value: currentContent,
				prompt: "Edit your comment",
				ignoreFocusOut: true,
				validateInput: (value) => {
					if (!value.trim()) {
						return "Comment cannot be empty";
					}
					return null;
				},
			});

			if (!newContent) {
				return; // User cancelled
			}

			// Find the thread containing this comment
			let foundThread: vscode.CommentThread | undefined;
			let metadata: CommentThreadMetadata | undefined;

			for (const [key, thread] of this.commentThreads) {
				if (thread.comments.includes(comment)) {
					foundThread = thread;
					metadata = this.threadMetadata.get(key);
					break;
				}
			}

			if (!foundThread || !metadata?.prThreadId || !metadata.prContext || !metadata.commentIdMap) {
				throw new Error("Could not find comment thread metadata");
			}

			const { prThreadId, prContext, commentIdMap } = metadata;

			// Find the comment ID from the metadata
			const commentId = commentIdMap.get(currentContent);
			if (!commentId) {
				throw new Error("Could not find comment ID");
			}

			// Update comment via Azure DevOps API
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Updating comment...",
					cancellable: false,
				},
				async () => {
					await this.azureDevOpsClient.updateComment(
						prContext.projectId,
						prContext.repositoryId,
						prContext.pullRequestId,
						prThreadId,
						commentId,
						newContent,
					);
				},
			);

			// Find the document for this thread URI
			const document = vscode.workspace.textDocuments.find(
				(doc) => doc.uri.toString() === foundThread.uri.toString(),
			);

			// Refresh comments to show the update
			if (document) {
				await this.loadCommentsForDocument(document);
			}

			vscode.window.showInformationMessage("Comment updated successfully");
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			vscode.window.showErrorMessage(`Failed to edit comment: ${errorMessage}`);
			console.error("Error editing comment:", error);
		}
	}

	/**
	 * Handle comment delete action
	 */
	private async handleDeleteComment(comment: vscode.Comment): Promise<void> {
		try {
			// Confirm deletion
			const confirmed = await vscode.window.showWarningMessage(
				"Are you sure you want to delete this comment?",
				{ modal: true },
				"Delete",
			);

			if (confirmed !== "Delete") {
				return; // User cancelled
			}

			// Get current comment content
			const currentContent = typeof comment.body === 'string'
				? comment.body
				: comment.body.value;

			// Find the thread containing this comment
			let foundThread: vscode.CommentThread | undefined;
			let metadata: CommentThreadMetadata | undefined;

			for (const [key, thread] of this.commentThreads) {
				if (thread.comments.includes(comment)) {
					foundThread = thread;
					metadata = this.threadMetadata.get(key);
					break;
				}
			}

			if (!foundThread || !metadata?.prThreadId || !metadata.prContext || !metadata.commentIdMap) {
				throw new Error("Could not find comment thread metadata");
			}

			const { prThreadId, prContext, commentIdMap } = metadata;

			// Find the comment ID from the metadata
			const commentId = commentIdMap.get(currentContent);
			if (!commentId) {
				throw new Error("Could not find comment ID");
			}

			// Delete comment via Azure DevOps API
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Deleting comment...",
					cancellable: false,
				},
				async () => {
					await this.azureDevOpsClient.deleteComment(
						prContext.projectId,
						prContext.repositoryId,
						prContext.pullRequestId,
						prThreadId,
						commentId,
					);
				},
			);

			// Find the document for this thread URI
			const document = vscode.workspace.textDocuments.find(
				(doc) => doc.uri.toString() === foundThread.uri.toString(),
			);

			// Refresh comments to show the deletion
			if (document) {
				await this.loadCommentsForDocument(document);
			}

			vscode.window.showInformationMessage("Comment deleted successfully");
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			vscode.window.showErrorMessage(`Failed to delete comment: ${errorMessage}`);
			console.error("Error deleting comment:", error);
		}
	}

	/**
	 * Handle resolve thread action
	 */
	private async handleResolveThread(thread: vscode.CommentThread): Promise<void> {
		try {
			// Find the thread metadata
			const metadata = this.getThreadMetadata(thread);
			if (!metadata?.prThreadId || !metadata.prContext) {
				throw new Error("Could not find thread metadata");
			}

			const { prThreadId, prContext } = metadata;

			// Update thread status to resolved (status = 2)
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Resolving thread...",
					cancellable: false,
				},
				async () => {
					await this.azureDevOpsClient.updateThreadStatus(
						prContext.projectId,
						prContext.repositoryId,
						prContext.pullRequestId,
						prThreadId,
						2, // Status 2 = Fixed/Resolved
					);
				},
			);

			// Update the local thread state
			thread.state = vscode.CommentThreadState.Resolved;

			vscode.window.showInformationMessage("Thread resolved successfully");
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			vscode.window.showErrorMessage(`Failed to resolve thread: ${errorMessage}`);
			console.error("Error resolving thread:", error);
		}
	}

	/**
	 * Handle unresolve thread action
	 */
	private async handleUnresolveThread(thread: vscode.CommentThread): Promise<void> {
		try {
			// Find the thread metadata
			const metadata = this.getThreadMetadata(thread);
			if (!metadata?.prThreadId || !metadata.prContext) {
				throw new Error("Could not find thread metadata");
			}

			const { prThreadId, prContext } = metadata;

			// Update thread status to active (status = 1)
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: "Unresolving thread...",
					cancellable: false,
				},
				async () => {
					await this.azureDevOpsClient.updateThreadStatus(
						prContext.projectId,
						prContext.repositoryId,
						prContext.pullRequestId,
						prThreadId,
						1, // Status 1 = Active
					);
				},
			);

			// Update the local thread state
			thread.state = vscode.CommentThreadState.Unresolved;

			vscode.window.showInformationMessage("Thread unresolved successfully");
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			vscode.window.showErrorMessage(`Failed to unresolve thread: ${errorMessage}`);
			console.error("Error unresolving thread:", error);
		}
	}

	/**
	 * Get human-readable label for thread status
	 */
	private getThreadStatusLabel(
		status: string | number | undefined | null,
	): string {
		const statusMap: { [key: string]: string } = {
			"0": "Unknown",
			"1": "Active",
			"2": "Resolved",
			"3": "Won't Fix",
			"4": "Closed",
			"5": "By Design",
			"6": "Pending",
		};
		return status !== undefined && status !== null
			? statusMap[status.toString()] || "Unknown"
			: "Unknown";
	}

	/**
	 * Refresh comments for all open PR diff documents
	 */
	public async refresh(): Promise<void> {
		// Dispose all existing comment threads
		for (const [, thread] of this.commentThreads) {
			thread.dispose();
		}
		this.commentThreads.clear();
		this.threadMetadata.clear();

		// Reload comments for all visible editors
		for (const editor of vscode.window.visibleTextEditors) {
			if (editor.document.uri.scheme === "azdo-pr") {
				await this.loadCommentsForDocument(editor.document);
			}
		}
	}

	/**
	 * Dispose of resources
	 */
	public dispose(): void {
		// Dispose all comment threads
		for (const [, thread] of this.commentThreads) {
			thread.dispose();
		}
		this.commentThreads.clear();
		this.threadMetadata.clear();

		// Dispose the comment controller
		this.commentController.dispose();

		// Dispose other resources
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}
