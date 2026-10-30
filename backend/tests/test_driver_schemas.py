import pytest
from app.schemas.driver import DriverCreate, DriverUpdate, DriverResponse

def test_driver_create_with_email():
    payload = DriverCreate(
        name="Juan Test",
        email="juan@enruta.com",
        password="secretpassword",
        vehicle="Moto Bajaj Pulsar",
        vehicle_plate="XYZ123",
    )
    assert payload.email == "juan@enruta.com"
    assert payload.phone is None
    assert payload.vehicle == "Moto Bajaj Pulsar"
    assert payload.vehicle_plate == "XYZ123"

def test_driver_create_with_phone():
    payload = DriverCreate(
        name="Carlos Reparto",
        phone="3001234567",
        password="secretpassword",
    )
    assert payload.phone == "3001234567"
    assert payload.email is None

def test_driver_create_requires_email_or_phone():
    with pytest.raises(ValueError):
        DriverCreate(
            name="Sin Contacto",
            password="secretpassword",
        )

def test_driver_update_vehicle():
    update = DriverUpdate(
        vehicle="Suzuki GN 125",
        vehicle_plate="ABC999",
    )
    assert update.vehicle == "Suzuki GN 125"
    assert update.vehicle_plate == "ABC999"
