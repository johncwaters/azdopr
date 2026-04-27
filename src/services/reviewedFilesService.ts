import type * as vscode from "vscode";

/**
 * Interface for storing reviewed file metadata
 */
interface ReviewedFileInfo {
	reviewedAt: number;
	prId: number;
}

/**
 * Interface for storing PR-level reviewed files
 */
interface PRReviewedFiles {
	files: { [filePath: string]: ReviewedFileInfo };
	lastUpdated: number;
}

/**
 * Interface for the complete reviewed files store
 */
interface ReviewedFilesStore {
	[prKey: string]: PRReviewedFiles;
}

/**
 * Service for tracking which files have been reviewed in PRs
 * Persists state across VS Code sessions using globalState
 */
export class ReviewedFilesService {
	private static _instance: ReviewedFilesService | undefined;
	private readonly context: vscode.ExtensionContext;
	private readonly STORAGE_KEY = "azdo-pr-reviewed-files";

	private constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	/**
	 * Get the singleton instance of ReviewedFilesService
	 */
	public static getInstance(context: vscode.ExtensionContext): ReviewedFilesService {
		if (!ReviewedFilesService._instance) {
			ReviewedFilesService._instance = new ReviewedFilesService(context);
		}
		return ReviewedFilesService._instance;
	}

	/** Reset singleton for test isolation */
	public static resetInstance(): void {
		ReviewedFilesService._instance = undefined;
	}

	/**
	 * Generate a unique key for a PR: "projectId:repositoryId:prId"
	 */
	private getPRKey(projectId: string, repositoryId: string, prId: number): string {
		return `${projectId}:${repositoryId}:${prId}`;
	}

	/**
	 * Get the current store from globalState
	 */
	private getStore(): ReviewedFilesStore {
		return this.context.globalState.get<ReviewedFilesStore>(this.STORAGE_KEY, {});
	}

	/**
	 * Update the store in globalState
	 */
	private async updateStore(store: ReviewedFilesStore): Promise<void> {
		await this.context.globalState.update(this.STORAGE_KEY, store);
	}

	/**
	 * Check if a file is marked as reviewed
	 */
	public isFileReviewed(
		projectId: string,
		repositoryId: string,
		prId: number,
		filePath: string,
	): boolean {
		const store = this.getStore();
		const prKey = this.getPRKey(projectId, repositoryId, prId);
		return !!store[prKey]?.files[filePath];
	}

	/**
	 * Toggle the reviewed state of a file
	 * Returns the new state (true = now reviewed, false = now unreviewed)
	 */
	public async toggleFileReviewed(
		projectId: string,
		repositoryId: string,
		prId: number,
		filePath: string,
	): Promise<boolean> {
		const store = this.getStore();
		const prKey = this.getPRKey(projectId, repositoryId, prId);

		// Initialize PR entry if it doesn't exist
		if (!store[prKey]) {
			store[prKey] = {
				files: {},
				lastUpdated: Date.now(),
			};
		}

		const isCurrentlyReviewed = !!store[prKey].files[filePath];

		if (isCurrentlyReviewed) {
			// Remove the file (mark as unreviewed)
			delete store[prKey].files[filePath];
		} else {
			// Add the file (mark as reviewed)
			store[prKey].files[filePath] = {
				reviewedAt: Date.now(),
				prId: prId,
			};
		}

		store[prKey].lastUpdated = Date.now();
		await this.updateStore(store);

		return !isCurrentlyReviewed; // Return new state
	}

	/**
	 * Mark a file as reviewed
	 */
	public async markAsReviewed(
		projectId: string,
		repositoryId: string,
		prId: number,
		filePath: string,
	): Promise<void> {
		const store = this.getStore();
		const prKey = this.getPRKey(projectId, repositoryId, prId);

		// Initialize PR entry if it doesn't exist
		if (!store[prKey]) {
			store[prKey] = {
				files: {},
				lastUpdated: Date.now(),
			};
		}

		// Add the file (mark as reviewed)
		store[prKey].files[filePath] = {
			reviewedAt: Date.now(),
			prId: prId,
		};

		store[prKey].lastUpdated = Date.now();
		await this.updateStore(store);
	}
}
