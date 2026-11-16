import * as assert from "node:assert";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { setup, suite, teardown, test } from "mocha";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { AzureDevOpsAuthProvider } from "../../../auth/authProvider";
import { AzureDevOpsClient } from "../../../services/azureDevOpsClient";
import { mockPullRequest } from "../../fixtures/pullRequests";

suite("AzureDevOpsClient authentication recovery", () => {
	const session: vscode.AuthenticationSession = {
		id: "test-session-id",
		accessToken: "interactive-token",
		account: { id: "user-id", label: "Test User" },
		scopes: ["499b84ac-1321-427f-aa17-267ca6975798/user_impersonation"],
	};
	let authProvider: AzureDevOpsAuthProvider;
	let client: AzureDevOpsClient;
	let getSessionStub: sinon.SinonStub;
	let requests: InternalAxiosRequestConfig[];
	let status: number;

	setup(async () => {
		requests = [];
		status = 200;
		const transport = axios.create({
			adapter: async (config) => {
				requests.push(config);
				const response = {
					config,
					data: { ...mockPullRequest, creationDate: mockPullRequest.creationDate.toISOString() },
					headers: {},
					status,
					statusText: status === 200 ? "OK" : "Request failed",
				};
				if (status !== 200) {
					throw new AxiosError(
						`Request failed with status code ${status}`,
						AxiosError.ERR_BAD_REQUEST,
						config,
						undefined,
						response,
					);
				}
				return response;
			},
		});
		sinon.stub(axios, "create").returns(transport);
		const config = vscode.workspace.getConfiguration("azureDevOpsPRViewer");
		const getConfigValue = sinon.stub().withArgs("organization", "").returns("test-org");
		sinon.stub(vscode.workspace, "getConfiguration").returns({ ...config, get: getConfigValue });
		getSessionStub = sinon.stub(vscode.authentication, "getSession").resolves(session);
		authProvider = new AzureDevOpsAuthProvider();
		await authProvider.signIn();
		client = new AzureDevOpsClient(authProvider);
	});

	teardown(() => {
		sinon.restore();
	});

	test("loads a PR after successful sign-in even when silent lookup returns no session", async () => {
		getSessionStub.resolves(undefined);

		const pr = await client.getPullRequestDetails("project", "repository", 123);

		assert.strictEqual(pr.pullRequestId, 123);
		assert.strictEqual(requests[0].headers.get("Authorization"), "Bearer interactive-token");
		assert.strictEqual(await authProvider.isAuthenticated(), true);
	});

	test("uses a renewed token when Microsoft supplies one", async () => {
		getSessionStub.resolves({ ...session, accessToken: "renewed-token" });

		await client.getPullRequestDetails("project", "repository", 123);

		assert.strictEqual(requests[0].headers.get("Authorization"), "Bearer renewed-token");
	});

	test("rejects an expired token and recovers after signing in without a window reload", async () => {
		getSessionStub.resolves(undefined);
		status = 401;
		await assert.rejects(
			() => client.getPullRequestDetails("project", "repository", 123),
			/Run Azure DevOps PR Viewer: Sign In/,
		);
		assert.strictEqual(requests.length, 1);
		assert.strictEqual(await authProvider.isAuthenticated(), false);
		await assert.rejects(
			() => client.getPullRequestDetails("project", "repository", 123),
			/Not authenticated.*Sign In/,
		);
		assert.strictEqual(requests.length, 1, "Do not resend a rejected token");

		getSessionStub.resolves({ ...session, accessToken: "new-interactive-token" });
		await authProvider.signIn();
		assert.deepStrictEqual(getSessionStub.lastCall.args[2], {
			forceNewSession: true,
			account: session.account,
		});
		getSessionStub.resolves(undefined);
		status = 200;

		const pr = await client.getPullRequestDetails("project", "repository", 123);

		assert.strictEqual(pr.pullRequestId, 123);
		assert.strictEqual(requests[1].headers.get("Authorization"), "Bearer new-interactive-token");
	});

	test("does not automatically resubmit a rejected write request", async () => {
		status = 401;

		await assert.rejects(
			() => client.updateThreadStatus("project", "repository", 123, 1, 2),
			/Run Azure DevOps PR Viewer: Sign In/,
		);

		assert.strictEqual(requests.length, 1);
		assert.strictEqual(requests[0].method, "patch");
		assert.strictEqual(await authProvider.isAuthenticated(), false);
	});

	for (const errorStatus of [403, 500]) {
		test(`preserves authentication and the original error for HTTP ${errorStatus}`, async () => {
			status = errorStatus;

			await assert.rejects(
				() => client.getPullRequestDetails("project", "repository", 123),
				(error: unknown) => axios.isAxiosError(error) && error.response?.status === errorStatus,
			);

			assert.strictEqual(requests.length, 1);
			getSessionStub.resolves(undefined);
			assert.strictEqual(await authProvider.isAuthenticated(), true);
		});
	}
});
