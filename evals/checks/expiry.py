from datetime import datetime, timedelta, timezone

from domain import Code, Phone
from service import VerificationService
from store import InMemoryStore


class RecordingSms:
    def __init__(self) -> None:
        self.messages: list[str] = []

    def send(self, phone: Phone, text: str) -> None:
        self.messages.append(text)


def code_accepted_after(minutes: int) -> bool:
    now = [datetime(2026, 1, 1, tzinfo=timezone.utc)]
    sms = RecordingSms()
    service = VerificationService(InMemoryStore(), sms, clock=lambda: now[0])
    phone = Phone("0912345678")
    service.send_verification_code(phone)
    code = Code(sms.messages[-1][-6:])
    now[0] += timedelta(minutes=minutes)
    return service.verify(phone, code)


assert code_accepted_after(4), "code rejected before five minutes"
assert not code_accepted_after(6), "code accepted after five minutes"
