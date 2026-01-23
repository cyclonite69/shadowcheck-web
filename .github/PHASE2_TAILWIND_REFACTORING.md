# Phase 2: Extended Tailwind CSS Refactoring

**Status**: Ready to Start  
**Prerequisites**: Phase 1 complete (commit bc0a7de)  
**Reference Guide**: `.cursor/rules/tailwind-css-refactoring.md`

## Overview

Continue refactoring remaining React components to follow utility-first Tailwind approach. Build on Phase 1 foundation.

## Components to Refactor

- [ ] `src/components/DashboardPage.tsx`
  - Metric cards with card styling
  - Dashboard grid layout
  - Status indicators/badges

- [ ] `src/components/AnalyticsPage.tsx`
  - Chart containers and panels
  - Time-range selector styling
  - Data visualization containers

- [ ] `src/components/GeospatialIntelligencePage.tsx`
  - Map panel backgrounds
  - Sidebar styling
  - Info cards and overlays

- [ ] `src/components/NetworksExplorer.tsx`
  - Table header/row styling
  - Filter styling
  - Status colors

- [ ] `src/components/ThreatsExplorer.tsx`
  - Alert boxes
  - Threat level indicators
  - Badge styling

## Instructions for Each Component

### Using Cursor Codex

Reference the template prompt in `.cursor/rules/tailwind-css-refactoring.md`:

```
Refactor [ComponentName].tsx for Tailwind CSS

Goal
Replace inline styles and hardcoded colors with Tailwind utilities.

Constraints
- Do NOT change component logic or props
- Do NOT alter HTML structure
- Preserve all accessibility attributes (aria-*, role)
- Use only colors from Tailwind palette or CSS variables
- If a gradient is needed, extract to @layer components in src/index.css

Files to Reference
@tailwind.config.js - for color palette, z-index tokens
@src/index.css - for custom CSS classes (gradients, shadows, text effects)
@src/components/AdminPage.tsx - working example of refactored component

Changes Needed
- Replace all style={{}} with className
- Map hardcoded hex/rgba to Tailwind colors
- Replace custom shadows with shadow-lg / shadow-xl
- Update z-index values to z-modal or z-dropdown
- Extract complex gradients to custom CSS class in index.css

Success Criteria
- npm run lint passes
- npm run build succeeds
- Visual appearance unchanged
- No new console errors

After Completion
1. Show git diff of changes
2. Run: npm run lint && npm run build
3. Report bundle size of dist/assets/index-*.css
```

### Color Conversion Cheatsheet

| Hardcoded         | Tailwind Class    |
| ----------------- | ----------------- |
| `#0f172a`         | `bg-slate-950`    |
| `#1e293b`         | `bg-slate-800`    |
| `#334155`         | `bg-slate-700`    |
| `#ef4444`         | `text-red-500`    |
| `#3b82f6`         | `text-blue-500`   |
| `rgba(..., 0.95)` | Use `/95` opacity |
| `rgba(..., 0.8)`  | Use `/80` opacity |

See `.cursor/rules/tailwind-css-refactoring.md` for full cheatsheet.

### Working Examples

Reference these already-refactored components:

- **AdminPage.tsx** — Hardcoded hex colors → Tailwind
- **MLTrainingPage.tsx** — Gradient extraction to custom CSS
- **KeplerTestPage.tsx** — Shadow/border conversion
- **FilterPanel.tsx** — Responsive width handling

### Testing Before Commit

```bash
# 1. Run linter
npm run lint

# 2. Run build
npm run build

# 3. Check CSS bundle size
ls -lh dist/assets/index-*.css

# 4. Visual regression check
# - Open component in browser
# - Compare with original (if available in git)
# - Verify colors, spacing, shadows are identical
```

## Commit Message Template

```
refactor(components): convert [ComponentName] to Tailwind CSS

- Replace inline style={{}} with Tailwind utilities
- Map hardcoded hex colors to palette tokens
- Replace custom shadows with shadow-lg/shadow-xl
- Extract [any] complex gradients to src/index.css
- No logic changes, visual appearance preserved

Closes #PHASE2-[ComponentName]
```

## Phase Completion Criteria

✅ All 5 components refactored  
✅ npm run lint passes  
✅ npm run build succeeds  
✅ CSS bundle size stable or improved  
✅ No visual regressions  
✅ Commit with summary

## When to Ask for Help

❌ Stop if:

- Component logic changes are needed
- HTML structure must change
- A style can't be replicated with Tailwind

✅ Safe to proceed with:

- Replacing hardcoded colors
- Extracting gradients/shadows
- Converting spacing/sizing
- Updating z-index values

## Resources

- Tailwind Docs: https://tailwindcss.com/docs (v4)
- Cursor Rules: .cursor/rules/tailwind-css-refactoring.md
- Phase 1 Summary: docs/TAILWIND_REFACTORING_COMPLETE.md
- Phase 1 Commit: bc0a7de

Ready to start? Pick a component from the list and use the Codex prompt template above.

Questions? Reference .cursor/rules/tailwind-css-refactoring.md Rule 10 ("When to Ask for Help").
