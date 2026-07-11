import pytest

import backend.server as server


@pytest.mark.asyncio
async def test_verify_returns_existing_purchase_without_creating_new(monkeypatch):
    class DummyCollection:
        async def find_one(self, *args, **kwargs):
            return {"id": "existing-purchase", "user_id": "student-1", "pdf_id": "pdf-1", "payment_id": "pay-1", "created_at": "2026-01-01T00:00:00+00:00"}

        async def insert_one(self, *args, **kwargs):
            return None

    monkeypatch.setattr(server, "db", type("DB", (), {"purchases": DummyCollection(), "payments": DummyCollection()}))
    monkeypatch.setattr(server, "get_razorpay_keys", lambda: ("key", "secret"))

    result = await server.digital_store_payments_verify(
        server.PaymentVerifyPdfIn(
            razorpay_payment_id="pay_123",
            razorpay_order_id="order_123",
            razorpay_signature="sig",
            pdf_id="pdf-1",
        ),
        user={"id": "student-1"},
    )

    assert result["already"] is True
    assert result["purchase"]["id"] == "existing-purchase"


@pytest.mark.asyncio
async def test_free_pdf_preview_allows_access_without_purchase(monkeypatch):
    class DummyDigitalPdfCollection:
        async def find_one(self, *args, **kwargs):
            return {"id": "pdf-free", "title": "Free PDF", "published": True, "price": 0, "drive_file_id": "file-free"}

    class DummyPurchaseCollection:
        async def find_one(self, *args, **kwargs):
            return None

    async def fake_download(file_id):
        return b"%PDF-1.4", "application/pdf"

    monkeypatch.setattr(server, "db", type("DB", (), {
        "digital_pdfs": DummyDigitalPdfCollection(),
        "purchases": DummyPurchaseCollection(),
    }))
    monkeypatch.setattr(server, "_download_drive_pdf", fake_download)

    response = await server.preview_pdf(
        "pdf-free",
        user={"id": "student-1", "role": "student"},
    )

    assert response.status_code == 200
    assert response.body == b"%PDF-1.4"
