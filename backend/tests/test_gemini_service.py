from unittest.mock import MagicMock

import pytest
from google.genai import errors

from app.services.gemini_service import GeminiService


def _rate_limit_error() -> errors.APIError:
    return errors.APIError(429, {"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}})


def _make_embed_response(vector: list[float]):
    embedding = MagicMock()
    embedding.values = vector
    response = MagicMock()
    response.embeddings = [embedding]
    return response


@pytest.fixture(autouse=True)
def no_real_sleep(monkeypatch):
    monkeypatch.setattr("time.sleep", lambda _seconds: None)


@pytest.fixture
def service(monkeypatch):
    monkeypatch.setattr("app.services.gemini_service.genai.Client", lambda api_key: MagicMock())
    return GeminiService(api_key="test-key")


def test_embed_texts_retries_on_rate_limit_then_succeeds(service):
    calls = {"count": 0}

    def flaky_embed_content(model, contents):
        calls["count"] += 1
        if calls["count"] < 3:
            raise _rate_limit_error()
        return _make_embed_response([0.1, 0.2])

    service._client.models.embed_content.side_effect = flaky_embed_content

    result = service.embed_texts(["hello"])

    assert result == [[0.1, 0.2]]
    assert calls["count"] == 3


def test_embed_texts_does_not_retry_non_rate_limit_errors(service):
    service._client.models.embed_content.side_effect = errors.APIError(
        400, {"error": {"code": 400, "message": "bad request", "status": "INVALID_ARGUMENT"}}
    )

    with pytest.raises(errors.APIError):
        service.embed_texts(["hello"])

    assert service._client.models.embed_content.call_count == 1
