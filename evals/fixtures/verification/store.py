from datetime import datetime

from domain import Code, Phone


class InMemoryStore:
    def __init__(self) -> None:
        self._codes: dict[Phone, tuple[Code, datetime]] = {}

    def save(self, phone: Phone, code: Code, issued_at: datetime) -> None:
        self._codes[phone] = (code, issued_at)

    def load(self, phone: Phone) -> tuple[Code, datetime] | None:
        return self._codes.get(phone)
