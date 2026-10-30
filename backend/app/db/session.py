"""
app/db/session.py
Configuración de la sesión asíncrona de SQLAlchemy para Supabase/PostgreSQL.
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


# --- Motor asíncrono ---
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=10,
    connect_args={"timeout": 10, "command_timeout": 15},
)

# --- Fábrica de sesiones ---
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# --- Clase Base para modelos ORM ---
class Base(DeclarativeBase):
    pass


# --- Dependency Injection para FastAPI ---
async def get_db() -> AsyncSession:
    """
    Generador de sesiones de base de datos para inyección de dependencias.
    Garantiza que la sesión se cierre al finalizar cada request.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
