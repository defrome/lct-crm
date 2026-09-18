"""S3-compatible storage for user-uploaded files."""

from __future__ import annotations

import asyncio
import io
from typing import Protocol

from minio import Minio
from minio.error import S3Error

from app.core.config import settings


class ObjectStorage(Protocol):
    async def put(self, key: str, data: bytes, content_type: str) -> None: ...

    async def get(self, key: str) -> bytes | None: ...

    async def delete(self, key: str) -> None: ...


class MinioObjectStorage:
    def __init__(self) -> None:
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self.bucket = settings.minio_bucket
        self._bucket_ready = False
        self._bucket_lock = asyncio.Lock()

    async def _ensure_bucket(self) -> None:
        if self._bucket_ready:
            return
        async with self._bucket_lock:
            if self._bucket_ready:
                return
            exists = await asyncio.to_thread(self.client.bucket_exists, self.bucket)
            if not exists:
                try:
                    await asyncio.to_thread(self.client.make_bucket, self.bucket)
                except S3Error as exc:
                    if exc.code not in {"BucketAlreadyExists", "BucketAlreadyOwnedByYou"}:
                        raise
            self._bucket_ready = True

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        await self._ensure_bucket()
        await asyncio.to_thread(
            self.client.put_object,
            self.bucket,
            key,
            io.BytesIO(data),
            len(data),
            content_type=content_type,
        )

    async def get(self, key: str) -> bytes | None:
        await self._ensure_bucket()

        def read() -> bytes | None:
            try:
                response = self.client.get_object(self.bucket, key)
            except S3Error as exc:
                if exc.code == "NoSuchKey":
                    return None
                raise
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()

        return await asyncio.to_thread(read)

    async def delete(self, key: str) -> None:
        await self._ensure_bucket()
        try:
            await asyncio.to_thread(self.client.remove_object, self.bucket, key)
        except S3Error as exc:
            if exc.code != "NoSuchKey":
                raise


class MemoryObjectStorage:
    """Process-local implementation for tests; production uses MinIO."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data

    async def get(self, key: str) -> bytes | None:
        return self.objects.get(key)

    async def delete(self, key: str) -> None:
        self.objects.pop(key, None)


_storage: ObjectStorage | None = None


def get_object_storage() -> ObjectStorage:
    global _storage
    if _storage is None:
        _storage = (
            MemoryObjectStorage()
            if settings.object_storage_backend == "memory"
            else MinioObjectStorage()
        )
    return _storage
