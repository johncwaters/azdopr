# Enhance Comment UI Implementation Guide

## Overview
This document provides step-by-step instructions for enhancing the Azure DevOps PR extension's comment UI to match the polish and functionality of the GitHub Pull Requests extension.

## Background Research
The GitHub PR extension achieves its polished comment UI using **VS Code's native Comment API only** - no custom WebViews for inline comments. Key findings:

- They leverage VS Code's `Comment` interface properties extensively
- Use proposed APIs for advanced features (reactions, draft state)
- Implement sophisticated markdown processing
- Use `contextValue` for conditional menu rendering
- Apply proper timestamps and labels for better UX

## Implementation Phases

### Phase 1: Quick Wins (30 minutes)

#### 1.1 Add Timestamps to Comments
**File:** `src/providers/prCommentController.ts`

**Location:** In the `createCommentThread()` method, around line 316-327

**Current code:**
```typescript
const vscodeComment: vscode.Comment = {
    body: new vscode.MarkdownString(comment.content),
    mode: vscode.CommentMode.Preview,
    author: {
        name: comment.author.displayName,
        iconPath: comment.author.imageUrl
            ? vscode.Uri.parse(comment.author.imageUrl)
            : undefined,
    },
};
```

**Enhanced code:**
```typescript
const vscodeComment: vscode.Comment = {
    body: new vscode.MarkdownString(comment.content),
    mode: vscode.CommentMode.Preview,
    author: {
        name: comment.author.displayName,
        iconPath: comment.author.imageUrl
            ? vscode.Uri.parse(comment.author.imageUrl)
            : undefined,
    },
    timestamp: new Date(comment.publishedDate), // ADD THIS
};
```

**Note:** VS Code automatically formats timestamps relative to current time (e.g., "2 hours ago").

#### 1.2 Add Comment Labels
**Same location as above**

Add label property to distinguish pending/draft comments:

```typescript
const vscodeComment: vscode.Comment = {
    // ... existing properties
    timestamp: new Date(comment.publishedDate),
    label: comment.commentType === 1 ? "Pending" : undefined, // ADD THIS
};
```

**Result:** Comments will show badges like "Pending", "Draft" next to the author name.

---

### Phase 2: Enhanced Markdown (1 hour)

#### 2.1 Create Markdown Processing Utility
**New file:** `src/utils/markdownProcessor.ts`

```typescript
import * as vscode from "vscode";

export class MarkdownProcessor {
    /**
     * Process comment content into rich MarkdownString
     */
    static processCommentContent(content: string): vscode.MarkdownString {
        // Process the content
        let processed = content;

        // 1. Convert @mentions to links
        processed = this.linkifyMentions(processed);

        // 2. Convert Azure DevOps work item references (#123) to links
        processed = this.linkifyWorkItems(processed);

        // 3. Process code blocks for better formatting
        processed = this.enhanceCodeBlocks(processed);

        // Create markdown string with enhancements
        const markdown = new vscode.MarkdownString(processed);
        markdown.supportAlertSyntax = true; // Enable GitHub-style alerts
        markdown.isTrusted = true; // Enable command links
        markdown.supportHtml = false; // Security: disable raw HTML

        return markdown;
    }

    private static linkifyMentions(content: string): string {
        // Convert @username to clickable links
        // Azure DevOps format: @<GUID> or @DisplayName
        return content.replace(/@<([A-F0-9-]+)>/gi, '[@user](https://dev.azure.com)');
    }

    private static linkifyWorkItems(content: string): string {
        // Convert #123 to work item links
        // You'll need organization/project context for full URLs
        return content.replace(/#(\d+)/g, '[#$1](command:azdo.openWorkItem?$1)');
    }

    private static enhanceCodeBlocks(content: string): string {
        // Already handled by VS Code's markdown renderer
        return content;
    }
}
```

#### 2.2 Use Markdown Processor in Comment Controller
**File:** `src/providers/prCommentController.ts`

**Import at top:**
```typescript
import { MarkdownProcessor } from "../utils/markdownProcessor";
```

**Update comment creation:**
```typescript
const vscodeComment: vscode.Comment = {
    body: MarkdownProcessor.processCommentContent(comment.content), // CHANGE THIS
    mode: vscode.CommentMode.Preview,
    // ... rest of properties
};
```

---

### Phase 3: Context-Based Actions (45 minutes)

#### 3.1 Add contextValue to Comments
**File:** `src/providers/prCommentController.ts`

**Update comment creation to include context:**

