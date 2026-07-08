# Codebase Audit Hardening Design

## Goal

Improve SabrinaStyle Builder across security, robustness, maintainability, and UX without changing its core workflow.

## Scope

- Harden the Worker API request and response handling.
- Sanitize AI-generated slide HTML before rendering or exporting.
- Split slide parsing/types out of `App.tsx`.
- Load the PPTX exporter only when the user requests a PowerPoint download.
- Improve API error handling and responsive slide controls.

## Architecture

The frontend keeps the current React/Vite structure. Shared slide types move into a small `types.ts` module, slide Markdown parsing and sanitization move into `services/slidesParser.ts`, and `App.tsx` remains responsible for state and view orchestration.

The backend keeps a single Hono worker, but request validation and response parsing are made explicit. Invalid input returns 400, malformed AI output returns a controlled fallback payload, and upstream AI failures return a non-2xx error that the frontend can display.

## Security

AI-generated HTML is treated as untrusted. Only the small set of tags and classes needed for slide layouts is allowed. Event handlers, inline styles, scripts, links, media, and unknown attributes are removed.

## UX

The UI should show actionable errors from the API, avoid blocking initial page load with PPTX export code, and keep slide navigation usable on narrower screens.

## Verification

Run `npm run build` after the changes. The expected result is a passing TypeScript check and Vite production build.
