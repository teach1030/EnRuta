"""
app/api/v1/router.py
Router principal de la API v1. Agrega todos los sub-routers de endpoints.
"""
from fastapi import APIRouter
from app.api.v1.endpoints import drivers, routes, stops, ocr

api_router = APIRouter()

api_router.include_router(drivers.router)
api_router.include_router(routes.router)
api_router.include_router(stops.router)
api_router.include_router(ocr.router)
