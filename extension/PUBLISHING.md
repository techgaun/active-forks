# Publishing the extension

Merges to `main` that touch `extension/` **and bump `"version"` in
`manifest.json`** are published automatically to the Chrome Web Store and
Firefox Add-ons (AMO) by
[`.github/workflows/publish-extension.yml`](../.github/workflows/publish-extension.yml).
If the version is unchanged, the workflow skips publishing (both stores
reject re-uploads of a published version), so a release is: bump the
version in your PR, merge.

The workflow can also be run manually from the Actions tab
(`workflow_dispatch`), with a `force` option to attempt publishing without a
version change.

## One-time setup

Automation can only *update* an existing listing — the **first submission to
each store must be done manually**, and each store needs API credentials
stored as GitHub repository secrets (Settings → Secrets and variables →
Actions).

### Chrome Web Store

1. Register as a [Chrome Web Store developer](https://chrome.google.com/webstore/devconsole)
   (one-time $5 fee).
2. Zip the `extension/` directory contents (`cd extension && zip -r ../ext.zip .`)
   and upload it as a new item in the developer console; complete the listing
   (description, screenshots, privacy declarations) and submit for review.
3. Note the extension ID from the console URL → secret `CHROME_EXTENSION_ID`.
4. Create OAuth credentials for the Chrome Web Store API — follow the
   [chrome-webstore-upload guide](https://github.com/fregante/chrome-webstore-upload/blob/main/How%20to%20generate%20Google%20API%20keys.md):
   enable the "Chrome Web Store API" on a Google Cloud project, create an
   OAuth client, and generate a refresh token. Store as secrets:
   - `CHROME_CLIENT_ID`
   - `CHROME_CLIENT_SECRET`
   - `CHROME_REFRESH_TOKEN`

### Firefox Add-ons (AMO)

1. Sign in at [addons.mozilla.org](https://addons.mozilla.org/developers/)
   and submit the first version manually ("Submit a New Add-on", listed
   channel), completing the listing. The add-on ID is already pinned by
   `browser_specific_settings.gecko.id` in the manifest
   (`active-forks@techgaun.github.io`) — don't change it.
2. Generate API credentials at
   [Manage API Keys](https://addons.mozilla.org/developers/addon/api/key/)
   and store as secrets:
   - `AMO_JWT_ISSUER` (the "JWT issuer")
   - `AMO_JWT_SECRET` (the "JWT secret")

## Notes

- AMO reviews listed versions after upload; the workflow exits once the
  upload validates rather than waiting for review to finish
  (`--approval-timeout 0`). Chrome's `--auto-publish` submits for review and
  publishes when approved.
- The packaged zip for each published version is attached to the workflow
  run as an artifact.
- Keep `"version"` a plain `x.y.z` — both stores are strict about formats.
