Public branding assets for server-rendered social images only.

- `logo.png`: unchanged copy of `apps/website/static/logo-transparent-white-v3.png`.
- `Inter-SemiBold.woff2`: complete font from the Inter project's official
  https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-SemiBold.woff2
  retrieved 15 November 2026. Full Latin coverage includes Škoda. Distributed
  under the accompanying SIL Open Font License (`OFL.txt`).

These assets are copied into the compiled backend by `copy-social-assets.mjs`.
They are never imported by browser code. The homepage image can be regenerated
with `node --import tsx backend/scripts/generate-social-homepage.ts`.
