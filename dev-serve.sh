#!/usr/bin/env sh
set -e
CERT_DIR="/app/certs"
CERT_FILE="$CERT_DIR/newsapp.crt"
KEY_FILE="$CERT_DIR/newsapp.key"
OPENSSL_CNF="$CERT_DIR/openssl.cnf"
DEV_PORT=${DEV_PORT:-5174}

mkdir -p "$CERT_DIR"
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
  cat > "$OPENSSL_CNF" <<EOF
[req]
default_bits = 2048
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = newsapp.rousehouse.net

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = newsapp.rousehouse.net
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF

  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_FILE" -out "$CERT_FILE" -config "$OPENSSL_CNF" -extensions v3_req
fi

export DEV_PORT
export SSL_CERTFILE="$CERT_FILE"
export SSL_KEYFILE="$KEY_FILE"

npm run dev
