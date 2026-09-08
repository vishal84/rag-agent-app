from app.services.chunking import (
    CHUNK_OVERLAP_CHARS,
    CHUNK_SIZE_CHARS,
    Chunk,
    chunk_page_text,
    chunk_pdf,
)


def test_chunk_page_text_returns_single_chunk_for_short_text():
    text = "short page content"
    assert chunk_page_text(text) == [text]


def test_chunk_page_text_returns_empty_for_blank_text():
    assert chunk_page_text("   ") == []


def test_chunk_page_text_splits_long_text_with_overlap():
    text = "a" * (CHUNK_SIZE_CHARS * 2)
    chunks = chunk_page_text(text)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= CHUNK_SIZE_CHARS
    step = CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS
    assert chunks[0][step:] == chunks[1][: CHUNK_SIZE_CHARS - step]


def test_chunk_pdf_tags_every_chunk_with_its_own_page_number(mocker):
    pages = ["page one text " * 10, "page two text " * 300, ""]
    mocker.patch("app.services.chunking.extract_pages", return_value=pages)

    chunks = chunk_pdf(b"fake-pdf-bytes", doc_name="Doc.pdf", file_id="file123")

    assert all(isinstance(chunk, Chunk) for chunk in chunks)
    page_numbers = {chunk.page_number for chunk in chunks}
    assert page_numbers == {1, 2}  # blank page 3 produces no chunks

    for chunk in chunks:
        assert chunk.file_id == "file123"
        assert chunk.doc_name == "Doc.pdf"
        assert chunk.drive_url == f"https://drive.google.com/file/d/file123/preview#page={chunk.page_number}"

    page_two_chunks = [c for c in chunks if c.page_number == 2]
    assert len(page_two_chunks) > 1  # long page split into multiple chunks, all page 2
