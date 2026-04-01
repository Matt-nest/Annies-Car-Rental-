---
name: ui-ux-pro-max
description: UI/UX design intelligence with searchable database
---

# ui-ux-pro-max

Comprehensive design guide for web and mobile applications. Contains 67 styles, 161 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types across 16 technology stacks. Searchable database with priority-based recommendations.

# Prerequisites

Check if Python is installed:

```bash
python3 --version || python --version
```

If Python is not installed, install it based on user's OS:

**macOS:**
```bash
brew install python3
```

---

## How to Use This Skill

Use this skill when the user requests any of the following:

| Scenario | Trigger Examples | Start From |
|----------|-----------------|------------|
| **New project / page** | "Build a landing page", "Build a dashboard" | Step 1 → Step 2 (design system) |
| **New component** | "Create a pricing card", "Add a modal" | Step 3 (domain search: style, ux) |
| **Choose style / color / font** | "What style fits a fintech app?" | Step 2 (design system) |
| **Review existing UI** | "Review this page for UX issues" | Quick Reference checklist |
| **Fix a UI bug** | "Button hover is broken", "Layout shifts on load" | Quick Reference → relevant section |
| **Improve / optimize** | "Make this faster", "Improve mobile experience" | Step 3 (domain search: ux, react) |
| **Implement dark mode** | "Add dark mode support" | Step 3 (domain: style "dark mode") |
| **Add charts / data viz** | "Add an analytics dashboard chart" | Step 3 (domain: chart) |
| **Stack best practices** | "React performance tips" | Step 4 (stack search) |

Follow this workflow:

### Step 1: Analyze User Requirements

Extract key information from user request:
- **Product type**: Entertainment, Tool, Productivity, or hybrid
- **Target audience**: Consider age group, usage context
- **Style keywords**: playful, vibrant, minimal, dark mode, content-first, immersive, etc.
- **Stack**: React/Next.js/Vite (this project uses Vite + React + Tailwind)

### Step 2: Generate Design System (REQUIRED)

**Always start with `--design-system`** to get comprehensive recommendations with reasoning:

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]
```

This command:
1. Searches domains in parallel (product, style, color, landing, typography)
2. Applies reasoning rules from `ui-reasoning.csv` to select best matches
3. Returns complete design system: pattern, style, colors, typography, effects
4. Includes anti-patterns to avoid

**Example:**
```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "car rental service premium dark" --design-system -p "Annie's Car Rental"
```

### Step 2b: Persist Design System

To save the design system for retrieval across sessions, add `--persist`:

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```

### Step 3: Supplement with Detailed Searches (as needed)

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

| Need | Domain | Example |
|------|--------|---------|
| Product type patterns | `product` | `--domain product "car rental service"` |
| More style options | `style` | `--domain style "glassmorphism dark"` |
| Color palettes | `color` | `--domain color "premium dark luxury"` |
| Font pairings | `typography` | `--domain typography "elegant modern"` |
| Chart recommendations | `chart` | `--domain chart "real-time dashboard"` |
| UX best practices | `ux` | `--domain ux "animation accessibility"` |
| Landing structure | `landing` | `--domain landing "hero social-proof"` |
| React perf | `react` | `--domain react "rerender memo list"` |

### Step 4: Stack Guidelines

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack react-native
```

---

## Tips for Better Results

- Use **multi-dimensional keywords** — combine product + industry + tone + density
- Use `--design-system` first for full recommendations, then `--domain` to deep-dive
- Always run the pre-delivery checklist before finalizing

### Pre-Delivery Checklist

Before delivering UI code, verify:

**Visual Quality:**
- [ ] No emojis used as icons (use SVG/Lucide instead)
- [ ] All icons from consistent icon family
- [ ] Semantic theme tokens used consistently
- [ ] Pressed-state visuals don't shift layout

**Interaction:**
- [ ] All interactive elements provide clear hover/focus feedback
- [ ] Touch targets meet minimum size (≥44×44pt)
- [ ] Micro-interaction timing 150-300ms with native easing
- [ ] Disabled states are visually clear

**Light/Dark Mode:**
- [ ] Primary text contrast ≥4.5:1 in both modes
- [ ] Secondary text contrast ≥3:1 in both modes
- [ ] Borders/dividers visible in both modes
- [ ] Both themes tested before delivery

**Layout:**
- [ ] Safe areas respected for fixed elements
- [ ] Scroll content not hidden behind sticky bars
- [ ] Verified on small phone, desktop, and tablet
- [ ] 4/8px spacing rhythm maintained
