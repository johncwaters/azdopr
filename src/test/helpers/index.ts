/**
 * Central export hub for all test helpers
 */

// VS Code Stubs
export {
	createVSCodeStubs,
	resetVSCodeStubs,
	createMockAuthSession,
	createMockConfiguration,
	createMockExtensionContext,
	createMockTextDocument,
	createMockCommentThread,
} from "./vscodeStubs";

// Azure DevOps Stubs
export {
	createAxiosStub,
	stubAxiosCreate,
	resetAxiosStub,
	stubAzureDevOpsEndpoints,
	stubAzureDevOpsError,
	createMockResponse,
	createMockError,
} from "./azureDevOpsStubs";

// Time Helpers
export {
	TestClock,
	createTestClock,
	withFakeTimers,
	advanceTime,
	advanceTimeInSteps,
	flushTimers,
} from "./timeHelpers";

// Assertions
export {
	assertDefined,
	assertArrayContains,
	assertArrayDoesNotContain,
	assertHasProperty,
	assertDatesEqual,
	assertThrowsWithMessage,
	assertRejectsWithMessage,
	assertInRange,
	assertMatches,
	assertDoesNotMatch,
} from "./assertions";
