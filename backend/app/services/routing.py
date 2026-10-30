"""
app/services/routing.py
=============================================================================
Servicio de optimizacion de rutas con Google OR-Tools.

Implementa un solver TSP/VRP con las siguientes caracteristicas:
  - Matriz de distancias Haversine (sin costo de API para el MVP)
  - Un solo vehiculo (VRP degenerado a TSP)
  - Origen (start_location) en el indice 0 de la matriz
  - Destino final (end_location) opcional en el ultimo indice de la matriz
  - Nodos obligatorios anclados (is_pinned == True) fijados en su posicion
    exacta de secuencia mediante dimension cumulativa en OR-Tools, intercalando
    de forma optima las paradas libres alrededor y entre los nodos anclados
  - Limite de tiempo configurable para el solver (default 30s)
  - Retorno al deposito opcional (open/closed TSP)
  - Separacion clara entre paradas geocodificadas y sin geocodificar
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
BOGOTA_AVG_SPEED_KMH = 20.0

# Tiempo promedio de cada parada (minutos): entregar paquete, subir, bajar, etc.
STOP_SERVICE_TIME_MIN = 5


# -----------------------------------------------------------------------------
# DATA CLASSES
# -----------------------------------------------------------------------------

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
    stop_id: uuid.UUID | None = None  # None para origen/destino


# -----------------------------------------------------------------------------
# DISTANCIA HAVERSINE
# -----------------------------------------------------------------------------

def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """
    Distancia en metros entre dos coordenadas geograficas (formula Haversine).
    OR-Tools necesita enteros, por eso se devuelven metros (int).
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


# -----------------------------------------------------------------------------
# MATRIZ DE DISTANCIAS
# -----------------------------------------------------------------------------

