"""
Análisis de Optimalidad de Pareto multiobjetivo para el Simulador Arquitectónico de EnRuta.

Evalúa la no-dominancia simultánea sobre el espacio tridimensional crítico de arquitectura:
  - Minimizar Costo Mensual Estimado (`monthly_cost_usd`)
  - Minimizar Latencia Estimada extremo a extremo (`latency_ms`)
  - Maximizar Disponibilidad Efectiva (`availability_pct`)
"""

from __future__ import annotations

from typing import Any, TypeVar

from .math_model import ArchitectureMetrics

TMetrics = TypeVar("TMetrics", ArchitectureMetrics, dict[str, Any])


def _read_metric(item: ArchitectureMetrics | dict[str, Any], field_name: str) -> float:
    """Lee un atributo numérico tanto desde `ArchitectureMetrics` como desde un `dict`."""
    if isinstance(item, dict):
        return float(item[field_name])
    return float(getattr(item, field_name))


def _read_id(item: ArchitectureMetrics | dict[str, Any]) -> str:
    """Obtiene el identificador de la arquitectura desde instancia o diccionario."""
    if isinstance(item, dict):
        return str(item.get("id") or item.get("architecture_id") or "")
    return str(getattr(item, "id", ""))


def _read_name(item: ArchitectureMetrics | dict[str, Any]) -> str:
    """Obtiene el nombre legible de la arquitectura desde instancia o diccionario."""
    if isinstance(item, dict):
        return str(item.get("short_name") or item.get("name") or _read_id(item))
    return str(getattr(item, "short_name", "") or getattr(item, "name", ""))


def _write_pareto_flag(item: ArchitectureMetrics | dict[str, Any], is_efficient: bool) -> None:
    """Actualiza el indicador `is_pareto_efficient` en el objeto evaluado."""
    if isinstance(item, dict):
        item["is_pareto_efficient"] = is_efficient
    else:
        item.is_pareto_efficient = is_efficient


def is_dominated_by(
    candidate_j: ArchitectureMetrics | dict[str, Any],
    target_k: ArchitectureMetrics | dict[str, Any],
) -> bool:
    """
    Retorna `True` si la arquitectura `candidate_j` domina en sentido de Pareto a `target_k`:
      - `monthly_cost_usd_j <= monthly_cost_usd_k`
      - `latency_ms_j <= latency_ms_k`
      - `availability_pct_j >= availability_pct_k`
      - Con al menos una desigualdad estricta entre los tres criterios.
    """
    cost_j = _read_metric(candidate_j, "monthly_cost_usd")
    cost_k = _read_metric(target_k, "monthly_cost_usd")

    lat_j = _read_metric(candidate_j, "latency_ms")
    lat_k = _read_metric(target_k, "latency_ms")

    avail_j = _read_metric(candidate_j, "availability_pct")
    avail_k = _read_metric(target_k, "availability_pct")

    no_worse_in_all = (cost_j <= cost_k) and (lat_j <= lat_k) and (avail_j >= avail_k)
    strictly_better_in_at_least_one = (
        (cost_j < cost_k) or (lat_j < lat_k) or (avail_j > avail_k)
    )
    return no_worse_in_all and strictly_better_in_at_least_one


def compute_pareto_frontier(metrics_list: list[TMetrics]) -> list[TMetrics]:
    """
    Marca `is_pareto_efficient = False` en la arquitectura `k` si existe otra
    arquitectura `j != k` que la domine en `(monthly_cost_usd, latency_ms, availability_pct)`.
    En caso contrario marca `is_pareto_efficient = True`.

    Modifica los elementos in-place y retorna `metrics_list`.
    """
    total = len(metrics_list)
    for k in range(total):
        target_k = metrics_list[k]
        dominated = False
        for j in range(total):
            if j == k:
                continue
            if is_dominated_by(metrics_list[j], target_k):
                dominated = True
                break
        _write_pareto_flag(target_k, not dominated)

    return metrics_list


def get_pareto_analysis(
    metrics_list: list[ArchitectureMetrics | dict[str, Any]],
) -> dict[str, Any]:
    """
    Construye un resumen explicable de la frontera de Pareto indicando qué arquitecturas
    son eficientes y qué alternativas dominan explícitamente a las descartadas por Pareto.
    """
    compute_pareto_frontier(metrics_list)
    efficient_ids: list[str] = []
    dominated_details: dict[str, list[dict[str, Any]]] = {}

    total = len(metrics_list)
    for k in range(total):
        target_k = metrics_list[k]
        arch_id_k = _read_id(target_k)
        dominators: list[dict[str, Any]] = []

        for j in range(total):
            if j == k:
                continue
            cand_j = metrics_list[j]
            if is_dominated_by(cand_j, target_k):
                dominators.append(
                    {
                        "dominator_id": _read_id(cand_j),
                        "dominator_name": _read_name(cand_j),
                        "cost_delta_usd": round(
                            _read_metric(target_k, "monthly_cost_usd")
                            - _read_metric(cand_j, "monthly_cost_usd"),
                            2,
                        ),
                        "latency_delta_ms": round(
                            _read_metric(target_k, "latency_ms")
                            - _read_metric(cand_j, "latency_ms"),
                            2,
                        ),
                        "availability_delta_pct": round(
                            _read_metric(cand_j, "availability_pct")
                            - _read_metric(target_k, "availability_pct"),
                            3,
                        ),
                    }
                )

        if not dominators:
            efficient_ids.append(arch_id_k)
        else:
            dominated_details[arch_id_k] = dominators

    return {
        "objectives": [
            "min(monthly_cost_usd)",
            "min(latency_ms)",
            "max(availability_pct)",
        ],
        "efficient_ids": efficient_ids,
        "dominated_by": dominated_details,
    }


__all__ = [
    "compute_pareto_frontier",
    "get_pareto_analysis",
    "is_dominated_by",
]
