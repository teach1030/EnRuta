# EnRuta - Sistema Inteligente de Optimizacion de Rutas de Ultima Milla

EnRuta es una plataforma integral (aplicacion movil y backend de alto rendimiento) disenada especificamente para mensajeros y conductores de paqueteria y distribucion urbana en Colombia. Resuelve de forma nativa la complejidad de la nomenclatura urbana de Bogota D.C., optimiza el orden de paradas para minimizar tiempo y combustible, y digitaliza el escaneo de guias de transporte mediante vision artificial multimodelo.

---

## 1. Descripcion General del Proyecto

En el sector logistico urbano, los conductores se enfrentan a tres problemas criticos diarios:
1. **Nomenclatura compleja y no estandarizada**: Direcciones escritas con multiples abreviaciones (Cll, Kra, Dg, Tv, Autonorte) y complementos repetidos o pegados (torre2 int4 apto 1101).
2. **Multiples paquetes por parada**: Entregas en conjuntos residenciales, edificios o centros empresariales donde una misma direccion fisica agrupa a varios destinatarios con diferentes telefonos y paquetes.
3. **Perdida de tiempo en digitacion**: Introduccion manual de 30 a 80 paradas diarias leyendo guias fisicas impresas de empresas como Servientrega, Coordinadora, Interrapidisimo, Envía, J&T Express o iMile.

EnRuta resuelve estos problemas mediante una arquitectura desacoplada y moderna que combina:
- Procesamiento OCR inteligente con IA multimodal (Google Gemini 3.8 Flash).
- Motor de normalizacion y separacion de complementos para direcciones de Bogota.
- Geocodificacion de alta precision y optimizacion de secuencia con Mapbox.
- Aplicacion movil interactiva con mapas, gestos tactiles fluidos y conexion directa con navegadores GPS externos (Google Maps y Waze).

---

## 2. Arquitectura del Sistema

### 2.1 Pila Tecnologica (Tech Stack)

#### Frontend Movil (`mobile/`)
- **Framework**: React Native 0.86.3 con Expo SDK 57 (New Architecture / TurboModules habilitados).
- **Lenguaje**: TypeScript 6.0 con tipado estricto.
- **Manejo de Estado Global**: Zustand 5.0 con middleware de persistencia asincrona (`AsyncStorage`).
- **Mapas y Geolocalizacion**: `react-native-maps` con pines personalizados, marcadores numerados secuenciales y Google Maps SDK.
- **Gestos y Navegacion**: `react-native-gesture-handler` (soporte Swipeable para cambio de estado en paradas), `@react-navigation/native-stack`.
- **Camara**: `expo-camera` para captura en vivo de etiquetas de envio.
- **Diseno Visual**: Paleta Eco-Modern (`#065F46` Verde Bosque, `#10B981` Esmeralda, `#F1F5F9` Fondo Suave).

#### Backend API (`backend/`)
- **Framework**: FastAPI (Python 3.12) asincrono.
- **Base de Datos y ORM**: PostgreSQL con SQLAlchemy 2.0 Async (`asyncpg`), migraciones con Alembic.
- **Seguridad**: Autenticacion JWT (Bearer tokens con `python-jose`) y encriptacion de contrasenas con `bcrypt` nativo.
- **OCR y Vision Artificial**: Google Gemini API (`gemini-3.8-flash` via SDK oficial `google-genai` v2.33).
- **Geocodificacion y Rutas**: Mapbox Geocoding API v6 (delimitado al bounding box de Bogota) y Mapbox Optimization API.
- **Validacion de Esquemas**: Pydantic v2 y Pydantic Settings.

---

## 3. Modulos y Funcionalidades Implementadas

