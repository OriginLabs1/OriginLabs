#!/bin/sh
# Build and sign the OriginLabs Android APK without Gradle.
#
# Requirements:
#   * JDK 17+ (javac, keytool)
#   * Android build-tools (aapt2, zipalign, apksigner)
#   * toolchain/android-34.jar and toolchain/r8.jar
#   * a keystore from scripts/gen-keys.sh (or CI secrets), unless
#     ORIGINLABS_UNSIGNED=1 is set, in which case the APK is left unsigned for
#     the caller (F-Droid, CI inspection) to sign.
#
# The APK has no INTERNET permission and embeds the offline web surface plus the
# Rust core compiled to WebAssembly.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

VERSION_NAME=${ORIGINLABS_VERSION_NAME:-0.0.1}
VERSION_CODE=${ORIGINLABS_VERSION_CODE:-1}
ANDROID_JAR=${ANDROID_JAR:-$ROOT/toolchain/android-34.jar}
R8_JAR=${R8_JAR:-$ROOT/toolchain/r8.jar}
KEYS=${ORIGINLABS_KEYS:-$ROOT/keys}
STORE=${ORIGINLABS_KEYSTORE:-$KEYS/originlabs.p12}
PROPS="$KEYS/keystore.properties"
WORK="$ROOT/build/apk"
OUT="$ROOT/build/OriginLabs-$VERSION_NAME.apk"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing $1. Install the Android build tools and a JDK." >&2
    exit 1
  }
}

need javac
need keytool
need aapt2
need zipalign
need apksigner
need zip

[ -f "$ANDROID_JAR" ] || {
  echo "Missing $ANDROID_JAR (platform android-34)." >&2
  exit 1
}
[ -f "$R8_JAR" ] || {
  echo "Missing $R8_JAR (D8/R8)." >&2
  exit 1
}
if [ "${ORIGINLABS_UNSIGNED:-0}" != "1" ] && [ ! -f "$STORE" ]; then
  echo "Missing keystore $STORE. Run scripts/gen-keys.sh first," >&2
  echo "or set ORIGINLABS_UNSIGNED=1 to produce an unsigned APK." >&2
  exit 1
fi

if [ "${ORIGINLABS_UNSIGNED:-0}" != "1" ] && [ -f "$PROPS" ]; then
  # shellcheck disable=SC1090
  . "$PROPS"
fi
ALIAS=${ORIGINLABS_KEY_ALIAS:-originlabs}
STORE_PASS=${ORIGINLABS_STORE_PASSWORD:-}
KEY_PASS=${ORIGINLABS_KEY_PASSWORD:-$STORE_PASS}
if [ "${ORIGINLABS_UNSIGNED:-0}" != "1" ] && [ -z "$STORE_PASS" ]; then
  echo "No ORIGINLABS_STORE_PASSWORD. Set it or keep keys/keystore.properties." >&2
  exit 1
fi

echo "==> web surface"
node scripts/build-web.mjs

echo "==> resources"
rm -rf "$WORK"
mkdir -p "$WORK/res" "$WORK/gen" "$WORK/classes" "$WORK/dex"
aapt2 compile \
  --dir app/src/main/res \
  -o "$WORK/res.zip"

aapt2 link \
  -o "$WORK/app-unsigned.apk" \
  -I "$ANDROID_JAR" \
  --manifest app/src/main/AndroidManifest.xml \
  --java "$WORK/gen" \
  -A app/src/main/assets \
  --auto-add-overlay \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  "$WORK/res.zip"

echo "==> java"
find app/src/main/java -name '*.java' > "$WORK/sources.txt"
find "$WORK/gen" -name '*.java' >> "$WORK/sources.txt"
javac \
  -source 8 \
  -target 8 \
  -Xlint:-options \
  -classpath "$ANDROID_JAR" \
  -d "$WORK/classes" \
  @"$WORK/sources.txt"

echo "==> dex"
find "$WORK/classes" -name '*.class' > "$WORK/classes.txt"
java -cp "$R8_JAR" com.android.tools.r8.D8 \
  --release \
  --min-api 29 \
  --lib "$ANDROID_JAR" \
  --output "$WORK/dex" \
  @"$WORK/classes.txt"

echo "==> package"
( cd "$WORK/dex" && zip -q -X "$WORK/app-unsigned.apk" classes.dex )
zipalign -f -p 4 "$WORK/app-unsigned.apk" "$WORK/app-aligned.apk"

if [ "${ORIGINLABS_UNSIGNED:-0}" = "1" ]; then
  echo "==> unsigned (caller signs)"
  cp "$WORK/app-aligned.apk" "$OUT"
else
  echo "==> sign"
  apksigner sign \
    --ks "$STORE" \
    --ks-type PKCS12 \
    --ks-key-alias "$ALIAS" \
    --ks-pass "pass:$STORE_PASS" \
    --key-pass "pass:$KEY_PASS" \
    --min-sdk-version 29 \
    --v1-signing-enabled true \
    --v2-signing-enabled true \
    --v3-signing-enabled true \
    --out "$OUT" \
    "$WORK/app-aligned.apk"

  apksigner verify --verbose --print-certs "$OUT" > "$WORK/verify.txt"
  grep -E 'Verified using|Number of signers|Signer #1 certificate SHA-256' "$WORK/verify.txt" | sed 's/^ */  /'
fi

echo "==> inspect"
BADGING=$(aapt2 dump badging "$OUT")
printf '%s\n' "$BADGING" | grep -E 'package:|application-label|sdkVersion|targetSdkVersion|uses-permission' || true
if printf '%s\n' "$BADGING" | grep -q 'uses-permission'; then
  echo "Refusing to ship: the APK declares a permission." >&2
  exit 1
fi

SIZE=$(wc -c < "$OUT")
if [ "${ORIGINLABS_UNSIGNED:-0}" = "1" ]; then
  STATE="unsigned"
else
  STATE="signed"
fi
echo
echo "APK: $OUT (${SIZE} bytes)"
echo "    version $VERSION_NAME ($VERSION_CODE), no permissions, $STATE."