```typescript
// Determine what actions are available for this comment
const contextValues: string[] = [];

// Check if user can edit (must be comment author)
const currentUser = await this.azureDevOpsClient.getCurrentUser();
if (comment.author.id === currentUser.id) {
    contextValues.push('canEdit');
    contextValues.push('canDelete');
}

// Check if comment has suggestion code
if (this.hasSuggestion(comment.content)) {
    contextValues.push('hasSuggestion');
}

const vscodeComment: vscode.Comment = {
    body: MarkdownProcessor.processCommentContent(comment.content),
    mode: vscode.CommentMode.Preview,
    author: {
        name: comment.author.displayName,
        iconPath: comment.author.imageUrl
            ? vscode.Uri.parse(comment.author.imageUrl)
            : undefined,
    },
    timestamp: new Date(comment.publishedDate),
    label: comment.commentType === 1 ? "Pending" : undefined,
    contextValue: contextValues.join(','), // ADD THIS
};
```

#### 3.2 Add Helper Method
```typescript
private hasSuggestion(content: string): boolean {
    // Check if comment contains code suggestion blocks
    return /```suggestion/i.test(content);
}
```

#### 3.3 Register Edit/Delete Commands
**File:** `src/providers/prCommentController.ts`

**In constructor, add command registrations:**

```typescript
this.disposables.push(
    // ... existing commands
    vscode.commands.registerCommand(
        "azdo-pr-comments.editComment",
        async (comment: vscode.Comment) => {
            await this.handleEditComment(comment);
        },
    ),
    vscode.commands.registerCommand(
        "azdo-pr-comments.deleteComment",
        async (comment: vscode.Comment) => {
            await this.handleDeleteComment(comment);
        },
    ),
);
```

#### 3.4 Add Menu Contributions
**File:** `package.json`

**Add to `contributes.commands`:**
```json
{
    "command": "azdo-pr-comments.editComment",
    "title": "Edit Comment",
    "icon": "$(edit)"
},
{
    "command": "azdo-pr-comments.deleteComment",
    "title": "Delete Comment",
    "icon": "$(trash)"
}
```

**Add to `contributes.menus`:**
```json
"comments/comment/title": [
    {
        "command": "azdo-pr-comments.editComment",
        "when": "commentController == azdo-pr-comments && comment =~ /canEdit/",
        "group": "inline@1"
    },
    {
        "command": "azdo-pr-comments.deleteComment",
        "when": "commentController == azdo-pr-comments && comment =~ /canDelete/",
        "group": "inline@2"
    }
]
```

#### 3.5 Implement Edit Handler
**File:** `src/providers/prCommentController.ts`

```typescript
private async handleEditComment(comment: vscode.Comment): Promise<void> {
    try {
        // Get current comment content
        const currentContent = typeof comment.body === 'string'
            ? comment.body
            : comment.body.value;

        // Prompt user to edit
        const newContent = await vscode.window.showInputBox({
            value: currentContent,
            prompt: "Edit your comment",
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value.trim()) {
                    return "Comment cannot be empty";
                }
                return null;
            },
        });

        if (!newContent) {
            return; // User cancelled
        }

        // Update comment via Azure DevOps API
        // You'll need to store comment ID in metadata
        // await this.azureDevOpsClient.updateComment(...);

        // Refresh comments to show the update
        vscode.window.showInformationMessage("Comment updated successfully");

        // TODO: Implement refresh for specific thread
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(`Failed to edit comment: ${errorMessage}`);
        console.error("Error editing comment:", error);
    }
}
```

---

### Phase 4: Reactions Support (2 hours)

#### 4.1 Check Azure DevOps API Support
First, verify that Azure DevOps supports comment reactions via their API. Check the [Azure DevOps REST API documentation](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments).

**If supported:**

#### 4.2 Add Reactions to Comment Interface
**File:** `src/providers/prCommentController.ts`

```typescript
const vscodeComment: vscode.Comment = {
    // ... existing properties
    reactions: comment.reactions?.map(r => ({
        label: this.getEmojiForReaction(r.type), // Convert type to emoji
        count: r.count,
        authorHasReacted: r.hasUserReacted,
    })) || [],
};
```

#### 4.3 Implement Reaction Handler
**File:** `src/providers/prCommentController.ts`

**In constructor:**
```typescript
this.commentController.reactionHandler = async (
    comment: vscode.Comment,
    reaction: vscode.CommentReaction
) => {
    await this.handleReaction(comment, reaction);
};
```

**Add method:**
```typescript
private async handleReaction(
    comment: vscode.Comment,
    reaction: vscode.CommentReaction
): Promise<void> {
    try {
        const existingReaction = comment.reactions?.find(
            r => r.label === reaction.label && r.authorHasReacted
        );

        if (existingReaction) {
            // Remove reaction
            await this.azureDevOpsClient.removeReaction(/* ... */);
        } else {
            // Add reaction
            await this.azureDevOpsClient.addReaction(/* ... */);
        }

        // Refresh the comment thread to show updated reactions
        // TODO: Implement selective refresh
    } catch (error) {
        console.error("Error handling reaction:", error);
        vscode.window.showErrorMessage("Failed to update reaction");
    }
}

