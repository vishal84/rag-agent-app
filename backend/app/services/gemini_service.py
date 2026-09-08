from google import genai
from google.genai import errors
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

EMBEDDING_MODEL = "gemini-embedding-001"
EMBED_BATCH_SIZE = 100  # Gemini's batchEmbedContents caps at 100 requests per call


def _is_rate_limited(exc: BaseException) -> bool:
    return isinstance(exc, errors.APIError) and exc.code == 429


_retry_on_rate_limit = retry(
    retry=retry_if_exception(_is_rate_limited),
    wait=wait_exponential(multiplier=2, min=2, max=60),
    stop=stop_after_attempt(6),
    reraise=True,
)


class GeminiService:
    """Wraps the google-genai SDK for embeddings.

    Answer generation lives in ClaudeService; this class is the embedding half
    of the pipeline only. The two are deliberately separate because the vector
    store is pinned to this model's dimensionality, while the generation model
    can be swapped freely.
    """

    def __init__(self, api_key: str):
        self._client = genai.Client(api_key=api_key)

    @_retry_on_rate_limit
    def _embed_batch(self, batch: list[str]):
        return self._client.models.embed_content(model=EMBEDDING_MODEL, contents=batch)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        embeddings: list[list[float]] = []
        for i in range(0, len(texts), EMBED_BATCH_SIZE):
            batch = texts[i : i + EMBED_BATCH_SIZE]
            response = self._embed_batch(batch)
            embeddings.extend(embedding.values for embedding in response.embeddings)
        return embeddings

    def embed_query(self, text: str) -> list[float]:
        return self.embed_texts([text])[0]
