# EnRuta Backend API

Backend FastAPI para la aplicacion de enrutamiento y logistica **EnRuta**.

## Tecnologias

| Componente | Tecnologia |
|---|---|
| Framework | FastAPI 0.115 |
| Base de datos | PostgreSQL (Supabase) |
| ORM | SQLAlchemy 2.0 (async) |
| Migraciones | Alembic |
| Optimizacion | Google OR-Tools (pendiente) |
| Geocodificacion | Mapbox Geocoding API v6 |
| OCR | Tesseract + pytesseract (pendiente) |
| Autenticacion | JWT (python-jose + passlib) |

## Estructura del Proyecto

```
backend/
   app/
      api/v1/
         endpoints/
            drivers.py   # Auth y gestion de conductores
            routes.py    # CRUD de rutas y paradas
            ocr.py       # Procesamiento OCR de guias
         router.py
      core/
         config.py       # Configuracion (Pydantic Settings)
      db/
         session.py      # Motor y sesion async SQLAlchemy
      models/
         driver.py       # Tabla drivers
         route.py        # Tabla routes
         stop.py         # Tabla stops
      schemas/
         driver.py       # Schemas Pydantic conductores
         route.py        # Schemas Pydantic rutas y paradas
      services/
         geocoding.py    # Integracion Mapbox
         routing.py      # Optimizacion OR-Tools
      utils/
         normalization.py # Normalizador direcciones Bogota
   tests/
      test_normalization.py
   alembic/              # Migraciones de BD
   requirements.txt
   .env.example
```

## Configuracion Rapida

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase y Mapbox

# 3. Ejecutar migraciones
alembic upgrade head

# 4. Iniciar servidor
uvicorn app.main:app --reload
```

## API Endpoints

| Metodo | Endpoint | Descripcion |
|---|---|---|
| POST | /api/v1/drivers/register | Registrar conductor |
| POST | /api/v1/drivers/login | Login (retorna JWT) |
| GET | /api/v1/drivers/{id} | Obtener conductor |
| POST | /api/v1/routes | Crear ruta |
| GET | /api/v1/routes | Listar rutas del conductor |
| GET | /api/v1/routes/{id} | Obtener ruta con paradas |
| POST | /api/v1/routes/{id}/stops | Agregar paradas |
| PATCH | /api/v1/routes/{id}/stops/{stop_id} | Actualizar estado parada |
| POST | /api/v1/routes/{id}/optimize | Optimizar ruta (OR-Tools) |
| POST | /api/v1/routes/{id}/start | Iniciar ruta |
| POST | /api/v1/ocr/process-guide | Procesar guia por OCR |

Documentacion interactiva disponible en: `http://localhost:8000/docs`