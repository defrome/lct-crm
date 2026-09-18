#!/bin/sh
# Realm imports only apply to a new database. Keep the local web OIDC client
# current when the Keycloak data volume already exists.
set -eu

KCADM=/opt/keycloak/bin/kcadm.sh
CLIENT_FILE=/opt/keycloak/data/import/crm-web-client.json

for attempt in 1 2 3 4 5; do
  if "$KCADM" config credentials \
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

client_id="$("$KCADM" get clients -r crm -q clientId=crm-web --fields id --format csv --noquotes | tr -d '\r\n')"
if [ -n "$client_id" ]; then
  "$KCADM" update "clients/$client_id" -r crm -f "$CLIENT_FILE"
  echo "Updated Keycloak client crm-web"
else
  "$KCADM" create clients -r crm -f "$CLIENT_FILE"
  echo "Created Keycloak client crm-web"
fi
