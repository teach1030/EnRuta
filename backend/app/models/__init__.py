"""
app/models/__init__.py
Exporta todos los modelos ORM para que Alembic los detecte automáticamente.
"""
from app.models.driver import Driver
from app.models.route import Route, RouteStatus
from app.models.stop import Stop, StopStatus
from app.models.stop_client import StopClient

__all__ = [
    "Driver",
    "Route",
    "RouteStatus",
    "Stop",
    "StopStatus",
    "StopClient",
]
