import uuid

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

EMBEDDING_DIM = 3072  # gemini-embedding-001 output size


class QdrantService:
    """Thin wrapper around the Qdrant SDK; the only code allowed to talk to Qdrant."""

    def __init__(self, url: str, collection_name: str):
        self._collection_name = collection_name
        self._client = QdrantClient(url=url)

    def ensure_collection(self, vector_size: int = EMBEDDING_DIM) -> None:
        existing = [c.name for c in self._client.get_collections().collections]
        if self._collection_name not in existing:
            self._client.create_collection(
                collection_name=self._collection_name,
                vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
            )

    def upsert_chunks(self, chunks: list[dict]) -> int:
        """Upserts embedded chunks. Each dict needs `vector` plus the payload fields:
        page_number, file_id, drive_url, doc_name, text.
        """
        points = [
            qmodels.PointStruct(
                id=chunk.get("id") or str(uuid.uuid4()),
                vector=chunk["vector"],
                payload={
                    "page_number": chunk["page_number"],
                    "file_id": chunk["file_id"],
                    "drive_url": chunk["drive_url"],
                    "doc_name": chunk["doc_name"],
                    "text": chunk["text"],
                },
            )
            for chunk in chunks
        ]
        if points:
            self._client.upsert(collection_name=self._collection_name, points=points)
        return len(points)

    def search(self, query_vector: list[float], top_k: int = 6) -> list[dict]:
        results = self._client.search(
            collection_name=self._collection_name,
            query_vector=query_vector,
            limit=top_k,
        )
        return [{"score": r.score, **r.payload} for r in results]

    def list_all_payloads(self) -> list[dict]:
        payloads: list[dict] = []
        offset = None
        while True:
            points, offset = self._client.scroll(
                collection_name=self._collection_name,
                limit=256,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            payloads.extend(point.payload for point in points)
            if offset is None:
                break
        return payloads
