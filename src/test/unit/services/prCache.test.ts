import * as assert from "node:assert";
import { setup, suite, teardown, test } from "mocha";
import * as sinon from "sinon";
import { PR_CACHE_TTL_MS } from "../../../constants/cacheConfig";
import { PRCacheService } from "../../../services/prCache";
import { mockPullRequest } from "../../fixtures/pullRequests";

suite("PRCacheService", () => {
	let clock: sinon.SinonFakeTimers;
	let cache: PRCacheService;

	const projectId = "proj-123";
	const repoId = "repo-456";
	const prId = 1;

	setup(() => {
		clock = sinon.useFakeTimers(Date.now());
		PRCacheService.resetInstance();
		cache = PRCacheService.getInstance();
	});

	teardown(() => {
		PRCacheService.resetInstance();
		clock.restore();
	});

	test("getInstance returns same instance", () => {
		const a = PRCacheService.getInstance();
		const b = PRCacheService.getInstance();
		assert.strictEqual(a, b);
	});

	test("resetInstance clears singleton", () => {
		const a = PRCacheService.getInstance();
		PRCacheService.resetInstance();
		const b = PRCacheService.getInstance();
		assert.notStrictEqual(a, b);
	});

	suite("get", () => {
		test("returns undefined for missing entries", () => {
			const result = cache.get(projectId, repoId, prId);
			assert.strictEqual(result, undefined);
		});

		test("returns undefined for different PR IDs", () => {
			cache.set(projectId, repoId, prId, mockPullRequest, [], [], []);
			const result = cache.get(projectId, repoId, 999);
			assert.strictEqual(result, undefined);
		});
	});

	suite("set and get round-trip", () => {
		test("stores and retrieves PR data", () => {
			cache.set(projectId, repoId, prId, mockPullRequest, [], [], []);
			const result = cache.get(projectId, repoId, prId);
			assert.ok(result);
			assert.strictEqual(result.fullDetails, mockPullRequest);
		});

		test("stores iterations, fileChanges, and threads", () => {
			const threads = [{ id: 1 }] as any;
			cache.set(projectId, repoId, prId, mockPullRequest, [], [], threads);
			const result = cache.get(projectId, repoId, prId);
			assert.ok(result);
			assert.deepStrictEqual(result.threads, threads);
		});
	});

	suite("TTL expiration", () => {
		test("entry expires after PR_CACHE_TTL_MS", () => {
			cache.set(projectId, repoId, prId, mockPullRequest, [], [], []);

			// Just before expiration - still valid
			clock.tick(PR_CACHE_TTL_MS - 1);
			assert.ok(cache.get(projectId, repoId, prId));

			// After expiration
			clock.tick(2);
			assert.strictEqual(cache.get(projectId, repoId, prId), undefined);
		});
	});

	suite("invalidate", () => {
		test("removes specific PR entry", () => {
			cache.set(projectId, repoId, prId, mockPullRequest, [], [], []);
			cache.set(projectId, repoId, 2, mockPullRequest, [], [], []);

			cache.invalidate(projectId, repoId, prId);

			assert.strictEqual(cache.get(projectId, repoId, prId), undefined);
			assert.ok(cache.get(projectId, repoId, 2));
		});

		test("no-op for non-existent entry", () => {
			cache.invalidate(projectId, repoId, 999);
			// Should not throw
		});
	});
});
