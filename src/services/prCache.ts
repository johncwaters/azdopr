import type { PullRequest, PRFileChange, PRThread } from "./azureDevOpsClient";

/**
 * Interface for PR iteration data
 */
export interface PRIteration {
	id: number;
	[key: string]: any;
}

/**
 * Interface for cached PR data
 */
interface CachedPRData {
	fullDetails: PullRequest;
	iterations: PRIteration[];
	fileChanges: PRFileChange[];
	threads: PRThread[];
	timestamp: number;
}

/**
 * Service for caching PR details to reduce API calls
 * Implements a short-term cache with configurable TTL
 */
export class PRCacheService {
	private static _instance: PRCacheService | undefined;
	private readonly cache: Map<string, CachedPRData> = new Map();
	private readonly defaultTTL: number = 5 * 60 * 1000; // 5 minutes in milliseconds

	private constructor() {
		// Private constructor to enforce singleton pattern
		// Start cleanup interval to remove expired entries
		this.startCleanupInterval();
	}

	/**
	 * Get the singleton instance of PRCacheService
	 */
	public static getInstance(): PRCacheService {
		if (!PRCacheService._instance) {
			PRCacheService._instance = new PRCacheService();
		}
		return PRCacheService._instance;
	}

	/**
	 * Generate a unique cache key for a PR
	 */
	private getCacheKey(projectId: string, repositoryId: string, pullRequestId: number): string {
		return `${projectId}:${repositoryId}:${pullRequestId}`;
	}

	/**
	 * Get cached PR data if it exists and is not expired
	 */
	public get(
		projectId: string,
		repositoryId: string,
		pullRequestId: number
	): CachedPRData | undefined {
		const key = this.getCacheKey(projectId, repositoryId, pullRequestId);
		const cached = this.cache.get(key);

		if (!cached) {
			return undefined;
		}

		// Check if cache entry has expired
		const now = Date.now();
		if (now - cached.timestamp > this.defaultTTL) {
			this.cache.delete(key);
			return undefined;
		}

		return cached;
	}

	/**
	 * Store PR data in the cache
	 */
	public set(
		projectId: string,
		repositoryId: string,
		pullRequestId: number,
		fullDetails: PullRequest,
		iterations: PRIteration[],
		fileChanges: PRFileChange[],
		threads: PRThread[]
	): void {
		const key = this.getCacheKey(projectId, repositoryId, pullRequestId);
		this.cache.set(key, {
			fullDetails,
			iterations,
			fileChanges,
			threads,
			timestamp: Date.now(),
		});
	}

	/**
	 * Invalidate (remove) a specific PR from the cache
	 */
	public invalidate(projectId: string, repositoryId: string, pullRequestId: number): void {
		const key = this.getCacheKey(projectId, repositoryId, pullRequestId);
		this.cache.delete(key);
	}

	/**
	 * Invalidate all cached PRs for a specific repository
	 */
	public invalidateRepository(projectId: string, repositoryId: string): void {
		const prefix = `${projectId}:${repositoryId}:`;
		for (const key of this.cache.keys()) {
			if (key.startsWith(prefix)) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Clear all cached data
	 */
	public clearAll(): void {
		this.cache.clear();
	}

	/**
	 * Get the current cache size
	 */
	public size(): number {
		return this.cache.size;
	}

	/**
	 * Remove expired entries from the cache
	 */
	private cleanup(): void {
		const now = Date.now();
		for (const [key, value] of this.cache.entries()) {
			if (now - value.timestamp > this.defaultTTL) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Start periodic cleanup of expired cache entries
	 */
	private startCleanupInterval(): void {
		// Run cleanup every minute
		setInterval(() => {
			this.cleanup();
		}, 60 * 1000);
	}

	/**
	 * Get cache statistics for debugging
	 */
	public getStats(): { size: number; entries: Array<{ key: string; age: number }> } {
		const now = Date.now();
		const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
			key,
			age: now - value.timestamp,
		}));
		return {
			size: this.cache.size,
			entries,
		};
	}
}
