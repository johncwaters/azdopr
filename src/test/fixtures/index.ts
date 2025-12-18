/**
 * Central export hub for all test fixtures
 */

// Pull Requests
export {
	mockProject,
	mockRepository,
	mockPullRequest,
	mockPRIteration,
	mockPRFileChange,
	mockPRFileChangeAdd,
	mockPRFileChangeDelete,
	mockPRFileChangeRename,
	createMockPR,
	createMockIteration,
	createMockFileChange,
	createMockProject,
	createMockRepository,
	createDraftPR,
	createCompletedPR,
	createAbandonedPR,
} from "./pullRequests";

// Comments and Threads
export {
	mockComment,
	mockReplyComment,
	mockSystemComment,
	mockThread,
	mockResolvedThread,
	mockThreadWithoutContext,
	createMockComment,
	createMockThread,
	createThreadWithComments,
	createActiveThreadWithContext,
	createResolvedThread,
} from "./comments";

// API Responses
export {
	mockAzDOPRListResponse,
	mockAzDOThreadsResponse,
	mockAzDOProjectsResponse,
	mockAzDORepositoriesResponse,
	mockFileContentResponse,
	mockLfsPointerResponse,
	createAxiosResponse,
	create404Response,
	create500Response,
	createNetworkError,
	create401Response,
} from "./apiResponses";

// LFS Files
export {
	mockLfsPointer,
	mockLfsPointer2,
	invalidLfsPointerWrongVersion,
	invalidLfsPointerMissingOid,
	invalidLfsPointerMissingSize,
	invalidLfsPointerExtraLines,
	invalidLfsPointerMalformedOid,
	invalidLfsPointerMalformedSize,
	mockPdfBuffer,
	mockPngBuffer,
	mockJpegBuffer,
	mockBinaryBuffer,
	mockTextFileContent,
	createLfsPointer,
	getExpectedOid,
	getExpectedSize,
} from "./lfsFiles";
