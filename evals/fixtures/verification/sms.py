from domain import Phone


class ConsoleSms:
    def send(self, phone: Phone, text: str) -> None:
        print(f"SMS to {phone.value}: {text}")
