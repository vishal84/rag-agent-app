import anthropic

GENERATION_MODEL = "claude-sonnet-5"
MAX_TOKENS = 16000

SYSTEM_PROMPT = (
    "You are a helpful assistant answering questions using only the document excerpts "
    "provided in the user's message.\n"
    "Cite every factual claim inline in the exact format [DocName, p. X], using the document "
    "name and page number given with each excerpt. If the excerpts don't contain the answer, "
    "say so instead of guessing."
)


class ClaudeService:
    """Wraps the Anthropic SDK for grounded answer generation.

    Retrieved excerpts stay in the user turn while the citation contract lives in
    the system prompt: excerpt text originates from ingested PDFs, so keeping it
    out of the instruction channel means a document cannot restate the rules.
    """

    def __init__(self, api_key: str):
        # The SDK retries 429s and 5xx itself with exponential backoff, so unlike
        # the Gemini client this one needs no tenacity wrapper on top.
        self._client = anthropic.Anthropic(api_key=api_key)

    def generate_answer(self, query: str, chunks: list[dict]) -> str:
        context = "\n\n".join(
            f"[{chunk['doc_name']}, p. {chunk['page_number']}]\n{chunk['text']}" for chunk in chunks
        )
        response = self._client.messages.create(
            model=GENERATION_MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Document excerpts:\n{context}\n\n"
                        f"Question: {query}\n"
                        "Answer with inline citations:"
                    ),
                }
            ],
        )
        # Adaptive thinking is on by default for this model, so the response may
        # lead with thinking blocks; only text blocks carry the answer.
        return "".join(block.text for block in response.content if block.type == "text")
