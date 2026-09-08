from fastapi.testclient import TestClient

from app.dependencies import get_gemini_service, get_qdrant_service
from app.main import app


def make_client(gemini_mock, qdrant_mock):
    app.dependency_overrides[get_gemini_service] = lambda: gemini_mock
    app.dependency_overrides[get_qdrant_service] = lambda: qdrant_mock
    client = TestClient(app)
    return client


def teardown_function():
    app.dependency_overrides.clear()


def test_chat_returns_answer_and_citations(mocker):
    gemini_mock = mocker.Mock()
    gemini_mock.embed_query.return_value = [0.1, 0.2, 0.3]
    gemini_mock.generate_answer.return_value = "The sky is blue [Doc.pdf, p. 2]."

    qdrant_mock = mocker.Mock()
    qdrant_mock.search.return_value = [
        {
            "score": 0.9,
            "doc_name": "Doc.pdf",
            "file_id": "file123",
            "drive_url": "https://drive.google.com/file/d/file123/preview#page=2",
            "page_number": 2,
            "text": "The sky is blue because of Rayleigh scattering." * 20,
        }
    ]

    client = make_client(gemini_mock, qdrant_mock)
    response = client.post("/api/chat", json={"message": "why is the sky blue?", "session_id": None})

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "The sky is blue [Doc.pdf, p. 2]."
    assert len(body["citations"]) == 1

    citation = body["citations"][0]
    assert citation["doc_name"] == "Doc.pdf"
    assert citation["file_id"] == "file123"
    assert citation["page_number"] == 2
    assert citation["drive_url"] == "https://drive.google.com/file/d/file123/preview#page=2"
    assert len(citation["snippet"]) <= 300

    gemini_mock.embed_query.assert_called_once_with("why is the sky blue?")
    qdrant_mock.search.assert_called_once()
    gemini_mock.generate_answer.assert_called_once()


def test_chat_returns_empty_citations_when_no_matches(mocker):
    gemini_mock = mocker.Mock()
    gemini_mock.embed_query.return_value = [0.1, 0.2, 0.3]
    gemini_mock.generate_answer.return_value = "I don't have information on that."

    qdrant_mock = mocker.Mock()
    qdrant_mock.search.return_value = []

    client = make_client(gemini_mock, qdrant_mock)
    response = client.post("/api/chat", json={"message": "unrelated question"})

    assert response.status_code == 200
    assert response.json()["citations"] == []
