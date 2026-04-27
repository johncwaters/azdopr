import * as assert from "node:assert";
import { setup, suite, teardown, test } from "mocha";
import * as sinon from "sinon";
import {
	FileHandlerRegistry,
	type LfsFileHandler,
} from "../../../../services/lfs/fileTypeHandlers";

function createMockHandler(extensions: string[], disposeFn?: () => void): LfsFileHandler {
	return {
		canHandle(filePath: string): boolean {
			return extensions.some((ext) => filePath.toLowerCase().endsWith(ext));
		},
		async displayFile(): Promise<void> {},
		getMimeType(): string {
			return "application/octet-stream";
		},
		dispose: disposeFn,
	};
}

suite("FileHandlerRegistry", () => {
	let registry: FileHandlerRegistry;

	setup(() => {
		registry = new FileHandlerRegistry();
	});

	teardown(() => {
		registry.dispose();
	});

	suite("register", () => {
		test("adds handler to registry", () => {
			const handler = createMockHandler([".pdf"]);
			registry.register(handler);
			assert.ok(registry.getHandler("file.pdf"));
		});

		test("supports multiple handlers", () => {
			registry.register(createMockHandler([".pdf"]));
			registry.register(createMockHandler([".png"]));
			assert.ok(registry.getHandler("file.pdf"));
			assert.ok(registry.getHandler("file.png"));
		});
	});

	suite("getHandler", () => {
		test("returns first matching handler", () => {
			const pdfHandler = createMockHandler([".pdf"]);
			const catchAll = createMockHandler([".pdf", ".png"]);
			registry.register(pdfHandler);
			registry.register(catchAll);

			const result = registry.getHandler("file.pdf");
			assert.strictEqual(result, pdfHandler);
		});

		test("returns undefined when no handler matches", () => {
			registry.register(createMockHandler([".pdf"]));
			assert.strictEqual(registry.getHandler("file.xlsx"), undefined);
		});

		test("returns undefined on empty registry", () => {
			assert.strictEqual(registry.getHandler("file.pdf"), undefined);
		});

		test("passes mimeType to canHandle", () => {
			const handler: LfsFileHandler = {
				canHandle(_filePath: string, mimeType?: string): boolean {
					return mimeType === "application/pdf";
				},
				async displayFile(): Promise<void> {},
				getMimeType(): string {
					return "application/pdf";
				},
			};
			registry.register(handler);
			assert.ok(registry.getHandler("file.bin", "application/pdf"));
			assert.strictEqual(registry.getHandler("file.bin"), undefined);
		});
	});

	suite("clear", () => {
		test("removes all handlers", () => {
			registry.register(createMockHandler([".pdf"]));
			registry.register(createMockHandler([".png"]));
			registry.clear();
			assert.strictEqual(registry.getHandler("file.pdf"), undefined);
			assert.strictEqual(registry.getHandler("file.png"), undefined);
		});

		test("calls dispose on handlers that implement it", () => {
			const disposeSpy = sinon.spy();
			registry.register(createMockHandler([".pdf"], disposeSpy));
			registry.clear();
			assert.ok(disposeSpy.calledOnce);
		});

		test("handles handlers without dispose method", () => {
			const handler: LfsFileHandler = {
				canHandle(): boolean {
					return true;
				},
				async displayFile(): Promise<void> {},
				getMimeType(): string {
					return "application/octet-stream";
				},
			};
			registry.register(handler);
			// Should not throw
			registry.clear();
		});

		test("handles dispose errors gracefully", () => {
			const badHandler = createMockHandler([".pdf"], () => {
				throw new Error("dispose failed");
			});
			registry.register(badHandler);
			// Should not throw
			registry.clear();
		});
	});

	suite("dispose", () => {
		test("calls clear", () => {
			const disposeSpy = sinon.spy();
			registry.register(createMockHandler([".pdf"], disposeSpy));
			registry.dispose();
			assert.ok(disposeSpy.calledOnce);
		});
	});
});
