"""Small Keycloak Admin REST client used by user imports."""

from __future__ import annotations

import uuid
from urllib.parse import quote

import httpx

from app.core.config import settings


class KeycloakAdminClient:
    """Provision imported users and return the Keycloak subject id."""

    def __init__(self) -> None:
        self._token: str | None = None

    @property
    def configured(self) -> bool:
        return bool(settings.keycloak_admin_username and settings.keycloak_admin_password)

    async def ensure_user(
        self,
        *,
        username: str,
        email: str | None,
        first_name: str,
        last_name: str,
    ) -> str:
        """Create or find a Keycloak user and return its stable ``sub`` id."""
        if not self.configured:
            if settings.env == "production":
                raise RuntimeError(
                    "Keycloak admin credentials are required to import users in production"
                )
            # Tests and local imports do not run Keycloak. Production supplies
            # admin credentials to the API container and uses the REST path.
            return str(uuid.uuid4())

        async with httpx.AsyncClient(timeout=settings.integrations_timeout) as client:
            token = await self._admin_token(client)
            headers = {"Authorization": f"Bearer {token}"}
            realm = quote(settings.keycloak_realm, safe="")
            users_url = f"{settings.keycloak_admin_url.rstrip('/')}/admin/realms/{realm}/users"
            lookup = {"email" if email else "username": email or username, "exact": "true"}
            response = await client.get(users_url, headers=headers, params=lookup)
            response.raise_for_status()
            matches = response.json()
            if matches:
                return str(matches[0]["id"])

            payload: dict[str, object] = {
                "username": username,
                "firstName": first_name,
                "lastName": last_name,
                "enabled": True,
                "emailVerified": False,
                "requiredActions": ["UPDATE_PASSWORD"],
            }
            if email:
                payload["email"] = email
            created = await client.post(users_url, headers=headers, json=payload)
            if created.status_code == httpx.codes.CONFLICT:
                response = await client.get(users_url, headers=headers, params=lookup)
                response.raise_for_status()
                matches = response.json()
                if matches:
                    return str(matches[0]["id"])
            created.raise_for_status()
            location = created.headers.get("location", "").rstrip("/")
            if location:
                return location.rsplit("/", 1)[-1]

            response = await client.get(users_url, headers=headers, params=lookup)
            response.raise_for_status()
            matches = response.json()
            if not matches:
                raise RuntimeError("Keycloak created a user but returned no user id")
            return str(matches[0]["id"])

    async def _admin_token(self, client: httpx.AsyncClient) -> str:
        if self._token:
            return self._token
        base = settings.keycloak_admin_url.rstrip("/")
        token_url = (
            f"{base}/realms/{quote(settings.keycloak_admin_realm, safe='')}"
            "/protocol/openid-connect/token"
        )
        response = await client.post(
            token_url,
            data={
                "grant_type": "password",
                "client_id": "admin-cli",
                "username": settings.keycloak_admin_username,
                "password": settings.keycloak_admin_password,
            },
        )
        response.raise_for_status()
        self._token = str(response.json()["access_token"])
        return self._token
