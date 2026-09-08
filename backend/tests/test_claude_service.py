from unittest.mock import MagicMock

import anthropic
import pytest

from app.services.claude_service import GENERATION_MODEL, ClaudeService

CHUNKS = [
    {"doc_name": "Doc.pdf", "page_number": 2, "text": "The sky is blue."},
    {"doc_name": "Other.pdf", "page_number": 7, "text": "Rayleigh scattering explains it."},
]


def _block(block_type: str, text: str = ""):
    block = MagicMock()
    block.type = block_type
    block.text = text
    return block


def _response(*blocks):
    response = MagicMock()
    response.content = list(blocks)
    return response


@pytest.fixture
def service(monkeypatch):
    monkeypatch.setattr("app.services.claude_service.anthropic.Anthropic", lambda api_key: MagicMock())
    return ClaudeService(api_key="test-key")


def test_generate_answer_returns_text_and_uses_expected_model(service):
    service._client.messages.create.return_value = _response(_block("text", "Blue [Doc.pdf, p. 2]."))

    answer = service.generate_answer("why is the sky blue?", CHUNKS)

    assert answer == "Blue [Doc.pdf, p. 2]."
    kwargs = service._client.messages.create.call_args.kwargs
    assert kwargs["model"] == GENERATION_MODEL


def test_citation_contract_lives_in_system_prompt_not_the_user_turn(service):
    service._client.messages.create.return_value = _response(_block("text", "ok"))

    service.generate_answer("why is the sky blue?", CHUNKS)

    kwargs = service._client.messages.create.call_args.kwargs
    assert "[DocName, p. X]" in kwargs["system"]
    assert "[DocName, p. X]" not in kwargs["messages"][0]["content"]


def test_excerpts_and_question_are_sent_in_the_user_turn(service):
    service._client.messages.create.return_value = _response(_block("text", "ok"))

    service.generate_answer("why is the sky blue?", CHUNKS)

    content = service._client.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "[Doc.pdf, p. 2]" in content
    assert "The sky is blue." in content
    assert "[Other.pdf, p. 7]" in content
    assert "why is the sky blue?" in content


def test_thinking_blocks_are_excluded_from_the_answer(service):
    service._client.messages.create.return_value = _response(
        _block("thinking"), _block("text", "Blue "), _block("text", "[Doc.pdf, p. 2].")
    )

    assert service.generate_answer("why?", CHUNKS) == "Blue [Doc.pdf, p. 2]."


def test_api_errors_propagate(service):
    service._client.messages.create.side_effect = anthropic.APIConnectionError(request=MagicMock())

    with pytest.raises(anthropic.APIConnectionError):
        service.generate_answer("why?", CHUNKS)