private getEmojiForReaction(type: string): string {
    const emojiMap: Record<string, string> = {
        'like': '👍',
        'dislike': '👎',
        'heart': '❤️',
        'laugh': '😄',
        'confused': '😕',
        'celebrate': '🎉',
    };
    return emojiMap[type] || '👍';
}
```

---

### Phase 5: Thread State Management (1 hour)

#### 5.1 Add Thread State
**File:** `src/providers/prCommentController.ts`

**In `createCommentThread()` method:**

```typescript
// After creating the comment thread
commentThread.state = thread.status === 2 || thread.status === 4
    ? vscode.CommentThreadState.Resolved
    : vscode.CommentThreadState.Unresolved;
```

#### 5.2 Add Resolve/Unresolve Commands
**Add to package.json commands:**
```json
{
    "command": "azdo-pr-comments.resolveThread",
    "title": "Resolve Thread",
    "icon": "$(check)"
},
{
    "command": "azdo-pr-comments.unresolveThread",
    "title": "Unresolve Thread",
    "icon": "$(circle-slash)"
}
```

**Add to menus:**
```json
"comments/commentThread/title": [
    {
        "command": "azdo-pr-comments.resolveThread",
        "when": "commentController == azdo-pr-comments && commentThreadState == unresolved",
        "group": "inline"
    },
    {
        "command": "azdo-pr-comments.unresolveThread",
        "when": "commentController == azdo-pr-comments && commentThreadState == resolved",
        "group": "inline"
    }
]
```

---

## Testing Checklist

After implementing each phase, test:

- [ ] Timestamps appear and are formatted correctly
- [ ] Labels show for pending/draft comments
- [ ] Markdown links work (mentions, work items)
- [ ] Edit button appears only for user's own comments
- [ ] Delete button appears only for user's own comments
- [ ] Edit command updates the comment in Azure DevOps
- [ ] Delete command removes the comment
- [ ] Reactions appear and counts are correct (if supported)
- [ ] Adding/removing reactions works
- [ ] Thread state reflects resolved/unresolved status
- [ ] Resolve/unresolve commands work

---

## Known Limitations

### VS Code Comment API Constraints:
1. **No custom input widgets** - Cannot add dropdowns or buttons inside the comment box
2. **Single-line input** - InputBox shows multi-line text with `\n` visible
3. **No real-time editing** - Must refresh to show updates from other users
4. **Limited styling** - Cannot customize colors beyond VS Code themes

### Workarounds:
1. Use QuickPick menus before comment input (like conventional comments)
2. Use InputBox with `\n` for multi-line review/edit
3. Implement auto-refresh with configurable interval
4. Use contextValue and menus for conditional UI

---

## Advanced Features (Future)

### Proposed API Usage
To use VS Code's proposed APIs, add to package.json:

```json
"enabledApiProposals": [
    "commentingRangeHint",
    "commentsDraftState"
]
```

Then in code:
```typescript
commentThread.state = {
    resolved: vscode.CommentThreadState.Resolved,
    applicability: vscode.CommentThreadApplicability.Outdated
};
```

**Note:** Proposed APIs are unstable and may change between VS Code versions.

---

## Performance Considerations

1. **Cache comment threads** - Avoid recreating on every refresh
2. **Batch API calls** - Fetch multiple threads in one request
3. **Debounce refresh** - Don't refresh too frequently
4. **Lazy load** - Only load comments for visible documents

Example caching pattern:
```typescript
private readonly threadCache = new Map<string, vscode.CommentThread>();

// When creating thread
const cacheKey = `${document.uri.toString()}-${thread.id}`;
this.threadCache.set(cacheKey, commentThread);

// When refreshing
const cached = this.threadCache.get(cacheKey);
if (cached) {
    // Update existing thread instead of recreating
    cached.comments = newComments;
}
```

---

## References

- [VS Code Comment API Documentation](https://code.visualstudio.com/api/references/vscode-api#comments)
- [GitHub PR Extension Source](https://github.com/microsoft/vscode-pull-request-github)
- [Azure DevOps REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [Conventional Comments Spec](https://conventionalcomments.org/)

---

## Implementation Priority

**Recommended order:**

1. ✅ Phase 1: Timestamps and Labels (30 min) - **Do this first**
2. ✅ Phase 3: Context-based actions (45 min) - **High value**
3. ⏳ Phase 2: Enhanced Markdown (1 hour) - **Medium priority**
4. ⏳ Phase 4: Reactions (2 hours) - **If API supports it**
5. ⏳ Phase 5: Thread state (1 hour) - **Nice to have**

Total estimated time: **5-6 hours** for full implementation.

---

## Success Metrics

After implementation, comments should:
- ✅ Show when they were posted (timestamps)
- ✅ Distinguish pending/draft comments (labels)
- ✅ Allow editing own comments (contextValue menus)
- ✅ Process markdown links correctly
- ✅ Show author avatars (already working)
- ✅ Display inline in diff views (already working)
- ✅ Support resolve/unresolve state

This brings the comment UI to parity with the GitHub PR extension!