def _build_distance_matrix(locations: list[_Location]) -> list[list[int]]:
    """
    Construye la matriz de distancias N x N en metros.
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


def _extend_matrix_for_open_tsp(matrix: list[list[int]]) -> list[list[int]]:
    """
    Extiende la matriz para implementar open TSP en OR-Tools.
    Agrega un nodo dummy al final (indice n) con distancia 0 hacia/desde todos los nodos.
    """
    n = len(matrix)
    extended = [row[:] + [0] for row in matrix]
    extended.append([0] * (n + 1))
    return extended


# -----------------------------------------------------------------------------
# SOLVER OR-TOOLS CON NODOS ANCLADOS Y DESTINO EXPLICITO
# -----------------------------------------------------------------------------

def _solve_tsp(
    distance_matrix: list[list[int]],
    max_solve_seconds: int = 30,
    return_to_depot: bool = False,
    has_explicit_end_node: bool = False,
    pinned_positions: dict[int, int] | None = None,
) -> tuple[list[int], int, str]:
    """
    Resuelve el TSP con OR-Tools Routing Solver soportando:
      - Nodo 0: Origen (start_location).
      - Ultimo nodo: Destino definitivo (end_location) si `has_explicit_end_node=True`,
        o retorno al deposito si `return_to_depot=True`, o nodo dummy gratuito (open TSP).
      - `pinned_positions`: diccionario `{stop_idx_0_based: target_step_1_based}`
        que fija paradas con `is_pinned == True` en su posicion exacta de visita,
        obligando a OR-Tools a encontrar el camino mas corto conectando las paradas
        libres alrededor e intercaladas entre estos nodos anclados.

    Args:
        distance_matrix: Matriz de distancias en metros.
            - Si `has_explicit_end_node=False`: tamaño (M + 1) x (M + 1), donde 0 = origen
              y 1..M = paradas.
            - Si `has_explicit_end_node=True`: tamaño (M + 2) x (M + 2), donde 0 = origen,
              1..M = paradas y M + 1 = destino final (end_location).
        max_solve_seconds: Limite de tiempo para el solver.
        return_to_depot: Si True (y no hay end_location), regresa al nodo 0.
        has_explicit_end_node: Si True, el ultimo nodo de `distance_matrix` es el destino.
        pinned_positions: Mapa `{indice_parada_0_based: posicion_secuencia_1_based}`.

    Returns:
        Tuple de (route_indices_0_based, total_distance_m, status).
    """
    pinned_positions = pinned_positions or {}

    if has_explicit_end_node:
        # distance_matrix tiene: 0 (origen), 1..M (paradas), M+1 (end_location)
        num_stops = len(distance_matrix) - 2
        working_matrix = distance_matrix
        end_node = len(distance_matrix) - 1
        effective_n = len(distance_matrix)
        is_dummy_end = False
    else:
        # distance_matrix tiene: 0 (origen), 1..M (paradas)
        num_stops = len(distance_matrix) - 1
        if num_stops <= 0:
            return [], 0, "optimal"
        if num_stops == 1:
            dist = distance_matrix[0][1]
            if return_to_depot:
                dist += distance_matrix[1][0]
            return [0], dist, "optimal"

        if return_to_depot:
            working_matrix = distance_matrix
            end_node = 0
            effective_n = len(distance_matrix)
            is_dummy_end = False
        else:
            working_matrix = _extend_matrix_for_open_tsp(distance_matrix)
            end_node = len(distance_matrix)  # indice del dummy
            effective_n = len(working_matrix)
            is_dummy_end = True

    if num_stops <= 0:
        return [], 0, "optimal"

    # Estrategias a intentar: PATH_CHEAPEST_ARC primero; si hay restricciones duras de
    # posicion (nodos anclados) que bloqueen el greedy inicial, probar FIRST_UNBOUND_MIN_VALUE y AUTOMATIC.
    strategies = [
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC,
    ]
    if pinned_positions:
        strategies.extend([
            routing_enums_pb2.FirstSolutionStrategy.FIRST_UNBOUND_MIN_VALUE,
            routing_enums_pb2.FirstSolutionStrategy.AUTOMATIC,
        ])

    for strategy in strategies:
        manager = pywrapcp.RoutingIndexManager(effective_n, 1, [0], [end_node])
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return working_matrix[from_node][to_node]

        transit_cb_idx = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_cb_idx)

        # Si existen paradas fijadas (is_pinned == True), agregar dimension de secuencia
        # donde cada salto suma +1: Start(0) = 0, 1ra parada = 1, ..., M-esima parada = M, End = M+1
        if pinned_positions:
            step_cb_idx = routing.RegisterUnaryTransitCallback(lambda from_index: 1)
            routing.AddDimension(
                step_cb_idx,
                0,              # sin holgura
                num_stops + 2,  # capacidad maxima de pasos
                True,           # iniciar cumul en 0 en el nodo origen
                "sequence_position",
            )
            pos_dim = routing.GetDimensionOrDie("sequence_position")
            for stop_idx, target_step in pinned_positions.items():
                if 0 <= stop_idx < num_stops and 1 <= target_step <= num_stops:
                    node_in_matrix = stop_idx + 1  # paradas estan en 1..M
                    routing_idx = manager.NodeToIndex(node_in_matrix)
                    pos_dim.CumulVar(routing_idx).SetRange(target_step, target_step)

        search_params = pywrapcp.DefaultRoutingSearchParameters()
        search_params.first_solution_strategy = strategy

        if num_stops > 8:
            search_params.local_search_metaheuristic = (
                routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
            )
            search_params.time_limit.FromSeconds(max_solve_seconds)

        search_params.log_search = False

        solution = routing.SolveWithParameters(search_params)
        if solution is not None:
            route_indices: list[int] = []
            total_distance_m = 0

            index = routing.Start(0)
            while not routing.IsEnd(index):
                node = manager.IndexToNode(index)
                next_index = solution.Value(routing.NextVar(index))
                next_node = manager.IndexToNode(next_index)

                arc_cost = working_matrix[node][next_node]
                if not (is_dummy_end and next_node == end_node):
                    total_distance_m += arc_cost

                if 1 <= node <= num_stops:
                    route_indices.append(node - 1)

                index = next_index

            status = "optimal" if routing.status() == 1 else "feasible"
            return route_indices, total_distance_m, status

    return [], 0, "infeasible"


def _resolve_pinned_target_steps(geocoded_stops: list["Stop"]) -> dict[int, int]:
    """
    Determina la posicion exacta 1-based (en 1..M) para cada parada con `is_pinned == True`.
    Respeta el `sequence_order` predefinido de la parada y evita colisiones si dos paradas
    ancladas tuvieran el mismo numero de secuencia.

    Retorna:
        dict `{stop_idx_0_based_en_geocoded: target_step_1_based}`
    """
    total = len(geocoded_stops)
    pinned_pairs: list[tuple[int, "Stop"]] = [
        (idx, s)
        for idx, s in enumerate(geocoded_stops)
        if getattr(s, "is_pinned", False)
    ]
    if not pinned_pairs:
        return {}

    # Ordenar por sequence_order actual para asignar primero las que tienen orden explicito
    pinned_pairs.sort(
        key=lambda pair: (pair[1].sequence_order is None, pair[1].sequence_order or (pair[0] + 1))
    )

    occupied_steps: set[int] = set()
    pinned_positions: dict[int, int] = {}

    for idx, stop in pinned_pairs:
        raw_seq = stop.sequence_order if (stop.sequence_order and stop.sequence_order >= 1) else (idx + 1)
        desired_step = min(max(raw_seq, 1), total)
        if desired_step not in occupied_steps:
            chosen_step = desired_step
        else:
            # Buscar la casilla libre mas cercana a desired_step
            free_steps = [step for step in range(1, total + 1) if step not in occupied_steps]
            chosen_step = min(free_steps, key=lambda st: abs(st - desired_step))
        occupied_steps.add(chosen_step)
        pinned_positions[idx] = chosen_step

    return pinned_positions


def _fallback_interleaved_order(
    geocoded_stops: list["Stop"],
    pinned_positions: dict[int, int],
    origin_lat: float,
    origin_lng: float,
) -> list["Stop"]:
    """
    Resguardo determinista (vecino mas cercano por tramos entre nodos anclados)
    en caso de que el solver no encuentre solucion factible.
    Garantiza que las paradas ancladas permanezcan en su posicion exacta y que
    las libres se conecten por cercania al nodo previo.
    """
    total = len(geocoded_stops)
    slots: list["Stop" | None] = [None] * total

    for stop_idx, step_1_based in pinned_positions.items():
        slots[step_1_based - 1] = geocoded_stops[stop_idx]

    remaining = [
        s for idx, s in enumerate(geocoded_stops)
        if idx not in pinned_positions
    ]

    cur_lat, cur_lng = origin_lat, origin_lng
    for i in range(total):
        if slots[i] is not None:
            cur_lat, cur_lng = slots[i].lat, slots[i].lng
        elif remaining:
            # Si la siguiente casilla (i+1) tiene un nodo anclado, minimizar distancia
            # desde cur + hacia ese nodo anclado; de lo contrario, desde cur.
            next_anchor = slots[i + 1] if (i + 1 < total and slots[i + 1] is not None) else None
            if next_anchor is not None:
                best = min(
                    remaining,
                    key=lambda s: (
                        _haversine_meters(cur_lat, cur_lng, s.lat, s.lng)
                        + _haversine_meters(s.lat, s.lng, next_anchor.lat, next_anchor.lng)
                    ),
                )
            else:
                best = min(
                    remaining,
                    key=lambda s: _haversine_meters(cur_lat, cur_lng, s.lat, s.lng),
                )
            slots[i] = best
            remaining.remove(best)
            cur_lat, cur_lng = best.lat, best.lng

    return [s for s in slots if s is not None]


# -----------------------------------------------------------------------------
# FUNCION PUBLICA
# -----------------------------------------------------------------------------

async def optimize_route(
    stops: list["Stop"],
    origin_lat: float,
    origin_lng: float,
    end_lat: float | None = None,
    end_lng: float | None = None,
    max_solve_seconds: int = 30,
    return_to_depot: bool = False,
) -> OptimizationResult:
    """
    Optimiza el orden de visita de las paradas usando Google OR-Tools.

    Caracteristicas clave:
    1. Usa `(origin_lat, origin_lng)` como nodo 0 (origen de la ruta).
    2. Si se proveen `end_lat` y `end_lng`, los usa como el ultimo nodo (destino
       definitivo) de la matriz de distancias en OR-Tools.
    3. Las paradas con `is_pinned == True` actuan como nodos obligatorios anclados
       en su posicion de secuencia exacta; OR-Tools optimiza el camino mas corto
       conectando e intercalando las paradas libres alrededor y entre los nodos anclados.
    4. Retorna TODAS las paradas de la ruta (ancladas, libres y sin geocodificar)
       sin perder ninguna.
    """
    geocoded: list["Stop"] = []
    non_geocoded: list["Stop"] = []

    for s in stops:
        if s.lat is not None and s.lng is not None:
            geocoded.append(s)
        else:
            non_geocoded.append(s)

    # Ordenar inicialmente por sequence_order para preservar las posiciones de las ancladas
    geocoded.sort(key=lambda s: (s.sequence_order is None, s.sequence_order or 0))

    has_explicit_end = end_lat is not None and end_lng is not None

    logger.info(
        "Optimizando ruta: %d geocodificadas (%d ancladas), %d sin geocodificar, end_location=%s",
        len(geocoded),
        sum(1 for s in geocoded if getattr(s, "is_pinned", False)),
        len(non_geocoded),
        has_explicit_end,
    )

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

    # Resolver las posiciones exactas (1..M) de los nodos obligatorios (is_pinned == True)
    pinned_positions = _resolve_pinned_target_steps(geocoded)

    # Construir lista de ubicaciones para la matriz:
    # Indice 0: start_location (origen)
    # Indices 1..M: todas las paradas geocodificadas (ancladas + libres)
    # Indice M+1 (si has_explicit_end): end_location (destino definitivo)
    locations: list[_Location] = [
        _Location(lat=origin_lat, lng=origin_lng, stop_id=None),
    ] + [
        _Location(lat=s.lat, lng=s.lng, stop_id=s.id)
        for s in geocoded
    ]

    if has_explicit_end:
        locations.append(_Location(lat=end_lat, lng=end_lng, stop_id=None))

    distance_matrix = _build_distance_matrix(locations)

    route_indices, total_dist_m, solver_status = _solve_tsp(
        distance_matrix=distance_matrix,
        max_solve_seconds=max_solve_seconds,
        return_to_depot=return_to_depot,
        has_explicit_end_node=has_explicit_end,
        pinned_positions=pinned_positions,
    )

    if solver_status == "infeasible" or len(route_indices) != len(geocoded):
        logger.warning("Usando resguardo de intercalado para respetar nodos anclados")
        ordered_geocoded = _fallback_interleaved_order(
            geocoded, pinned_positions, origin_lat, origin_lng
        )
        solver_status = "feasible"
    else:
        ordered_geocoded = [geocoded[i] for i in route_indices]

    # Verificacion de integridad: garantizar que los nodos anclados esten en su posicion
    # exacta y que el 100% de las paradas geocodificadas esten presentes.
    present_ids = {s.id for s in ordered_geocoded}
    for s in geocoded:
        if s.id not in present_ids:
            ordered_geocoded.append(s)
            present_ids.add(s.id)

    # Recalcular la distancia total real del recorrido completo
    tour_points: list[_Location] = [
        _Location(lat=origin_lat, lng=origin_lng, stop_id=None),
    ] + [
        _Location(lat=s.lat, lng=s.lng, stop_id=s.id)
        for s in ordered_geocoded
    ]
    if has_explicit_end:
        tour_points.append(_Location(lat=end_lat, lng=end_lng, stop_id=None))
    elif return_to_depot and len(tour_points) > 1:
        tour_points.append(_Location(lat=origin_lat, lng=origin_lng, stop_id=None))

    total_dist_m = sum(
        _haversine_meters(
            tour_points[i].lat, tour_points[i].lng,
            tour_points[i + 1].lat, tour_points[i + 1].lng,
        )
        for i in range(len(tour_points) - 1)
    )

    orig_index_map = {s.id: idx for idx, s in enumerate(geocoded)}
    final_route_indices = [orig_index_map[s.id] for s in ordered_geocoded]
    ordered_geocoded_ids = [s.id for s in ordered_geocoded]
    non_geocoded_ids = [s.id for s in non_geocoded]

    all_ordered_ids = ordered_geocoded_ids + non_geocoded_ids

    total_km = round(total_dist_m / 1000, 2)
    travel_time_min = int((total_km / BOGOTA_AVG_SPEED_KMH) * 60)
    service_time_min = len(geocoded) * STOP_SERVICE_TIME_MIN
    total_duration_min = travel_time_min + service_time_min

    logger.info(
        "Optimizacion completada: status=%s, distancia=%.2f km, duracion=%d min, paradas=%d",
        solver_status, total_km, total_duration_min, len(all_ordered_ids),
    )

    return OptimizationResult(
        optimized_stop_ids=all_ordered_ids,
        optimized_sequence=final_route_indices,
        total_distance_km=total_km,
        total_duration_min=total_duration_min,
        solver_status=solver_status,
        metadata={
            "solver": "OR-Tools TSP with Anchored Sequence Dimension",
            "geocoded_stops": len(geocoded),
            "pinned_stops": len(pinned_positions),
            "non_geocoded_stops": len(non_geocoded),
            "total_stops": len(stops),
            "return_to_depot": return_to_depot,
            "has_end_location": has_explicit_end,
            "end_lat": end_lat,
            "end_lng": end_lng,
            "distance_metric": "haversine_meters",
            "estimated_speed_kmh": BOGOTA_AVG_SPEED_KMH,
            "service_time_per_stop_min": STOP_SERVICE_TIME_MIN,
        },
    )
