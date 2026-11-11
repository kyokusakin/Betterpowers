import re
from dataclasses import dataclass


class InvalidInput(ValueError):
    pass


@dataclass(frozen=True)
class Phone:
    value: str

    @classmethod
    def parse(cls, raw: object) -> "Phone":
        if not isinstance(raw, str) or not re.fullmatch(r"09\d{8}", raw):
            raise InvalidInput("phone must be 10 digits starting with 09")
        return cls(raw)


@dataclass(frozen=True)
class Code:
    value: str

    @classmethod
    def parse(cls, raw: object) -> "Code":
        if not isinstance(raw, str) or not re.fullmatch(r"\d{6}", raw):
            raise InvalidInput("code must be 6 digits")
        return cls(raw)
