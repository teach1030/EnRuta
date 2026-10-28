"""
app/services/routing.py
=============================================================================
Servicio de optimizacion de rutas con Google OR-Tools.

Implementa un solver TSP/VRP con las siguientes caracteristicas:
  - Matriz de distancias Haversine (sin costo de API para el MVP)
  - Un solo vehiculo (VRP degenerado a TSP)
  - Deposito en indice 0 (bodega/origen de la ruta)
  - Limite de tiempo configurable para el solver (default 30s)
  - Retorno al deposito opcional (open/closed TSP)
  - Separacion clara entre paradas geocodificadas y sin geocodificar

La funcion publica es optimize_route() y retorna OptimizationResult con:
  - optimized_stop_ids: lista de UUIDs de paradas en el orden optimo
  - optimized_sequence: lista de indices (0-based) en el orden optimo
  - total_distance_km: distancia total de la ruta optimizada
  - total_duration_min: estimacion de tiempo segun velocidad urbana Bogota
  - solver_status: "optimal", "feasible" o "infeasible"
  - metadata: estadisticas del solver para auditoria
=============================================================================
"""
from __future__ import annotations

import math
import uuid
import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

if TYPE_CHECKING:
    from app.models.stop import Stop

logger = logging.getLogger(__name__)

# Velocidad promedio estimada para Bogota urbano (km/h)
# Usada para convertir distancia a tiempo estimado de viaje
BOGOTA_AVG_SPEED_KMH = 20.0

# Tiempo promedio de cada parada (minutos): entregar paquete, subir, bajar, etc.
STOP_SERVICE_TIME_MIN = 5


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# DATA CLASSES
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@dataclass
class OptimizationResult:
    """Resultado del algoritmo de optimizacion de ruta."""
    optimized_stop_ids: list[uuid.UUID]   # UUIDs de paradas en orden optimo
    optimized_sequence: list[int]          # Indices 0-based en orden optimo
    total_distance_km: float
    total_duration_min: int
    solver_status: str                     # "optimal" | "feasible" | "infeasible"
    metadata: dict = field(default_factory=dict)


@dataclass
class _Location:
    """Punto geografico para la matriz de distancias."""
    lat: float
    lng: float
    stop_id: uuid.UUID | None = None  # None para el deposito


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# DISTANCIA HAVERSINE
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """
    Distancia en metros entre dos coordenadas geograficas (formula Haversine).

    OR-Tools necesita enteros, por eso se devuelven metros (int).
    La precision de ~1 metro es mas que suficiente para rutas urbanas.
    """
    R = 6_371_000  # Radio de la Tierra en metros
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return int(R * c)


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# MATRIZ DE DISTANCIAS
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _build_distance_matrix(locations: list[_Location]) -> list[list[int]]:
    """
    Construye la matriz de distancias NÃ—N en metros.

    Indice 0 = deposito (bodega/origen).
    Indices 1..N-1 = paradas de entrega.

    La matriz es simetrica (distancia A->B == B->A) lo cual es una
    aproximacion valida para el MVP. En produccion se puede reemplazar
    con la Mapbox Matrix API para considerar sentidos viales.
    """
    n = len(locations)
    matrix: list[list[int]] = []

    for i in range(n):
        row: list[int] = []
        for j in range(n):
            if i == j:
                row.append(0)
            else:
                row.append(
                    _haversine_meters(
                        locations[i].lat, locations[i].lng,
                        locations[j].lat, locations[j].lng,
                    )
                )
        matrix.append(row)

    return matrix


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# SOLVER OR-TOOLS
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _extend_matrix_for_open_tsp(matrix: list[list[int]]) -> list[list[int]]:
    """
    Extiende la matriz para implementar open TSP en OR-Tools.

    Tecnica estandar: se agrega un nodo "dummy" al final (indice n)
    con distancia 0 hacia/desde todos los demas nodos. El vehiculo
    "regresa" a este nodo dummy de forma gratuita, lo que equivale
    a terminar en cualquier nodo sin costo de retorno al deposito real.
    """
    n = len(matrix)
    extended = [row[:] + [0] for row in matrix]   # Agregar columna de ceros
    extended.append([0] * (n + 1))                 # Agregar fila de ceros (dummy)
    return extended


