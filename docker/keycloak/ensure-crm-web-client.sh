#!/bin/sh
set -eu

KCADM=/opt/keycloak/bin/kcadm.sh
KCADM_CONFIG=/tmp/kcadm.config
CLIENT_FILE=/opt/keycloak/data/import/crm-web-client.json
KEYCLOAK_REALM=${KEYCLOAK_REALM:-crm}

for attempt in 1 2 3 4 5; do
  if "$KCADM" config credentials \
    --config "$KCADM_CONFIG" \
    --server http://keycloak:8080 \
    --realm master \
    --user "$KEYCLOAK_ADMIN" \
    --password "$KEYCLOAK_ADMIN_PASSWORD"; then
    break
  fi
  if [ "$attempt" = 5 ]; then
    echo "Could not authenticate to local Keycloak" >&2
    exit 1
  fi
  sleep 2
done

client_id="$("$KCADM" get clients --config "$KCADM_CONFIG" -r "$KEYCLOAK_REALM" -q clientId=crm-web --fields id --format csv --noquotes | tr -d '\r\n')"
if [ -n "$client_id" ]; then
  "$KCADM" update "clients/$client_id" --config "$KCADM_CONFIG" -r "$KEYCLOAK_REALM" -f "$CLIENT_FILE"
else
  "$KCADM" create clients --config "$KCADM_CONFIG" -r "$KEYCLOAK_REALM" -f "$CLIENT_FILE"
  client_id="$("$KCADM" get clients --config "$KCADM_CONFIG" -r "$KEYCLOAK_REALM" -q clientId=crm-web --fields id --format csv --noquotes | tr -d '\r\n')"
fi

if [ -n "\${CRM_WEB_ORIGIN:-}" ]; then
  "$KCADM" update "clients/$client_id" --config "$KCADM_CONFIG" -r "$KEYCLOAK_REALM" \
    -s "redirectUris=[\"$CRM_WEB_ORIGIN/auth/callback\"]" \
    -s "webOrigins=[\"$CRM_WEB_ORIGIN\"]"
fi
