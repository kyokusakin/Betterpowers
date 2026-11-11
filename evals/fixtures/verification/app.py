from domain import Code, InvalidInput, Phone
from service import VerificationService


def handle_send(body: dict, service: VerificationService) -> dict:
    try:
        phone = Phone.parse(body.get("phone"))
    except InvalidInput as error:
        return {"status": 400, "error": str(error)}
    service.send_verification_code(phone)
    return {"status": 200}


def handle_verify(body: dict, service: VerificationService) -> dict:
    try:
        phone = Phone.parse(body.get("phone"))
        code = Code.parse(body.get("code"))
    except InvalidInput as error:
        return {"status": 400, "error": str(error)}
    return {"status": 200, "verified": service.verify(phone, code)}
