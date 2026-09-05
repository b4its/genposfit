#!/bin/sh
# =========================================================
#  GenPosFit — Self-signed cert utk Vite HTTPS (dev server)
# =========================================================
# Masalah: browser hanya mengizinkan getUserMedia (kamera) pada SECURE
# CONTEXT — http://localhost/127.0.0.1 atau https://… Apa pun. Kalau
# frontend diakses lewat IP host dengan http:// (mis. http://10.0.0.5:3042)
# browser memblokir kamera tanpa dialog; kadang juga ERR_EMPTY_RESPONSE
# karena user mencoba http:// ke server yang sudah jadi https://.
#
# Solusi: jalankan Vite dengan self-signed HTTPS saat VITE_HTTPS=1.
# Container start otomatis memanggil script ini (lihat docker-compose.yml),
# atau manual: make certs / npm run certs / sh scripts/gen-certs.sh <host...>
#
# POSIX sh — jalan di busybox alpine maupun bash/dash.
# Output: frontend/certs/dev-key.pem + dev-cert.pem
# =========================================================
set -u

CERT_DIR="${CERT_DIR:-certs}"
CRT="$CERT_DIR/dev-cert.pem"
KEY="$CERT_DIR/dev-key.pem"
DAYS="${DAYS:-825}"
CN="${CN:-GenPosFit Dev}"

# ---- 1. Kumpulkan target SAN (localhost + IP/HOST yang diberikan) --------
# Host list: argumen CLI + env CERT_HOSTS.
HOSTS=""
for h in ${CERT_HOSTS:-} "$@"; do
  [ -n "$h" ] || continue
  case " $HOSTS " in *" $h "*) ;; *) HOSTS="$HOSTS $h" ;; esac
done

SAN="DNS:localhost,IP:127.0.0.1,IP:::1"
for h in $HOSTS; do
  case "$h" in
    localhost|127.0.0.1) ;;
    *[!0-9.]*) case "$h" in *:*) SAN="$SAN,IP:$h" ;; *) SAN="$SAN,DNS:$h" ;; esac ;;
    *) SAN="$SAN,IP:$h" ;;
  esac
done

# ---- 2. Skip kalau cert lama masih valid & sudah mencakup semua SAN -----
if [ "${FORCE:-0}" != "1" ] && [ -f "$CRT" ] && [ -f "$KEY" ]; then
  OK=1
  for h in $HOSTS; do
    case "$h" in
      *[!0-9.]*)
        case "$h" in
          *:*) openssl x509 -noout -text -in "$CRT" 2>/dev/null | grep -q "IP Address: *$h" || OK=0 ;;
          *)   openssl x509 -noout -text -in "$CRT" 2>/dev/null | grep -q "DNS:$h" || OK=0 ;;
        esac ;;
      *) openssl x509 -noout -text -in "$CRT" 2>/dev/null | grep -q "IP Address: *$h" || OK=0 ;;
    esac
  done
  if [ "$OK" = 1 ] && openssl x509 -checkend 86400 -noout -in "$CRT" >/dev/null 2>&1; then
    echo "[gen-certs] cert valid & SAN lengkap — reuse $CRT"
    exit 0
  fi
fi

# ---- 3. openssl harus ada (container: apk add openssl di Dockerfile) ----
if ! command -v openssl >/dev/null 2>&1; then
  echo "[gen-certs] ERROR: openssl tidak ditemukan — HTTPS tidak bisa diaktifkan." >&2
  exit 1
fi

# ---- 4. Generate sertifikat ---------------------------------------------
mkdir -p "$CERT_DIR"
openssl req -x509 -newkey rsa:2048 -sha256 -days "$DAYS" -nodes \
  -keyout "$KEY" -out "$CRT" \
  -subj "/CN=$CN" \
  -addext "subjectAltName=$SAN" >/dev/null 2>&1 || {
  echo "[gen-certs] ERROR: openssl gagal membuat cert." >&2
  exit 1
}
chmod 644 "$CRT"
chmod 600 "$KEY"

echo "[gen-certs] ✔ $CRT (SAN: $SAN)"
echo "[gen-certs]   akses https://<ip-host>:3042 — accept warning self-signed sekali."
