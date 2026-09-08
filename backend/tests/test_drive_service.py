import pytest

from app.services.drive_service import DriveFolderAccessError, DriveService

AUTHORIZED_FOLDER = "1RxJbIKBJ1SfiPO4wj4skXbxgaIYguUO4"


@pytest.fixture
def drive_service():
    return DriveService(folder_id=AUTHORIZED_FOLDER, credentials_path="fake-creds.json")


def test_list_pdfs_rejects_unauthorized_folder_without_calling_api(drive_service, mocker):
    build_mock = mocker.patch("app.services.drive_service.build")
    mocker.patch("app.services.drive_service.service_account.Credentials.from_service_account_file")

    with pytest.raises(DriveFolderAccessError):
        drive_service.list_pdfs("some-other-folder-id")

    build_mock.assert_not_called()


def test_list_pdfs_only_ever_queries_the_configured_folder(drive_service, mocker):
    mocker.patch("app.services.drive_service.service_account.Credentials.from_service_account_file")
    client = mocker.Mock()
    client.files.return_value.list.return_value.execute.return_value = {
        "files": [{"id": "f1", "name": "doc.pdf", "parents": [AUTHORIZED_FOLDER]}],
        "nextPageToken": None,
    }
    mocker.patch("app.services.drive_service.build", return_value=client)

    files = drive_service.list_pdfs(AUTHORIZED_FOLDER)

    assert files == [{"id": "f1", "name": "doc.pdf", "parents": [AUTHORIZED_FOLDER]}]
    called_query = client.files.return_value.list.call_args.kwargs["q"]
    assert AUTHORIZED_FOLDER in called_query
    for call in client.files.return_value.list.call_args_list:
        assert call.kwargs["q"] == called_query  # never queries a different folder id


def test_download_pdf_rejects_file_outside_authorized_folder(drive_service, mocker):
    mocker.patch("app.services.drive_service.service_account.Credentials.from_service_account_file")
    client = mocker.Mock()
    client.files.return_value.get.return_value.execute.return_value = {"parents": ["other-folder"]}
    mocker.patch("app.services.drive_service.build", return_value=client)

    with pytest.raises(DriveFolderAccessError):
        drive_service.download_pdf("some-file-id")

    client.files.return_value.get_media.assert_not_called()


def test_download_pdf_succeeds_for_file_in_authorized_folder(drive_service, mocker):
    mocker.patch("app.services.drive_service.service_account.Credentials.from_service_account_file")
    client = mocker.Mock()
    client.files.return_value.get.return_value.execute.return_value = {"parents": [AUTHORIZED_FOLDER]}
    mocker.patch("app.services.drive_service.build", return_value=client)

    downloader = mocker.patch("app.services.drive_service.MediaIoBaseDownload")
    downloader.return_value.next_chunk.return_value = (None, True)

    result = drive_service.download_pdf("some-file-id")

    assert isinstance(result, bytes)
    client.files.return_value.get_media.assert_called_once_with(fileId="some-file-id")
