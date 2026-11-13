# Privacy

**OriginLabs collects nothing.** There is no account, no telemetry, no
analytics, no advertising, no crash reporting and no third-party SDK. The
Android app declares no permissions at all, including no `INTERNET`, and the
WebView is configured to block network loads. Everything you enter stays in the
app's private storage until you explicitly export it.

This document describes exactly what is stored, where, and what leaves the
device.

## What the app stores

A single workspace document in WebView `localStorage`, key
`originlabs.workspace.v1`:

- workspace name, creation time and the principal label you chose;
- the append-only event log (charters, claims, evidence, gate decisions,
  artifacts, incidents, corrections);
- the ledger head hash and derived state;
- the synthetic demo workspace, if you opened it.

That is the entire data model. The app does not read contacts, files,
location, camera, microphone, clipboard (except when you tap **Copy head
hash**) or device identifiers. Import reads only the file you pick in the system
document picker.

The PWA stores the same document in the browser's `localStorage` for the Pages
origin, plus a service-worker cache of the app's own static files. The cache
holds code and demo data, not a copy of your exported files.

## What leaves the device

Nothing automatically.

- **Exports** happen only when you tap Export, Share or Copy. Saving writes a
  JSON file to `Downloads/OriginLabs/`; sharing hands one file to the app you
  choose in the Android share sheet; copying puts the head hash on the
  clipboard. All three are user-initiated.
- **Links** open in your browser only when you tap them, and only for
  `github.com`, `originlabs1.github.io` and `apps.obtainium.imranr.dev`.
- **The app itself never makes a network request.** There is no `fetch` in the
  app scripts, no `INTERNET` permission, and `setBlockNetworkLoads(true)` is
  set on the WebView.

## Hosting

The PWA at `https://originlabs1.github.io/OriginLabs/` is served by GitHub
Pages. When you first load it (and when the service worker checks for an
update), GitHub receives the request metadata any web host receives: IP
address, user agent, requested path and time. That is GitHub's processing, not
the app's; see the GitHub Privacy Statement. After the first load the service
worker serves the app from cache and the app continues to work offline.

Android releases are downloaded from GitHub Releases or through Obtainium.
Obtainium contacts GitHub to check for updates; the app does not.

## Android specifics

- **Permissions:** none. `aapt2 dump badging` on the release APK reports zero
  `uses-permission` entries.
- **Backup:** `android:allowBackup="false"` and
  `android:dataExtractionRules` exclude every data domain from cloud backup and
  device-to-device transfer.
- **Storage location:** the WebView data directory inside the app sandbox,
  protected by Android's per-app isolation and, when the device is locked, by
  file-based encryption.
- **Uninstall:** removes the workspace and the app's cache. Files you exported
  to Downloads remain until you delete them.

## PWA specifics

- Data is scoped to the Pages origin. Clearing site data removes it.
- Private/incognito windows discard it when closed.
- Browser storage can be evicted under storage pressure; export anything you
  need to keep.

## Deletion and retention

There is no server-side copy to delete. To erase local data:

1. **Lab → Wipe this device's workspace** removes the `localStorage` key after a
   confirmation. Export first if you want the history.
2. Uninstalling the Android app, or clearing site data for the PWA, removes
   everything the app stored.
3. Delete exported files from `Downloads/OriginLabs/` and any copies you shared.

Because the ledger is append-only by design, wiping a workspace is a local
deletion, not a cryptographic erasure. Old flash blocks may persist until the OS
reuses them.

## Data classes

The app supports data classes 0–4. Class 0 is public, class 1 internal, class 2
confidential and above is regulated. The app never uploads anything, so the
class mostly controls what the policy layer lets you write: class ≥ 2 payloads
may carry references and hashes but not raw content or long free text. Do not
enter personal data about other people unless you have a lawful basis to keep
it, even locally.

## Children

The app is a research tool, not directed at children, and collects no age or
identity information.

## Changes

This document describes v0.0.1. If a future version changes what is stored or
transmitted, the change will be stated in the release notes and this file will
be updated before the release. The version of this document ships in the
repository next to the code it describes.

## Contact

Privacy questions can be opened as a normal GitHub issue at
`https://github.com/OriginLabs1/OriginLabs/issues`. Security-sensitive reports
should use the private advisory form described in `SECURITY.md`.
