# iTools Web preview

This React and Vite app previews the Stage 2 Material 3 application shell and tool flows. It uses only the `@itools/design-system-adapter` exports for base UI components; app-owned layout and page styles live in CSS Modules.

## Run locally

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @itools/design-system-adapter build
pnpm --filter @itools/web dev
```

Open the local Vite URL printed by the dev command. The app has in-memory navigation and theme state, so reloading returns to the home preview.

## Preview interactions

- Browse sample categories with the desktop rail or the narrow-screen navigation drawer.
- Search tools with the search button or `Ctrl+K` / `Cmd+K`; use arrow keys and Enter to choose a result.
- Open the recent-task sample panel and its all-tasks page.
- Visit a tool page to see the ordered input, workspace, task-status, result, and attribution sections.
- Open the admin preview to try sample form validation, status switches, and the create-tool dialog.

All catalog entries, jobs, progress, and results are static UI samples. The app is not connected to tool execution, a database, server persistence, or authentication.

## Checks

```sh
pnpm --filter @itools/web typecheck
pnpm --filter @itools/web test
pnpm --filter @itools/web build
```
