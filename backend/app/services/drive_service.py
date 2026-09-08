from io import BytesIO

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


class DriveFolderAccessError(Exception):
    """Raised when an operation would touch content outside the authorized folder."""


class DriveService:
    """MCP-tool-shaped wrapper around Google Drive, restricted to one folder.

    Stands in for a real MCP Drive server (per CLAUDE.md's MCP boundary) using
    the official API client with a service account. Callers only ever see
    `list_pdfs`/`download_pdf`, so this can be swapped for an MCP client later
    without touching call sites.
    """

    def __init__(self, folder_id: str, credentials_path: str):
        self._folder_id = folder_id
        self._credentials_path = credentials_path
        self._client = None

    def _get_client(self):
        if self._client is None:
            credentials = service_account.Credentials.from_service_account_file(
                self._credentials_path, scopes=DRIVE_SCOPES
            )
            self._client = build("drive", "v3", credentials=credentials, cache_discovery=False)
        return self._client

    def list_pdfs(self, folder_id: str) -> list[dict]:
        """Lists PDF files in `folder_id`. Only the configured folder is authorized."""
        if folder_id != self._folder_id:
            raise DriveFolderAccessError(
                f"Refusing to list folder {folder_id!r}; only {self._folder_id!r} is authorized."
            )
        client = self._get_client()
        query = f"'{folder_id}' in parents and mimeType='application/pdf' and trashed=false"
        files: list[dict] = []
        page_token = None
        while True:
            response = (
                client.files()
                .list(q=query, fields="nextPageToken, files(id, name, parents)", pageToken=page_token)
                .execute()
            )
            files.extend(response.get("files", []))
            page_token = response.get("nextPageToken")
            if not page_token:
                break
        return files

    def download_pdf(self, file_id: str) -> bytes:
        """Downloads a PDF's bytes, verifying it lives in the authorized folder first."""
        client = self._get_client()
        metadata = client.files().get(fileId=file_id, fields="parents").execute()
        if self._folder_id not in metadata.get("parents", []):
            raise DriveFolderAccessError(
                f"Refusing to download file {file_id!r}; it is not within the authorized folder."
            )
        request = client.files().get_media(fileId=file_id)
        buffer = BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return buffer.getvalue()
