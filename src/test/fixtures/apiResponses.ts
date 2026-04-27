/**
 * Raw Azure DevOps API response for PR list
 */
export const mockAzDOPRListResponse = {
	value: [
		{
			pullRequestId: 123,
			title: "Test PR: Add new feature",
			description: "This is a test pull request",
			createdBy: {
				displayName: "John Doe",
				uniqueName: "john.doe@example.com",
			},
			creationDate: "2024-01-15T10:00:00Z",
			status: "active",
			repository: {
				id: "repo-456",
				name: "test-repo",
				project: {
					id: "proj-123",
					name: "Test Project",
				},
			},
			reviewers: [
				{
					id: "user-1",
					displayName: "Jane Reviewer",
					uniqueName: "jane@example.com",
					vote: 10,
					isRequired: true,
				},
			],
			url: "https://dev.azure.com/org/proj/_git/repo/pullrequest/123",
			sourceRefName: "refs/heads/feature/new-feature",
			targetRefName: "refs/heads/main",
			isDraft: false,
			lastMergeSourceCommit: {
				commitId: "abc123def456789abcdef0123456789abcdef01",
			},
			lastMergeTargetCommit: {
				commitId: "def456abc123456789abcdef0123456789abcdef",
			},
		},
	],
	count: 1,
};

/**
 * Raw Azure DevOps API response for threads
 */
export const mockAzDOThreadsResponse = {
	value: [
		{
			id: 100,
			publishedDate: "2024-01-15T12:00:00Z",
			lastUpdatedDate: "2024-01-15T12:30:00Z",
			comments: [
				{
					id: 1,
					parentCommentId: 0,
					author: {
						id: "user-1",
						displayName: "John Commenter",
						uniqueName: "john@example.com",
					},
					content: "This looks good!",
					publishedDate: "2024-01-15T12:00:00Z",
					lastUpdatedDate: "2024-01-15T12:00:00Z",
					commentType: "text",
				},
			],
			status: "active",
			threadContext: {
				filePath: "/src/feature.ts",
				rightFileStart: { line: 10, offset: 0 },
				rightFileEnd: { line: 10, offset: 50 },
			},
		},
	],
	count: 1,
};

/**
 * Raw Azure DevOps API response for projects
 */
export const mockAzDOProjectsResponse = {
	value: [
		{
			id: "proj-123",
			name: "Test Project",
			description: "A test project",
			state: "wellFormed",
		},
		{
			id: "proj-456",
			name: "Another Project",
			description: "Another test project",
			state: "wellFormed",
		},
	],
	count: 2,
};

/**
 * Raw Azure DevOps API response for repositories
 */
export const mockAzDORepositoriesResponse = {
	value: [
		{
			id: "repo-456",
			name: "test-repo",
			project: {
				id: "proj-123",
				name: "Test Project",
			},
		},
		{
			id: "repo-789",
			name: "another-repo",
			project: {
				id: "proj-123",
				name: "Test Project",
			},
		},
	],
	count: 2,
};

/**
 * Raw Azure DevOps API response for file content
 */
export const mockFileContentResponse = {
	content: "// Sample TypeScript file\nexport function hello() {\n  return 'world';\n}\n",
	encoding: "utf-8",
};

/**
 * Raw Azure DevOps API response for LFS file content (pointer)
 */
export const mockLfsPointerResponse = {
	content:
		"version https://git-lfs.github.com/spec/v1\noid sha256:4d7a214614ab2935c943f9e0ff69d22ebbe7a2b7b4e3b0e3e6e5c7d2f1e8c9a0\nsize 12345678",
	encoding: "utf-8",
};
