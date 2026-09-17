#!/bin/sh
# Substitutes the back-end origins into the nginx config at container start.
set -e

: "${API_ORIGIN:=http://api:8000}"
: "${KEYCLOAK_ORIGIN:=http://keycloak:8080}"

envsubst '${API_ORIGIN} ${KEYCLOAK_ORIGIN}' \
  < /etc/nginx/conf.d/default.conf \
  > /etc/nginx/conf.d/default.conf.tmp
mv /etc/nginx/conf.d/default.conf.tmp /etc/nginx/conf.d/default.conf
