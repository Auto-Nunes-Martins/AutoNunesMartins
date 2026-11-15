Public branding assets for server-rendered social images only.

Current: `logo-preview.png` is an unchanged copy of the original public social
logo (`auto-nunes-martins-v1.png`). Only this asset is copied to the backend build.
The earlier font/text composition was rejected; legacy image URLs now serve the
logo without text rendering. The files below are retained experiment sources and
are no longer used by the renderer.

- `logo.png`: unchanged copy of `apps/website/static/logo-transparent-white-v3.png`.
- `Inter-SemiBold.woff2`: complete font from the Inter project's official
  https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-SemiBold.woff2
  retrieved 15 November 2026. Full Latin coverage includes Škoda. Distributed
  under the accompanying SIL Open Font License (`OFL.txt`).

The current logo asset is copied by `copy-social-assets.mjs` and is never imported
by browser code. The legacy homepage image can be regenerated
with `node --import tsx backend/scripts/generate-social-homepage.ts`.
