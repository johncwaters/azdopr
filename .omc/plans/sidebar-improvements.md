# Sidebar Visual Clarity Improvement Plan

## Goal
Enable users to identify PRs needing review at a glance with minimal cognitive load.

---

## Current State Analysis

### What Works
- ✅ Clean 3-level hierarchy (Project → Repository → PR)
- ✅ Tooltips provide rich detail on hover
- ✅ Draft PRs distinguished with gray icon
- ✅ Shows author and age in description

### Pain Points
1. **No "needs your review" distinction** - All PRs look similar regardless of review status
2. **Emoji badges blend into text** - Hard to scan quickly (✅❌🚫⏳ prefixed to title)
3. **No urgency indication** - Old PRs don't stand out visually
4. **No sorting by review priority** - PRs sorted by age, not actionability
5. **Repos collapsed by default** - Requires clicking to see PRs
6. **No badge counts** - VS Code TreeItem.badge API unused

---

## Proposed Improvements

### Priority 1: "Needs Your Review" Visual Distinction (High Impact)

**Problem:** Users can't tell which PRs need their attention.

**Solution:**
- Use VS Code's `resourceUri` + `ThemeIcon` color to change the **entire row color** for unreviewed PRs
- PRs where you're a reviewer but haven't voted → **orange/yellow icon** (`charts.orange`)
- PRs you've already reviewed → keep current green or show gray
- PRs you authored → different icon (`git-pull-request-create`)

```typescript
// Proposed icon logic
if (isAuthor) {
  icon = "git-pull-request-create" // Your own PRs
  color = "charts.blue"
} else if (needsYourReview) {
  icon = "git-pull-request"
  color = "charts.orange" // ACTION NEEDED
} else if (youApproved) {
  icon = "git-pull-request"
  color = "charts.green" // Done
} else if (youRejected) {
  icon = "git-pull-request"
  color = "charts.red"
}
```

### Priority 2: Badge Counts on Repositories (Medium Impact)

**Problem:** Users must expand repos to see if there are PRs needing attention.

**Solution:** Use VS Code's `TreeItem.badge` API to show counts on repo nodes.

```typescript
repoItem.badge = {
  value: needsReviewCount,
  tooltip: `${needsReviewCount} PRs need your review`
};
```

Display: `frontend (3)` with a badge showing "2" if 2 PRs need review.

### Priority 3: Simplify Status Indicators (Medium Impact)

**Problem:** Emoji prefixes (✅❌🚫⏳) in titles are visually noisy.

**Solution:**
- Remove emoji prefixes from PR titles (cleaner look)
- Rely on **icon color** to convey your review status
- Use **description field** to show status text for blocked PRs
- Keep emoji details in tooltips

**Before:** `✅ 🚫 Fix login bug`
**After:** `Fix login bug` (green icon = you approved, description shows "Blocked by rejection")

### Priority 4: Age-Based Urgency Styling (Medium Impact)

**Problem:** PRs aging in queue don't stand out.

**Solution:** Add visual urgency for old PRs:
- 7+ days: Add ⚠️ prefix or use `charts.yellow` icon tint
- 14+ days: Add warning in description "Stale - 2 weeks"
- 30+ days: Use `charts.red` tint

### Priority 5: Smart Sorting Within Repos (Low Impact)

**Problem:** PRs sorted by age only, not actionability.

**Solution:** Sort PRs within each repo by priority:
1. **Needs your review** (unvoted, you're reviewer)
2. **Blocked** (has rejections)
3. **Waiting for author**
4. **Already reviewed by you**

### Priority 6: Optional "Needs Review" Section (Future Enhancement)

**Problem:** PRs requiring action are scattered across repos.

**Solution:** Add a top-level "Needs Your Review" virtual folder that aggregates all PRs awaiting your review across all repos.

```
📂 Needs Your Review (4)
   └─ PR #123: Fix login bug
   └─ PR #456: Add caching
📂 MyProject (12)
   └─ frontend (5)
   └─ backend (7)
```

---

## Implementation Order

| Phase | Change | Effort | Impact |
|-------|--------|--------|--------|
| 1 | Icon colors for review status | Low | High |
| 2 | Badge counts on repos | Low | Medium |
| 3 | Remove emoji prefixes, use description | Low | Medium |
| 4 | Sort by actionability | Low | Medium |
| 5 | Age-based urgency | Low | Medium |
| 6 | "Needs Review" section | Medium | High |

---

## Visual Mockup (Text Representation)

### Before
```
▼ 📁 MyProject (5)
  ▶ 📂 frontend (3)
  ▶ 📂 backend (2)
```
(Must expand to see anything)

### After
```
▼ ⚡ Needs Your Review (2)          ← New section
    🟠 Fix login bug               ← Orange = needs review
    🟠 Add rate limiting
▼ 📁 MyProject (5)
  ▼ 📂 frontend (3)        [2]     ← Badge shows 2 need review
      🟢 Update README             ← Green = you approved
      🟠 Fix login bug             ← Orange = needs review
      🟠 Add caching               ← Orange = needs review
  ▶ 📂 backend (2)         [0]     ← No badge = nothing needs review
```

---

## Key Files to Modify

1. `src/providers/pullRequestProvider.ts` - Main implementation
   - `createPRTreeItem()` - Icon/color logic
   - `getGroupedByProjectView()` - Sorting and badge counts
   - Add new `getNeedsReviewSection()` method

2. `src/services/azureDevOpsClient.ts` - May need to expose user ID better

---

## Questions for Consideration

1. Should "Your PRs" (PRs you authored) be in a separate section?
2. Should repos with no actionable PRs be auto-collapsed?
3. Should we add a filter toggle to show "only needs review"?
