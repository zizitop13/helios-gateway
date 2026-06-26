#!/bin/sh
set -eu

json_string() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_entry() {
  name="$1"
  value="$(printenv "$name" 2>/dev/null || true)"
  printf '  "%s": "%s",\n' "$name" "$(json_string "$value")"
}

{
  printf 'window.__PETS_SHOP_CONFIG__ = {\n'
  write_entry VITE_GATEWAY_URL
  write_entry VITE_FIREBASE_API_KEY
  write_entry VITE_FIREBASE_AUTH_DOMAIN
  write_entry VITE_FIREBASE_PROJECT_ID
  write_entry VITE_FIREBASE_STORAGE_BUCKET
  write_entry VITE_FIREBASE_MESSAGING_SENDER_ID
  write_entry VITE_FIREBASE_APP_ID
  write_entry VITE_FIREBASE_MEASUREMENT_ID
  printf '};\n'
} > /usr/share/nginx/html/runtime-config.js
