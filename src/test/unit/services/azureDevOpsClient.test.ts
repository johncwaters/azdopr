import * as assert from "node:assert";
import axios from "axios";
import { setup, suite, teardown, test } from "mocha";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { AzureDevOpsAuthProvider } from "../../../auth/authProvider";
import { AzureDevOpsClient, type PullRequest } from "../../../services/azureDevOpsClient";
import { mockAzDOPRListResponse } from "../../fixtures/apiResponses";

suite("AzureDevOpsClient PR commit metadata", () => {
	let client: AzureDevOpsClient;
	let getStub: sinon.SinonStub;

	setup(() => {
		const config = vscode.workspace.getConfiguration("azureDevOpsPRViewer");
		sinon.stub(vscode.workspace, "getConfiguration").returns({
			...config,
			get: sinon.stub().withArgs("organization", "").returns("test-org"),
		});
		const http = axios.create();
		getStub = sinon.stub(http, "get");
		sinon.stub(axios, "create").returns(http);
		const authProvider = new AzureDevOpsAuthProvider();
		sinon.stub(authProvider, "getAccessToken").resolves("test-token");
		client = new AzureDevOpsClient(authProvider);
	});

	teardown(() => {
		sinon.restore();
	});

	for (const entryPoint of ["list", "details"]) {
		const fetchPR = async (): Promise<PullRequest> =>
			entryPoint === "list"
				? (await client.getPullRequests("proj-123", "repo-456"))[0]
				: await client.getPullRequestDetails("proj-123", "repo-456", 123);

		test(`${entryPoint} preserves the recorded revisions used by file diffs`, async () => {
			const rawPR = {
				...mockAzDOPRListResponse.value[0],
				lastMergeSourceCommit: { commitId: "a".repeat(40) },
				lastMergeTargetCommit: { commitId: "b".repeat(40) },
			};
			getStub.onFirstCall().resolves({
				data: entryPoint === "list" ? { value: [rawPR] } : rawPR,
			});

			const pr = await fetchPR();

			assert.deepStrictEqual(pr, {
				...rawPR,
				creationDate: new Date(rawPR.creationDate),
				reviewers: rawPR.reviewers.map((reviewer) => ({
					...reviewer,
					imageUrl: undefined,
				})),
			});

			getStub.resolves({ data: "file content" });
			assert.ok(pr.lastMergeTargetCommit);
			assert.ok(pr.lastMergeSourceCommit);
			for (const commit of [pr.lastMergeTargetCommit, pr.lastMergeSourceCommit]) {
				await client.getFileContent("proj-123", "repo-456", "/src/example.ts", commit.commitId);
			}
			const fileRequests = getStub.getCalls().slice(1);
			assert.deepStrictEqual(
				fileRequests.map((call) => {
					const params = new URL(call.args[0]).searchParams;
					return [params.get("versionType"), params.get("version")];
				}),
				[
					["commit", rawPR.lastMergeTargetCommit.commitId],
					["commit", rawPR.lastMergeSourceCommit.commitId],
				],
			);
		});

		test(`${entryPoint} accepts PRs without recorded commit metadata`, async () => {
			const {
				lastMergeSourceCommit: _source,
				lastMergeTargetCommit: _target,
				...rawPR
			} = mockAzDOPRListResponse.value[0];
			getStub.resolves({
				data: entryPoint === "list" ? { value: [rawPR] } : rawPR,
			});

			const pr = await fetchPR();

			assert.strictEqual(pr.lastMergeSourceCommit, undefined);
			assert.strictEqual(pr.lastMergeTargetCommit, undefined);
			assert.strictEqual(pr.sourceRefName, rawPR.sourceRefName);
			assert.strictEqual(pr.targetRefName, rawPR.targetRefName);
		});
	}
});
