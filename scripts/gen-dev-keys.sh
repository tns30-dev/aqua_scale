#!/usr/bin/env bash
# Generate the local RSA dev keypair (gitignored). Identity signs JWTs with the private
# key; every other service verifies with the public key. Cloud uses Secret Manager.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/local/dev-keys"
mkdir -p "$DIR"
if [[ -f "$DIR/jwt-private.pem" ]]; then
  echo "dev keys already exist: $DIR"
  exit 0
fi
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$DIR/jwt-private.pem" 2>/dev/null
openssl rsa -in "$DIR/jwt-private.pem" -pubout -out "$DIR/jwt-public.pem" 2>/dev/null
echo "generated: $DIR/jwt-private.pem + jwt-public.pem"
