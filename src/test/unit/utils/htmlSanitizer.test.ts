import * as assert from "node:assert";
import { suite, test } from "mocha";
import {
	autoLinkUrls,
	escapeAttribute,
	escapeHtml,
	sanitizeHtml,
} from "../../../utils/htmlSanitizer";

suite("htmlSanitizer", () => {
	suite("sanitizeHtml", () => {
		test("returns empty string for null/undefined/empty", () => {
			assert.strictEqual(sanitizeHtml(null), "");
			assert.strictEqual(sanitizeHtml(undefined), "");
			assert.strictEqual(sanitizeHtml(""), "");
		});

		test("preserves plain text", () => {
			assert.strictEqual(sanitizeHtml("Hello world"), "Hello world");
		});

		suite("allowed tags", () => {
			test("preserves anchor tags with safe href", () => {
				const input = '<a href="https://example.com">link</a>';
				const result = sanitizeHtml(input);
				assert.ok(result.includes("href="));
				assert.ok(result.includes("</a>"));
			});

			test("preserves br tags", () => {
				assert.strictEqual(sanitizeHtml("line1<br>line2"), "line1<br>line2");
				assert.strictEqual(sanitizeHtml("line1<br/>line2"), "line1<br>line2");
			});

			test("preserves strong and em tags", () => {
				assert.strictEqual(sanitizeHtml("<strong>bold</strong>"), "<strong>bold</strong>");
				assert.strictEqual(sanitizeHtml("<em>italic</em>"), "<em>italic</em>");
			});

			test("preserves b and i tags", () => {
				assert.strictEqual(sanitizeHtml("<b>bold</b>"), "<b>bold</b>");
				assert.strictEqual(sanitizeHtml("<i>italic</i>"), "<i>italic</i>");
			});

			test("preserves p tags", () => {
				assert.strictEqual(sanitizeHtml("<p>paragraph</p>"), "<p>paragraph</p>");
			});

			test("preserves code and pre tags", () => {
				assert.strictEqual(sanitizeHtml("<code>x</code>"), "<code>x</code>");
				assert.strictEqual(sanitizeHtml("<pre>block</pre>"), "<pre>block</pre>");
			});

			test("preserves span tags", () => {
				assert.strictEqual(sanitizeHtml("<span>text</span>"), "<span>text</span>");
			});

			test("preserves class attribute on span/code/pre", () => {
				const input = '<span class="highlight">text</span>';
				const result = sanitizeHtml(input);
				assert.strictEqual(result, '<span class="highlight">text</span>');
			});

			test("strips non-class attributes from span/code/pre", () => {
				const input = '<span style="color:red" onclick="alert(1)">text</span>';
				const result = sanitizeHtml(input);
				assert.strictEqual(result, "<span>text</span>");
			});
		});

		suite("disallowed tags", () => {
			test("strips script tags (tags removed, content remains)", () => {
				const result = sanitizeHtml("<script>alert(1)</script>");
				assert.ok(!result.includes("<script"));
				assert.ok(!result.includes("</script>"));
			});

			test("strips iframe tags", () => {
				assert.strictEqual(sanitizeHtml('<iframe src="evil.com"></iframe>'), "");
			});

			test("strips img tags", () => {
				assert.strictEqual(sanitizeHtml('<img src="x.png">'), "");
			});

			test("strips object tags", () => {
				assert.strictEqual(sanitizeHtml('<object data="x"></object>'), "");
			});

			test("strips form tags", () => {
				assert.strictEqual(sanitizeHtml('<form action="evil"><input></form>'), "");
			});

			test("strips style tags", () => {
				assert.strictEqual(sanitizeHtml("<style>body{display:none}</style>"), "body{display:none}");
			});

			test("strips event handler attributes from allowed tags", () => {
				const input = '<strong onclick="alert(1)">bold</strong>';
				const result = sanitizeHtml(input);
				assert.strictEqual(result, "<strong>bold</strong>");
			});
		});

		suite("XSS vectors", () => {
			test("blocks javascript: URLs in hrefs", () => {
				const input = '<a href="javascript:alert(1)">click</a>';
				const result = sanitizeHtml(input);
				assert.ok(!result.includes("javascript:"));
			});

			test("blocks data: URLs in hrefs", () => {
				const input = '<a href="data:text/html,payload">click</a>';
				const result = sanitizeHtml(input);
				// The href should be stripped (not included in the sanitized anchor)
				assert.ok(!result.includes('href="data:'));
			});

			test("blocks vbscript: URLs", () => {
				const input = '<a href="vbscript:msgbox(1)">click</a>';
				const result = sanitizeHtml(input);
				assert.ok(!result.includes("vbscript:"));
			});

			test("blocks entity-encoded javascript: URLs", () => {
				const input =
					'<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">click</a>';
				const result = sanitizeHtml(input);
				assert.ok(!result.includes("javascript"));
			});

			test("blocks hex-encoded javascript: URLs", () => {
				const input =
					'<a href="&#x6a;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;&#x3a;alert(1)">click</a>';
				const result = sanitizeHtml(input);
				assert.ok(!result.includes("javascript"));
			});

			test("blocks javascript: with whitespace obfuscation", () => {
				const input = '<a href="java\tscript:alert(1)">click</a>';
				const result = sanitizeHtml(input);
				assert.ok(!result.includes("javascript"));
			});

			test("strips full script blocks with content", () => {
				const input = "before<script>var x = 1; alert(x);</script>after";
				const result = sanitizeHtml(input);
				assert.ok(!result.includes("script"));
				assert.ok(result.includes("before"));
				assert.ok(result.includes("after"));
			});
		});

		suite("anchor tag sanitization", () => {
			test("adds rel=noopener noreferrer for target=_blank", () => {
				const input = '<a href="https://example.com" target="_blank">link</a>';
				const result = sanitizeHtml(input);
				assert.ok(result.includes('rel="noopener noreferrer"'));
			});

			test("preserves title attribute", () => {
				const input = '<a href="https://example.com" title="Example">link</a>';
				const result = sanitizeHtml(input);
				assert.ok(result.includes("title="));
			});

			test("allows https URLs", () => {
				const input = '<a href="https://dev.azure.com/org">link</a>';
				const result = sanitizeHtml(input);
				assert.ok(result.includes("https://dev.azure.com/org"));
			});

			test("allows mailto URLs", () => {
				const input = '<a href="mailto:user@example.com">email</a>';
				const result = sanitizeHtml(input);
				assert.ok(result.includes("mailto:"));
			});

			test("allows relative URLs", () => {
				const input = '<a href="/path/to/page">link</a>';
				const result = sanitizeHtml(input);
				assert.ok(result.includes("/path/to/page"));
			});
		});
	});

	suite("escapeHtml", () => {
		test("returns empty string for null/undefined", () => {
			assert.strictEqual(escapeHtml(null), "");
			assert.strictEqual(escapeHtml(undefined), "");
		});

		test("escapes ampersand", () => {
			assert.strictEqual(escapeHtml("a & b"), "a &amp; b");
		});

		test("escapes angle brackets", () => {
			assert.strictEqual(escapeHtml("<div>"), "&lt;div&gt;");
		});

		test("escapes quotes", () => {
			assert.strictEqual(escapeHtml('"hello"'), "&quot;hello&quot;");
			assert.strictEqual(escapeHtml("'hello'"), "&#039;hello&#039;");
		});

		test("escapes multiple special characters", () => {
			assert.strictEqual(
				escapeHtml('<script>alert("xss")</script>'),
				"&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
			);
		});

		test("preserves normal text", () => {
			assert.strictEqual(escapeHtml("Hello world 123"), "Hello world 123");
		});
	});

	suite("escapeAttribute", () => {
		test("escapes ampersand", () => {
			assert.strictEqual(escapeAttribute("a&b"), "a&amp;b");
		});

		test("escapes double quotes", () => {
			assert.strictEqual(escapeAttribute('say "hi"'), "say &quot;hi&quot;");
		});

		test("escapes single quotes", () => {
			assert.strictEqual(escapeAttribute("it's"), "it&#039;s");
		});

		test("escapes angle brackets", () => {
			assert.strictEqual(escapeAttribute("<>"), "&lt;&gt;");
		});
	});

	suite("autoLinkUrls", () => {
		test("returns empty string for empty input", () => {
			assert.strictEqual(autoLinkUrls(""), "");
		});

		test("converts plain http URL to link", () => {
			const result = autoLinkUrls("Visit http://example.com today");
			assert.ok(result.includes('<a href="http://example.com"'));
			assert.ok(result.includes('target="_blank"'));
			assert.ok(result.includes('rel="noopener noreferrer"'));
		});

		test("converts plain https URL to link", () => {
			const result = autoLinkUrls("Visit https://example.com today");
			assert.ok(result.includes('<a href="https://example.com"'));
		});

		test("strips trailing punctuation from URL", () => {
			const result = autoLinkUrls("See https://example.com.");
			assert.ok(result.includes('href="https://example.com"'));
			assert.ok(result.endsWith("."));
		});

		test("does not double-link URLs already in anchor tags", () => {
			const input = '<a href="https://example.com">https://example.com</a>';
			const result = autoLinkUrls(input);
			// Should not create nested anchor tags
			const anchorCount = (result.match(/<a /g) || []).length;
			assert.strictEqual(anchorCount, 1);
		});

		test("handles multiple URLs in text", () => {
			const result = autoLinkUrls("See https://a.com and https://b.com");
			const anchorCount = (result.match(/<a /g) || []).length;
			assert.strictEqual(anchorCount, 2);
		});

		test("preserves text without URLs", () => {
			assert.strictEqual(autoLinkUrls("no urls here"), "no urls here");
		});
	});
});
