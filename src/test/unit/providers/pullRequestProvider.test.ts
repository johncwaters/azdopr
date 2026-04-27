import * as assert from "node:assert";
import { suite, test } from "mocha";
import type { AzureDevOpsAuthProvider } from "../../../auth/authProvider";
import { REVIEWER_VOTE } from "../../../constants/azureDevOpsConstants";
import { PullRequestProvider } from "../../../providers/pullRequestProvider";
import type { AzureDevOpsClient } from "../../../services/azureDevOpsClient";
import { createMockPR } from "../../fixtures/pullRequests";

suite("PullRequestProvider", () => {
	const currentUserEmail = "current.user@example.com";

	function createMockClient(email: string): AzureDevOpsClient {
		return {
			getCurrentUser: async () => ({
				id: "current-user-id",
				displayName: "Current User",
				uniqueName: email,
				imageUrl: "https://example.com/avatar.jpg",
			}),
			getAllPullRequests: async () => [],
		} as unknown as AzureDevOpsClient;
	}

	function createMockAuthProvider(): AzureDevOpsAuthProvider {
		return {
			isAuthenticated: async () => true,
		} as unknown as AzureDevOpsAuthProvider;
	}

	async function createInitializedProvider(email = currentUserEmail) {
		const provider = new PullRequestProvider(createMockClient(email), createMockAuthProvider());
		provider.initialize();
		await new Promise((resolve) => setTimeout(resolve, 100));
		return provider;
	}

	suite("isPRBlocked", () => {
		test("returns true when any reviewer rejected", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				reviewers: [
					{
						id: "user-1",
						displayName: "User 1",
						uniqueName: "user1@example.com",
						vote: REVIEWER_VOTE.REJECTED,
						isRequired: false,
					},
				],
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).isPRBlocked(pr), true);
		});

		test("returns false when no reviewers rejected", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				reviewers: [
					{
						id: "user-1",
						displayName: "User 1",
						uniqueName: "user1@example.com",
						vote: REVIEWER_VOTE.APPROVED,
						isRequired: false,
					},
				],
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).isPRBlocked(pr), false);
		});

		test("returns false with no reviewers", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({ reviewers: [] });
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).isPRBlocked(pr), false);
		});

		test("handles undefined reviewers", async () => {
			const provider = await createInitializedProvider();
			// biome-ignore lint/suspicious/noExplicitAny: Testing edge case
			const pr = createMockPR({ reviewers: undefined as any });
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).isPRBlocked(pr), false);
		});
	});

	suite("getCurrentUserReviewStatus", () => {
		test("returns vote when current user is reviewer", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				reviewers: [
					{
						id: "current-user-id",
						displayName: "Current User",
						uniqueName: currentUserEmail,
						vote: REVIEWER_VOTE.APPROVED,
						isRequired: false,
					},
				],
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).getCurrentUserReviewStatus(pr), REVIEWER_VOTE.APPROVED);
		});

		test("returns null when current user is not a reviewer", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				reviewers: [
					{
						id: "other-user-id",
						displayName: "Other User",
						uniqueName: "other@example.com",
						vote: REVIEWER_VOTE.APPROVED,
						isRequired: false,
					},
				],
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).getCurrentUserReviewStatus(pr), null);
		});

		test("returns null with no reviewers", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({ reviewers: [] });
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).getCurrentUserReviewStatus(pr), null);
		});
	});

	suite("needsCurrentUserReview", () => {
		test("returns true when user has NO_VOTE", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				reviewers: [
					{
						id: "current-user-id",
						displayName: "Current User",
						uniqueName: currentUserEmail,
						vote: REVIEWER_VOTE.NO_VOTE,
						isRequired: false,
					},
				],
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).needsCurrentUserReview(pr), true);
		});

		test("returns false when user already voted", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				reviewers: [
					{
						id: "current-user-id",
						displayName: "Current User",
						uniqueName: currentUserEmail,
						vote: REVIEWER_VOTE.APPROVED,
						isRequired: false,
					},
				],
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).needsCurrentUserReview(pr), false);
		});

		test("returns false when user is not a reviewer", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				reviewers: [
					{
						id: "other-id",
						displayName: "Other",
						uniqueName: "other@example.com",
						vote: REVIEWER_VOTE.NO_VOTE,
						isRequired: false,
					},
				],
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).needsCurrentUserReview(pr), false);
		});
	});

	suite("getStatusDescription", () => {
		test("returns blocked text when PR is blocked", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR();
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			const result = (provider as any).getStatusDescription(pr, true, null);
			assert.ok(result.includes("Blocked"));
		});

		test("returns waiting text when user is waiting for author", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR();
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			const result = (provider as any).getStatusDescription(
				pr,
				false,
				REVIEWER_VOTE.WAITING_FOR_AUTHOR,
			);
			assert.ok(result.includes("Waiting"));
		});

		test("returns empty string for normal status", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR();
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			const result = (provider as any).getStatusDescription(pr, false, null);
			assert.strictEqual(result, "");
		});

		test("blocked takes priority over waiting", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR();
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			const result = (provider as any).getStatusDescription(
				pr,
				true,
				REVIEWER_VOTE.WAITING_FOR_AUTHOR,
			);
			assert.ok(result.includes("Blocked"));
			assert.ok(!result.includes("Waiting"));
		});
	});

	suite("getPRActionPriority", () => {
		test("needs review is highest priority (1)", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				createdBy: { displayName: "Other", uniqueName: "other@example.com" },
				reviewers: [
					{
						id: "current-user-id",
						displayName: "Current User",
						uniqueName: currentUserEmail,
						vote: REVIEWER_VOTE.NO_VOTE,
						isRequired: false,
					},
				],
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).getPRActionPriority(pr), 1);
		});

		test("blocked PRs are priority 2", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				createdBy: { displayName: "Other", uniqueName: "other@example.com" },
				reviewers: [
					{
						id: "other-id",
						displayName: "Rejector",
						uniqueName: "rejector@example.com",
						vote: REVIEWER_VOTE.REJECTED,
						isRequired: false,
					},
				],
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).getPRActionPriority(pr), 2);
		});

		test("own PRs are lowest priority (5)", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				createdBy: { displayName: "Current User", uniqueName: currentUserEmail },
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).getPRActionPriority(pr), 5);
		});
	});

	suite("isCurrentUserAuthor", () => {
		test("returns true when user is author", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				createdBy: { displayName: "Current User", uniqueName: currentUserEmail },
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).isCurrentUserAuthor(pr), true);
		});

		test("returns false when user is not author", async () => {
			const provider = await createInitializedProvider();
			const pr = createMockPR({
				createdBy: { displayName: "Other", uniqueName: "other@example.com" },
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).isCurrentUserAuthor(pr), false);
		});

		test("returns false when currentUserId not set", async () => {
			const mockClient = {
				getCurrentUser: async () => {
					throw new Error("fail");
				},
				getAllPullRequests: async () => [],
			} as unknown as AzureDevOpsClient;
			const provider = new PullRequestProvider(mockClient, createMockAuthProvider());
			provider.initialize();
			await new Promise((resolve) => setTimeout(resolve, 100));

			const pr = createMockPR({
				createdBy: { displayName: "Current User", uniqueName: currentUserEmail },
			});
			// biome-ignore lint/suspicious/noExplicitAny: Testing private method
			assert.strictEqual((provider as any).isCurrentUserAuthor(pr), false);
		});
	});
});
