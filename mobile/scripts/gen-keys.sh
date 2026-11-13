#!/bin/sh
# Generate the OriginLabs release signing key (PKCS#12).
#
# The key stays on this machine under mobile/keys/, which is gitignored. Back it
# up somewhere safe: Android will refuse to update the app with a different key.
# For CI, export the keystore as base64 and set:
#   ORIGINLABS_KEYSTORE_BASE64, ORIGINLABS_STORE_PASSWORD, ORIGINLABS_KEY_PASSWORD
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
KEYS="$ROOT/keys"
STORE="$KEYS/originlabs.p12"
PROPS="$KEYS/keystore.properties"
ALIAS=${ORIGINLABS_KEY_ALIAS:-originlabs}

mkdir -p "$KEYS"
chmod 700 "$KEYS"

if [ -f "$STORE" ]; then
  echo "Keystore already exists: $STORE"
  echo "Keep it backed up. Re-run with a new directory if you really want a new key."
  exit 0
fi

PASS=${ORIGINLABS_STORE_PASSWORD:-}
if [ -z "$PASS" ]; then
  PASS=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
fi

keytool -genkeypair \
  -keystore "$STORE" \
  -storetype PKCS12 \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -dname "CN=OriginLabs, O=OriginLabs, OU=Mobile, C=US" \
  -storepass "$PASS" \
  -keypass "$PASS" \
  1>/dev/null

umask 077
{
  printf 'ORIGINLABS_KEY_ALIAS=%s\n' "$ALIAS"
  printf 'ORIGINLABS_STORE_PASSWORD=%s\n' "$PASS"
  printf 'ORIGINLABS_KEY_PASSWORD=%s\n' "$PASS"
} > "$PROPS"

keytool -list -v \
  -keystore "$STORE" \
  -storepass "$PASS" \
  -alias "$ALIAS" 2>/dev/null > "$KEYS/signing-certificate.txt"

echo "Generated $STORE"
echo "Fingerprint:"
keytool -list -v -keystore "$STORE" -storepass "$PASS" -alias "$ALIAS" 2>/dev/null |
  grep -E 'SHA1:|SHA256:|Valid from' | sed 's/^ *//'
echo
echo "Back up keys/ offline. It is gitignored on purpose."
