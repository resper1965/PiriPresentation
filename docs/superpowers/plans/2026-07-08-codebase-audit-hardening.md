# Codebase Audit Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden and improve SabrinaStyle Builder without changing its core user flow.

**Architecture:** Keep the current Vite/React plus Hono Worker shape, but extract slide parsing/sanitization into a focused service and make API validation explicit. Load heavy PPTX export code on demand to reduce initial bundle pressure.

**Tech Stack:** React 19, Vite 6, TypeScript 5, Hono, Cloudflare Workers AI, pptxgenjs.

## Global Constraints

- Do not add runtime dependencies unless required.
- Preserve current visual identity and Portuguese UI copy.
- Treat AI-generated content as untrusted.
- Verify with `npm run build`.

---

### Task 1: Worker API Hardening

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Produces: HTTP 400 for invalid input, HTTP 502 for AI failures, JSON responses with `error` for failures.

- [ ] Add request validation helpers for text, skills, and custom instructions.
- [ ] Apply validation to `/api/critique` and `/api/generate`.
- [ ] Keep successful response shapes unchanged.

### Task 2: Frontend API Error Handling

**Files:**
- Modify: `src/frontend/services/aiService.ts`

**Interfaces:**
- Produces: `callCritique` and `callGenerateSlides` throw `Error` when the API returns non-2xx.

- [ ] Add a shared `readJsonResponse` helper.
- [ ] Preserve existing TypeScript response interfaces.

### Task 3: Slide Parser And Sanitizer Extraction

**Files:**
- Create: `src/frontend/types.ts`
- Create: `src/frontend/services/slidesParser.ts`
- Modify: `src/frontend/App.tsx`

**Interfaces:**
- Produces: `parseSlides(markdown: string): SlideData[]`.
- Produces: `SlideData` type shared by app and exporters.

- [ ] Move `SlideData` out of `App.tsx`.
- [ ] Move Markdown parsing into `slidesParser.ts`.
- [ ] Sanitize generated HTML before it reaches `dangerouslySetInnerHTML` or HTML export.

### Task 4: PPTX Lazy Loading And UX

**Files:**
- Modify: `src/frontend/App.tsx`
- Modify: `src/frontend/services/pptxExporter.ts`
- Modify: `src/frontend/index.css`

**Interfaces:**
- Produces: dynamic import for PPTX export button.
- Produces: responsive slide frame and nav controls.

- [ ] Replace static PPTX exporter import with dynamic import.
- [ ] Add export loading feedback.
- [ ] Make slideshow controls wrap cleanly on narrow screens.

### Task 5: Verification

**Files:**
- Build output: `dist/`

- [ ] Run `npm run build`.
- [ ] Inspect output for TypeScript errors and Vite warnings.
