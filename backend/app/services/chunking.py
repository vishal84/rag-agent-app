from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader

# ~4 chars/token heuristic -> targets ~500-800 token chunks with ~15% overlap.
CHUNK_SIZE_CHARS = 3000
CHUNK_OVERLAP_CHARS = 400

DRIVE_URL_TEMPLATE = "https://drive.google.com/file/d/{file_id}/preview#page={page_number}"


@dataclass
class Chunk:
    text: str
    page_number: int
    file_id: str
    doc_name: str
    drive_url: str


def extract_pages(pdf_bytes: bytes) -> list[str]:
    reader = PdfReader(BytesIO(pdf_bytes))
    return [page.extract_text() or "" for page in reader.pages]


def chunk_page_text(
    text: str,
    chunk_size: int = CHUNK_SIZE_CHARS,
    overlap: int = CHUNK_OVERLAP_CHARS,
) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    step = chunk_size - overlap
    while start < len(text):
        chunk = text[start : start + chunk_size].strip()
        if chunk:
            chunks.append(chunk)
        start += step
    return chunks


def chunk_pdf(
    pdf_bytes: bytes,
    doc_name: str,
    file_id: str,
    drive_url_template: str = DRIVE_URL_TEMPLATE,
) -> list[Chunk]:
    """Splits a PDF into page-scoped, overlapping text chunks.

    Every chunk stays within one page's text so it remains attributable to a
    single page_number for citations.
    """
    chunks: list[Chunk] = []
    for page_index, page_text in enumerate(extract_pages(pdf_bytes)):
        page_number = page_index + 1
        for piece in chunk_page_text(page_text):
            chunks.append(
                Chunk(
                    text=piece,
                    page_number=page_number,
                    file_id=file_id,
                    doc_name=doc_name,
                    drive_url=drive_url_template.format(file_id=file_id, page_number=page_number),
                )
            )
    return chunks