### 3.1 Modelo Multi-Cliente por Parada
Se implemento un modelo relacional y schemas donde una parada (`Stop`) representa una ubicacion fisica unica (`lat`, `lng`, `address`, `color_code`, `status`), y contiene una relacion uno-a-muchos con clientes (`StopClient`: `name`, `phone`, `packages_count`, `notes`).
- **Ventaja**: El conductor llega a una direccion y puede ver todos los paquetes y destinatarios correspondientes a esa porteria o edificio.
- **CRUD Completo**: Endpoints `POST /api/v1/stops`, `GET /api/v1/stops/{id}`, `PUT /api/v1/stops/{id}` (con creacion, edicion y eliminacion en lote de clientes), `PUT /api/v1/stops/{id}/estado` (para cambios rapidos de estado via swipe) y `DELETE /api/v1/stops/{id}` (eliminacion en cascada con recuento automatico de paradas en la ruta).

### 3.2 Autenticacion Flexible de Conductores
- **Inicio de Sesion Dual**: Soporta tanto correo electronico como numero celular junto con contrasena (`POST /api/v1/drivers/login`).
- **Google Sign-In**: Validacion segura del `id_token` de Google mediante `google-auth` en servidor (`POST /api/v1/drivers/google-auth`).
- **Modo Invitado (Guest)**: Permite a los usuarios explorar la aplicacion y armar rutas de prueba limitadas a un maximo de 10 paradas.
- **Seguridad y Propiedad**: Dependencia `get_current_driver` en FastAPI que garantiza que cada conductor solo pueda consultar, modificar o eliminar sus propias rutas y paradas.

### 3.3 Motor de Normalizacion de Direcciones (Bogota D.C.)
Ubicado en `backend/app/utils/normalization.py`:
- Convierte variantes y abreviaturas comunes (`cll`, `carrera`, `kra`, `cra`, `diagonal`, `diag`, `transversal`, `tv`, `avenida`, `av`) a formas estandar.
- Limpia sufijos redundantes de guias (`BOGOTA D.C.`, `COL`, nombres de localidades duplicados).
- Separa la direccion base geocodificable (`Calle 166 # 9-24`) de los complementos residenciales (`Torre 2 Interior 4 Apartamento 1101`).
- Desduplica complementos pegados o repetidos por artefactos de OCR (`torre2 int4 apar 1101,torre2 int4 apar 1101`).

### 3.4 Pipeline OCR con Google Gemini Vision
Ubicado en `backend/app/api/v1/endpoints/ocr.py`:
- Recibe la fotografia de una guia de transporte directamente desde la camara del telefono.
- Utiliza el modelo multimodal `gemini-3.8-flash` para interpretar etiquetas complejas de operadores colombianos (Servientrega, J&T, iMile, Interrapidisimo, Coordinadora, etc.).
- Extrae de manera estructurada: numero de guia/tracking, nombre del destinatario, telefono celular y direccion de entrega.
- Conecta directamente el resultado con el motor de normalizacion y el servicio de geocodificacion de Mapbox, entregando de inmediato coordenadas geograficas (`lat`, `lng`).

### 3.5 Optimizacion de Rutas y Navegacion Guiada
- **Algoritmo TSP**: Resuelve la secuencia optima de entrega teniendo en cuenta la ubicacion inicial del conductor (GPS en tiempo real o direccion de origen personalizada).
- **Pines Numerados**: En el mapa, una vez optimizada la ruta, los pines visualizan claramente el orden secuencial de entrega (1, 2, 3...).
- **Navegacion Asistida**: Boton "Ir a la siguiente parada" que detecta la siguiente parada pendiente en la secuencia y abre la instruccion paso a paso en el navegador predilecto configurado por el usuario (Google Maps o Waze mediante URL schemes).
- **Panel Inferior Colapsable**: Bottom sheet reactivo que permite ver la lista de paradas sin obstaculizar la vista general del mapa.

---

## 4. Estructura del Repositorio

