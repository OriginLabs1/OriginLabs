# Draft F-Droid recipe — not submitted

This directory is a **staging draft** for a future F-Droid listing. No listing
exists and F-Droid is not a supported channel for v0.0.1. The GitHub release and
the Pages PWA are the supported channels.

`metadata/com.oneorigin.labs.yml` mirrors the file that would live in the
`fdroiddata` repository at `metadata/com.oneorigin.labs.yml`. The `en-US/`
folder is fastlane metadata that would live at
`metadata/com.oneorigin.labs/en-US/` in `fdroiddata` (or under
`fastlane/metadata/android/en-US/` in this repository).

Before opening a merge request against `fdroiddata`:

1. Tag the exact release commit and set `commit:` in the YAML to that tag.
2. Check that the F-Droid buildserver has a Rust toolchain with the
   `wasm32-unknown-unknown` target. If not, either vendor the wasm build or
   teach the recipe to build the core natively and skip the wasm step — the app
   requires the embedded wasm, so the first option is simpler.
3. Confirm the recipe produces an **unsigned** APK. `ORIGINLABS_UNSIGNED=1` is
   set in the build step; F-Droid signs the output with its own key.
4. Add at least two phone screenshots under `en-US/images/phoneScreenshots/`.
5. Run `fdroid lint com.oneorigin.labs` and `fdroid build com.oneorigin.labs`
   locally before submitting.
6. Expect review comments about the custom, non-Gradle build. The recipe uses
   `sudo` to install JDK 21 and the Debian Android CLI tools, downloads the
   API 34 platform jar and D8 from their documented URLs, and calls the same
   scripts used for the GitHub release.

The application ID is `com.oneorigin.labs`; it must never change. F-Droid
re-signs the APK, so an F-Droid build cannot be installed as an update over a
GitHub-signed APK, and vice versa. Users must pick one channel.
