import uuid
import enum
from sqlalchemy import Boolean, Column, String, Float, ForeignKey, Integer, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.session import Base

class StopStatus(str, enum.Enum):
    pending = "pending"
    delivered = "delivered"
    failed = "failed"

class Stop(Base):
    __tablename__ = "stops"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    
    # Ubicacion fisica
    address = Column(String, nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    
    # Estado y UI
    status = Column(SQLEnum(StopStatus), default=StopStatus.pending, nullable=False)
    color_code = Column(String, nullable=True)
    sequence_order = Column(Integer, nullable=True)
    is_pinned = Column(Boolean, default=False, nullable=False, server_default="false")

    # Relaciones
    # lazy='selectin' es crucial para SQLAlchemy Async y Pydantic anidado
    clients = relationship("StopClient", back_populates="stop", cascade="all, delete-orphan", lazy="selectin")
    route = relationship("Route", back_populates="stops")