```text
EnRuta/
|-- backend/                        # API REST en FastAPI
|   |-- app/
|   |   |-- api/
|   |   |   |-- deps.py             # Dependencias de autenticacion JWT
|   |   |   |-- v1/
|   |   |       |-- router.py       # Registro central de routers v1
|   |   |       |-- endpoints/
|   |   |           |-- drivers.py  # Autenticacion, registro y perfil
|   |   |           |-- routes.py   # Creacion, consulta y optimizacion
|   |   |           |-- stops.py    # CRUD multi-cliente de paradas
|   |   |           |-- ocr.py      # Vision multimodal con Gemini
|   |   |-- core/
|   |   |   |-- config.py           # Variables de entorno y configuracion
|   |   |   |-- security.py         # Hashing con bcrypt y tokens JWT
|   |   |-- db/
|   |   |   |-- session.py          # Conexion asincrona a PostgreSQL
|   |   |-- models/                 # Modelos SQLAlchemy (Driver, Route, Stop, StopClient)
|   |   |-- schemas/                # Esquemas de validacion Pydantic v2
|   |   |-- services/               # Logica de negocio (Geocoding, Routing, StopService)
|   |   |-- utils/
|   |       |-- normalization.py    # Motor de normalizacion de Bogota
|   |-- tests/                      # Suite de pruebas automatizadas (pytest)
|   |-- requirements.txt            # Dependencias Python
|   |-- .env.example                # Plantilla de variables de entorno
|
|-- mobile/                         # Aplicacion React Native con Expo
|   |-- src/
|   |   |-- components/             # Componentes modulares (StartPointPicker, BottomSheet, etc.)
|   |   |-- navigation/             # AppNavigator y navegacion por stack
|   |   |-- screens/                # Pantallas (Login, HomeMap, StopDetail, Scanner, Settings, etc.)
|   |   |-- services/
|   |   |   |-- api.ts              # Cliente HTTP tipado para el backend
|   |   |-- store/
|   |   |   |-- useAuthStore.ts     # Estado persistente de sesion y preferencias
|   |   |   |-- useRouteStore.ts    # Estado reactivo de paradas y clientes
|   |   |-- theme/                  # Sistema de diseno Eco-Modern
|   |-- package.json                # Dependencias Node.js
|   |-- app.json                    # Configuracion Expo y claves nativas
|
|-- .gitignore                      # Reglas de exclusion de seguridad y compilacion
|-- README.md                       # Documentacion tecnica del proyecto
```

---

## 5. Instrucciones de Configuracion y Despliegue

### 5.1 Requisitos Previos
- Python 3.12 o superior.
- Node.js 18 o superior y gestor de paquetes npm.
- PostgreSQL (local o instancia en la nube como Supabase / RDS).
- Cuenta y credenciales de Mapbox y Google AI Studio (Gemini).

### 5.2 Configuracion del Backend

1. Navegar a la carpeta del backend:
   ```bash
   cd backend
   ```
2. Crear y activar un entorno virtual:
   ```bash
   python -m venv venv
   # En Windows:
   .\venv\Scripts\activate
   # En Linux/macOS:
   source venv/bin/activate
   ```
3. Instalar dependencias:
   ```bash
   pip install -r requirements.txt
   ```
4. Configurar el archivo `.env`:
   Copiar `.env.example` a `.env` y completar los valores correspondientes:
   ```bash
   cp .env.example .env
   ```
5. Ejecutar la suite de pruebas:
   ```bash
   pytest
   ```
6. Iniciar el servidor de desarrollo:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   La documentacion interactiva Swagger UI estara disponible en `http://localhost:8000/docs`.

### 5.3 Configuracion de la Aplicacion Movil

1. Navegar a la carpeta movil:
   ```bash
   cd mobile
   ```
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Configurar la URL de la API:
   Definir la variable de entorno `EXPO_PUBLIC_API_URL` apuntando a la IP local de tu maquina o al backend desplegado (ejemplo para emulador Android: `http://10.0.2.2:8000/api/v1`).
4. Iniciar el entorno de desarrollo:
   ```bash
   npx expo start
   ```
5. Para compilar y ejecutar en Android directamente con los modulos nativos:
   ```bash
   npx expo run:android
   ```

---

## 6. Licencia y Estado de Desarrollo

Proyecto desarrollado como solucion logistica integral para distribucion urbana. Estado actual: **Fase MVP Completa** (Frontend reactivo y componentes nativos operativos, backend FastAPI con arquitectura multi-cliente, motor de direcciones validado y pipeline de vision artificial integrado).
