# Betterpowers worked examples

Read the section that matches the decision at hand.

## Tests

Allowed: final result.

```python
def test_correct_code_verifies():
    sms = FakeSms()
    svc = VerificationService(store=InMemoryStore(), sms=sms)
    svc.send_verification_code(PHONE)
    assert svc.verify(PHONE, sms.last_code_to(PHONE))

def test_expired_code_rejected():
    clock, sms = FakeClock(), FakeSms()
    svc = VerificationService(store=InMemoryStore(), sms=sms, clock=clock)
    svc.send_verification_code(PHONE)
    clock.advance(minutes=6)
    assert not svc.verify(PHONE, sms.last_code_to(PHONE))
```

Allowed: business-process states.

```python
def test_order_lifecycle():
    order = place_order(cart)
    assert order.status == "pending_payment"
    pay(order, card)
    assert order.status == "paid"
    ship(order)
    assert order.status == "shipped"
```

Allowed: an external interaction that is itself the contract, through a recording fake.

```python
def test_one_sms_per_request():
    sms = FakeSms()
    VerificationService(store=InMemoryStore(), sms=sms).send_verification_code(PHONE)
    assert sms.count_to(PHONE) == 1
```

Forbidden: implementation steps. Renaming the store key breaks this test while behavior is unchanged, and a wrong expiry may still pass.

```python
def test_send_code():
    store, sms = Mock(), Mock()
    VerificationService(store, sms, gen=lambda: "123456").send_verification_code(PHONE)
    store.set.assert_called_once_with("vc:0912345678", "123456", ex=300)
    sms.send.assert_called_once_with(PHONE, "123456")
```

## Data trust

Entry: validate once and parse into types.

```python
@app.post("/verify")
def verify_endpoint(body: dict):
    phone = Phone.parse(body.get("phone"))
    code = Code.parse(body.get("code"))
    return {"ok": service.verify(phone, code)}
```

Internal: trust the types. A missing stored code means no code was issued; that is a business state.

```python
def verify(self, phone: Phone, code: Code) -> bool:
    return self.store.get(phone) == code
```

Forbidden: re-validation past the entry.

```python
def verify(self, phone, code):
    if not phone or not isinstance(phone, str):
        raise ValueError("invalid phone")
    if len(code) != 6:
        return False
    ...
```

Storage ownership:

```python
# users is written only by this program: internal.
user = db.users.get(user_id)
send_welcome(user.email)

# legacy_orders is also written by the ERP: entry.
order = LegacyOrder.parse(db.legacy_orders.get(order_id))
```

## Naming and side effects

| Name | Verdict |
|---|---|
| `generate_code()` that also writes the store and sends an SMS | Wrong: "generate" promises no side effects |
| `generate_code_and_save_and_send_sms()` | Wrong: lists steps instead of naming the action |
| `send_verification_code(phone)` | Right: the domain action covers generating, recording, and sending |
| `generate_code()` that only returns a random string | Right: the name promises no side effects and keeps the promise |

## Comments

Allowed: a domain rule.

```python
# Regulation requires a code to expire within five minutes of issue.
CODE_TTL = timedelta(minutes=5)
```

Allowed: a `limit:` marker.

```python
# limit: counts requests in process memory; each server counts separately, move to Redis before running more than one server
_request_counts: dict[UserId, int] = {}
```

Forbidden:

```python
# Fixed: codes expired too early (ticket #123)
# Loop through all codes
# Defensive check just in case
```
