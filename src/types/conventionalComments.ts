/**
 * Conventional Comments support for Azure DevOps PR comments
 * Based on https://conventionalcomments.org/
 */

/**
 * Standard conventional comment labels
 */
export enum ConventionalCommentLabel {
	Praise = "praise",
	Nitpick = "nitpick",
	Suggestion = "suggestion",
	Issue = "issue",
	Todo = "todo",
	Question = "question",
	Thought = "thought",
	Chore = "chore",
	Note = "note",
}

/**
 * Optional decorations for conventional comments
 */
export enum ConventionalCommentDecoration {
	Blocking = "blocking",
	NonBlocking = "non-blocking",
	IfMinor = "if-minor",
}

/**
 * Label metadata for UI display
 */
export interface LabelMetadata {
	label: ConventionalCommentLabel;
	icon: string;
	description: string;
	detail: string;
}

/**
 * Decoration metadata for UI display
 */
export interface DecorationMetadata {
	decoration: ConventionalCommentDecoration;
	description: string;
}

/**
 * Conventional comment structure
 */
export interface ConventionalComment {
	label: ConventionalCommentLabel;
	decorations: ConventionalCommentDecoration[];
	subject: string;
	discussion?: string;
}

/**
 * Metadata for all standard labels
 */
export const LABEL_METADATA: LabelMetadata[] = [
	{
		label: ConventionalCommentLabel.Praise,
		icon: "👏",
		description: "Praise: Highlight something positive",
		detail: "Call out something great! Should appear frequently in reviews.",
	},
	{
		label: ConventionalCommentLabel.Nitpick,
		icon: "🔍",
		description: "Nitpick: Minor, preference-based suggestion",
		detail: "Trivial preference-based requests (non-blocking by nature).",
	},
	{
		label: ConventionalCommentLabel.Suggestion,
		icon: "💡",
		description: "Suggestion: Propose an improvement",
		detail: "Propose improvements with explicit reasoning.",
	},
	{
		label: ConventionalCommentLabel.Issue,
		icon: "⚠️",
		description: "Issue: Highlight a specific problem",
		detail: "Problems requiring resolution before acceptance.",
	},
	{
		label: ConventionalCommentLabel.Todo,
		icon: "✅",
		description: "Todo: Small, necessary change",
		detail: "Small but necessary changes before acceptance.",
	},
	{
		label: ConventionalCommentLabel.Question,
		icon: "❓",
		description: "Question: Seek clarification",
		detail: "Clarify potential concerns requiring investigation.",
	},
	{
		label: ConventionalCommentLabel.Thought,
		icon: "💭",
		description: "Thought: Share an idea (non-blocking)",
		detail: "Ideas from review, non-blocking, mentoring-focused.",
	},
	{
		label: ConventionalCommentLabel.Chore,
		icon: "🔧",
		description: "Chore: Required task or process",
		detail: "Required tasks referencing standard processes.",
	},
	{
		label: ConventionalCommentLabel.Note,
		icon: "📝",
		description: "Note: Information for awareness",
		detail: "Information for reader awareness (always non-blocking).",
	},
];

/**
 * Metadata for all decorations
 */
export const DECORATION_METADATA: DecorationMetadata[] = [
	{
		decoration: ConventionalCommentDecoration.Blocking,
		description: "blocking - Must be resolved before acceptance",
	},
	{
		decoration: ConventionalCommentDecoration.NonBlocking,
		description: "non-blocking - Should not prevent acceptance",
	},
	{
		decoration: ConventionalCommentDecoration.IfMinor,
		description: "if-minor - Resolution required only if changes are trivial",
	},
];

/**
 * Format a conventional comment into the standard format
 * Format: label (decorations): subject
 *
 *         [discussion]
 */
export function formatConventionalComment(comment: ConventionalComment): string {
	const { label, decorations, subject, discussion } = comment;

	// Build decorations string if any
	const decorationStr =
		decorations.length > 0 ? ` (${decorations.join(", ")})` : "";

	// Build the comment header with label and subject
	let formatted = `${label}${decorationStr}: ${subject}`;

	// Add discussion if provided with clear separation
	if (discussion && discussion.trim()) {
		// Add double line break for clear visual separation
		formatted += `\n\n${discussion.trim()}`;
	}

	return formatted;
}

/**
 * Parse a conventional comment string into its components
 * Returns null if the string is not a valid conventional comment
 */
export function parseConventionalComment(
	text: string,
): ConventionalComment | null {
	// Pattern: label (decoration1, decoration2): subject
	const pattern =
		/^(praise|nitpick|suggestion|issue|todo|question|thought|chore|note)(?:\s*\(([^)]+)\))?\s*:\s*(.+?)(?:\n\n(.+))?$/is;

	const match = text.match(pattern);
	if (!match) {
		return null;
	}

	const [, label, decorationsStr, subject, discussion] = match;

	// Parse decorations
	const decorations: ConventionalCommentDecoration[] = [];
	if (decorationsStr) {
		const decorationParts = decorationsStr.split(",").map((d) => d.trim());
		for (const part of decorationParts) {
			if (Object.values(ConventionalCommentDecoration).includes(part as any)) {
				decorations.push(part as ConventionalCommentDecoration);
			}
		}
	}

	return {
		label: label as ConventionalCommentLabel,
		decorations,
		subject: subject.trim(),
		discussion: discussion?.trim(),
	};
}

/**
 * Check if a comment text is in conventional comment format
 */
export function isConventionalComment(text: string): boolean {
	return parseConventionalComment(text) !== null;
}

/**
 * Get label metadata by label
 */
export function getLabelMetadata(
	label: ConventionalCommentLabel,
): LabelMetadata | undefined {
	return LABEL_METADATA.find((m) => m.label === label);
}

/**
 * Get decoration metadata by decoration
 */
export function getDecorationMetadata(
	decoration: ConventionalCommentDecoration,
): DecorationMetadata | undefined {
	return DECORATION_METADATA.find((m) => m.decoration === decoration);
}
