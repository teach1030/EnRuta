import uuid
from sqlalchemy import Column, String, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.session import Base

class StopClient(Base):
    __tablename__ = "stop_clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    stop_id = Column(UUID(as_uuid=True), ForeignKey("stops.id", ondelete="CASCADE"), nullable=False)
    
    # Datos del cliente / paquete
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    packages_count = Column(Integer, default=1, nullable=False)
    notes = Column(String, nullable=True)

    # Relaciones
    stop = relationship("Stop", back_populates="clients")