def _solve_tsp(
    distance_matrix: list[list[int]],
    max_solve_seconds: int = 30,
    return_to_depot: bool = False,
) -> tuple[list[int], int, str]:
    """
    Resuelve el TSP con OR-Tools Routing Solver.

    Para open TSP (return_to_depot=False) se usa la tecnica del dummy depot:
    se agrega un nodo ficticio al final con costos 0, de forma que el solver
    puede "regresar" a el de forma gratuita desde cualquier parada, sin que
    eso represente un costo real. Esto garantiza que TODAS las paradas se
    visiten obligatoriamente y en el orden mas eficiente.

    Args:
        distance_matrix: Matriz N×N de distancias en metros (enteros).
            El indice 0 es siempre el deposito.
        max_solve_seconds: Limite de tiempo para el solver.
        return_to_depot: Si True, la ruta es circular (closed TSP).
            Si False, open TSP via dummy depot.

    Returns:
        Tuple de:
        - route_indices: lista de indices 0-based de stops (sin deposito)
          en el orden optimo de visita
        - total_distance_m: distancia de viaje total en metros
        - status: "optimal", "feasible" o "infeasible"
    """
    n = len(distance_matrix)

    # Manejar caso trivial: 0 o 1 parada (no necesita solver)
    if n <= 2:
        # Solo deposito o deposito + 1 parada
        route = list(range(1, n))
        dist = distance_matrix[0][1] if n == 2 else 0
        return route, dist, "optimal"

    # Para open TSP: extender la matriz con un dummy depot
    # El solver regresa al dummy de forma gratuita -> no hay costo de retorno real
    if not return_to_depot:
        working_matrix = _extend_matrix_for_open_tsp(distance_matrix)
        # El dummy depot ocupa el indice n (el ultimo)
        dummy_depot = n
        effective_n = n + 1
    else:
        working_matrix = distance_matrix
        dummy_depot = 0
        effective_n = n

    # --- Crear modelo de enrutamiento ---
    # Un vehiculo, depot en indice 0 (inicio) y dummy_depot (fin para open TSP)
    starts = [0]
    ends = [dummy_depot]
    manager = pywrapcp.RoutingIndexManager(effective_n, 1, starts, ends)
    routing = pywrapcp.RoutingModel(manager)

    # --- Callback de distancia ---
    def distance_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return working_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # --- Estrategia de busqueda ---
    search_params = pywrapcp.DefaultRoutingSearchParameters()

    # Primera solucion: PATH_CHEAPEST_ARC (optima para TSP urbano denso)
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )

    # Metaheuristica: GUIDED_LOCAL_SEARCH mejora la solucion inicial
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )

    # Limite de tiempo
    search_params.time_limit.FromSeconds(max_solve_seconds)

    # Silenciar logs internos del solver
    search_params.log_search = False

    # --- Resolver ---
    solution = routing.SolveWithParameters(search_params)

    if solution is None:
        return [], 0, "infeasible"

    # --- Extraer ruta optima ---
    # Recorremos la cadena de nodos desde Start hasta End
    # Excluimos el deposito inicial (indice 0) y el dummy final (indice dummy_depot)
    route_indices: list[int] = []
    total_distance_m = 0

    index = routing.Start(0)
    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        next_index = solution.Value(routing.NextVar(index))
        next_node = manager.IndexToNode(next_index)

        # Acumular distancia real (excluir arcos al dummy que tienen costo 0)
        arc_cost = working_matrix[node][next_node]
        if next_node != dummy_depot:
            total_distance_m += arc_cost

        # Registrar nodo si no es deposito real ni dummy
        if node != 0 and node != dummy_depot:
            route_indices.append(node - 1)  # Convertir a indice 0-based de stops

        index = next_index

    # routing.status(): 1 = ROUTING_OPTIMAL, 2 = ROUTING_SUCCESS (feasible), otros = fallo
    status = "optimal" if routing.status() == 1 else "feasible"

    return route_indices, total_distance_m, status



# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# FUNCION PUBLICA
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def optimize_route(
    stops: list["Stop"],
    origin_lat: float,
    origin_lng: float,
    max_solve_seconds: int = 30,
    return_to_depot: bool = False,
) -> OptimizationResult:
    """
    Optimiza el orden de visita de las paradas usando Google OR-Tools.

    Flujo:
    1. Separa paradas geocodificadas de las que no tienen coordenadas.
    2. Construye la lista de ubicaciones: [deposito] + [paradas geocodificadas].
    3. Calcula la matriz de distancias Haversine (N+1 x N+1).
    4. Invoca el solver TSP de OR-Tools con GUIDED_LOCAL_SEARCH.
    5. Retorna la secuencia optima junto con metricas de distancia y tiempo.

    Las paradas sin geocodificar se colocan al FINAL de la secuencia con
    sequence_order = len(geocoded) + i, para que el conductor las gestione
    manualmente despues de las paradas con coordenadas.

    Args:
        stops: Lista de objetos Stop con lat/lng opcionales.
        origin_lat: Latitud del deposito (bodega de salida).
        origin_lng: Longitud del deposito.
        max_solve_seconds: Tiempo maximo para el solver (default 30s).
        return_to_depot: Si el conductor debe regresar a la bodega al final.

    Returns:
        OptimizationResult con la secuencia optima y metricas.
    """
    # --- Separar geocodificadas de sin geocodificar ---
    geocoded: list["Stop"] = []
    non_geocoded: list["Stop"] = []

    for s in stops:
        if s.lat is not None and s.lng is not None:
            geocoded.append(s)
        else:
            non_geocoded.append(s)

    logger.info(
        "Optimizando ruta: %d paradas geocodificadas, %d sin geocodificar",
        len(geocoded), len(non_geocoded),
    )

    # --- Caso sin paradas geocodificadas ---
    if not geocoded:
        return OptimizationResult(
            optimized_stop_ids=[s.id for s in non_geocoded],
            optimized_sequence=list(range(len(non_geocoded))),
            total_distance_km=0.0,
            total_duration_min=len(non_geocoded) * STOP_SERVICE_TIME_MIN,
            solver_status="infeasible",
            metadata={
                "error": "Ninguna parada tiene coordenadas geocodificadas",
                "non_geocoded": len(non_geocoded),
            },
        )

    # --- Construir ubicaciones: deposito (idx=0) + paradas geocodificadas ---
    locations: list[_Location] = [
        _Location(lat=origin_lat, lng=origin_lng, stop_id=None),  # deposito
    ] + [
        _Location(lat=s.lat, lng=s.lng, stop_id=s.id)
        for s in geocoded
    ]

    # --- Calcular matriz de distancias ---
    distance_matrix = _build_distance_matrix(locations)

    # --- Resolver TSP ---
    route_indices, total_dist_m, solver_status = _solve_tsp(
        distance_matrix,
        max_solve_seconds=max_solve_seconds,
        return_to_depot=return_to_depot,
    )

    if solver_status == "infeasible":
        logger.warning("OR-Tools no encontro solucion factible")
        # Fallback: orden de insercion como secuencia de emergencia
        route_indices = list(range(len(geocoded)))
        solver_status = "fallback_sequential"
        # Recalcular distancia para el orden secuencial
        total_dist_m = sum(
            distance_matrix[i][i + 1] for i in range(len(locations) - 1)
        )

    # --- Construir lista ordenada de stop IDs ---
    # route_indices son indices 0-based de geocoded[]
    ordered_geocoded_ids = [geocoded[i].id for i in route_indices]

    # Las no geocodificadas van al final del orden
    non_geocoded_ids = [s.id for s in non_geocoded]

    all_ordered_ids = ordered_geocoded_ids + non_geocoded_ids

    # --- Calcular metricas ---
    total_km = round(total_dist_m / 1000, 2)
    travel_time_min = int((total_km / BOGOTA_AVG_SPEED_KMH) * 60)
    service_time_min = len(geocoded) * STOP_SERVICE_TIME_MIN
    total_duration_min = travel_time_min + service_time_min

    logger.info(
        "Optimizacion completada: status=%s, distancia=%.2f km, duracion=%d min",
        solver_status, total_km, total_duration_min,
    )

    return OptimizationResult(
        optimized_stop_ids=all_ordered_ids,
        optimized_sequence=route_indices,
        total_distance_km=total_km,
        total_duration_min=total_duration_min,
        solver_status=solver_status,
        metadata={
            "solver": "OR-Tools TSP / PATH_CHEAPEST_ARC + GUIDED_LOCAL_SEARCH",
            "geocoded_stops": len(geocoded),
            "non_geocoded_stops": len(non_geocoded),
            "total_stops": len(stops),
            "return_to_depot": return_to_depot,
            "distance_metric": "haversine_meters",
            "estimated_speed_kmh": BOGOTA_AVG_SPEED_KMH,
            "service_time_per_stop_min": STOP_SERVICE_TIME_MIN,
        },
    )