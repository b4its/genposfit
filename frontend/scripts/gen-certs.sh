#!/bin/sh
# ============================================
# GenPosFit — Self-signed HTTPS certificate
# ============================================
# Mengapa: getUserMedia (kamera) HANYA aktif pada "secure context" —
# https:// atau http://localhost. Saat frontend diakses lewat IP host
# (mis. 192.168.1.50) via http://, browser memblokir kamera dengan pesan:
#   "Kamera tidak dapat diakses / getUserMedia undefined".
# Ini BUKAN masalah CORS atau server — bukan izin host, tapi kebijakan
# keamanan browser terhadap halaman non-HTTPS di IP publik.
#
# Skrip ini membuat sertifikat self-signed agar Vite dev server serve HTTPS.
# Browser akan menampilkan peringatan "Not Private" → klik Advanced → Continue
# (sekali saja). Setelah itu secure context = true dan kamera bekerja,
# termasuk saat diakses dari perangkat lain di jaringan via IP host.
#
# Usage:
#   sh scripts/gen-certs.sh [HOST_IP ...]     # manual
#   CERT_HOSTS="192.168.1.50 app.local" sh scripts/gen-certs.sh
#
# Output: frontend/certs/dev-key.pem + dev-cert.pem (dibaca vite.config.ts)
set -e

CERT_DIR="${CERT_DIR:-certs}"
DAYS="${DAYS:-825}"
CN="${CN:-GenPosFit Dev}"

if ! command -v openssl >/dev/null 2>&1; then
  echo "✗ openssl tidak tersedia — HTTPS tidak dapat diaktifkan." >&2
  echo "  (kamera tetap butuh https:// atau akses via http://localhost)" >&2
  exit 1
fi

# Kumpulkan SAN: selalu + localhost + IP host terdeteksi + input.
SAN="DNS:localhost,IP:127.0.0.1,IP:::1"
HN=$(hostname 2>/dev/null || true)
[ -n "$HN" ] && SAN="$SAN,DNS:$HN"

for h in $CERT_HOSTS $@; do
  echo "$SAN" | grep -qF "$h" && continue
  case "$h" in
    *:*) SAN="$SAN,IP:$h" ;;
    *[!0-9.]*) SAN="$SAN,DNS:$h" ;;
    *) SAN="$SAN,IP:$h" ;;
  esac
done

mkdir -p "$CERT_DIR"
openssl req -x509 -newkey rsa:2048 -sha256 -days "$DAYS" -nodes \
  -keyout "$CERT_DIR/dev-key.pem" \
  -out "$CERT_DIR/dev-cert.pem" \
  -subj "/CN=$CN" \
  -addext "subjectAltName=$SAN" >/dev/null 2>&1

chmod 644 "$CERT_DIR/dev-cert.pem"
chmod 600 "$CERT_DIR/dev-key.pem"

echo "✔ Cert dibuat di $CERT_DIR/ (SAN: $SAN)"
echo "  Restart dev server → akses https://<ip-host>:3042 → izinkan warning"
echo "  → kamera (getUserMedia) aktif di semua perangkat."
