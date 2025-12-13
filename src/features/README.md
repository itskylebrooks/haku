# Features

- Each subfolder (`day`, `week`, `board`, `settings`) owns its UI/data transforms and re-exports via `index.ts`.
- Avoid cross-feature imports; anything reusable should live under `src/shared`.
