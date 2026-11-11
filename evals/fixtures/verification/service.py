import secrets
from datetime import datetime, timedelta, timezone
from typing import Callable

from domain import Code, Phone

CODE_TTL = timedelta(minutes=5)


def system_clock() -> datetime:
    return datetime.now(timezone.utc)


def random_code() -> Code:
    return Code(f"{secrets.randbelow(10**6):06d}")


class VerificationService:
    def __init__(
        self,
        store,
        sms,
        clock: Callable[[], datetime] = system_clock,
        generate: Callable[[], Code] = random_code,
    ) -> None:
        self._store = store
        self._sms = sms
        self._clock = clock
        self._generate = generate

    def send_verification_code(self, phone: Phone) -> None:
        code = self._generate()
        self._store.save(phone, code, self._clock())
        self._sms.send(phone, f"Your verification code is {code.value}")

    def verify(self, phone: Phone, code: Code) -> bool:
        issued = self._store.load(phone)
        if issued is None:
            return False
        stored_code, issued_at = issued
        return stored_code == code and self._clock() - issued_at <= CODE_TTL
