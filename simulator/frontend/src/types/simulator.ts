export type ArchitectureId =
  | 'MONO_MVP'
  | 'MONO_ASYNC_CONTAINER'
  | 'MICRO_DOCKER'
  | 'HYBRID_EDGE_SERVERLESS';

export type CriterionKey =
  | 'latency'
  | 'throughput'
  | 'scalability'
  | 'availability'
  | 'cost'
  | 'security';

export interface DecisionWeights {
  latency: number;
  throughput: number;
  scalability: number;
  availability: number;
  cost: number;
  security: number;
}

export interface ProjectConfig {
  project_name: string;
  project_domain: string;
  target_users_description: string;
  expected_users: number;
  max_budget_usd: number;
  max_latency_ms: number;
  min_availability_pct: number;
  team_size: number;
  require_encryption: boolean;
  weights: DecisionWeights;
}

export interface SimulationInput {
  concurrent_drivers: number;
  ocr_guides_per_driver: number;
  stops_per_route: number;
  compute_instances: number;
  crud_ops_per_min: number;
}

export interface ArchitectureSpec {
  id: ArchitectureId;
  name: string;
  short_name: string;
  subtitle: string;
  description: string;
  enruta_mapping: string;
  paper_references: string[];
  mu_0: number;
  eta: number;
  beta_coord: number;
  theta_cloud_ocr: number;
  c_crud: number;
  c_ocr: number;
  c_tsp: number;
  l_base: number;
  l_ipc_base: number;
  l_ipc_per_inst: number;
  tau_crud: number;
  tau_ocr: number;
  tau_tsp_base: number;
  alpha_tsp: number;
  has_serverless_cold_start: boolean;
  a_0: number;
  m_max_avail_nodes: number;
  delta_spof: number;
  infra_unit_cost: number;
  gateway_fixed_cost: number;
  ocr_api_unit_cost: number;
  is_serverless_pay_per_use: boolean;
  containers_per_instance: number;
  base_ram_mb: number;
  ram_per_inst_mb: number;
  cpu_overhead_pct: number;
  isolation_factor: number;
  security_base: number;
  devops_complexity: number;
  advantages: string[];
  limitations: string[];
  assumptions: string[];
  docker_topology_summary: string;
  sample_compose_snippet: string;
}

export interface FormulaBreakdown {
  demand_units: number;
  capacity_units: number;
  utilization_pct: number;
  phi_tsp: number;
  ipc_ms: number;
  cold_start_ms: number;
  weighted_service_ms: number;
  queue_multiplier: number;
  over_scale_factor: number;
  lambda_crud: number;
  lambda_ocr_raw: number;
  lambda_ocr_cloud: number;
  lambda_tsp: number;
  total_client_req_s: number;
  backend_req_s: number;
  tau_tsp_ms: number;
  saturation_penalty_ms: number;
}

export interface ArchitectureMetrics {
  id: ArchitectureId;
  name: string;
  short_name: string;
  subtitle: string;
  latency_ms: number;
  throughput_req_s: number;
  max_capacity_req_s: number;
  error_rate_pct: number;
  scalability_score: number;
  availability_pct: number;
  monthly_cost_usd: number;
  active_containers: number;
  cpu_usage_pct: number;
  ram_usage_mb: number;
  security_score: number;
  team_operability_score: number;
  utilization: number;
  utilization_pct: number;
  formula_breakdown: FormulaBreakdown;
  is_pareto_efficient: boolean;
  meets_budget: boolean;
  meets_latency: boolean;
  meets_availability: boolean;
  meets_capacity: boolean;
  meets_all_constraints: boolean;
  raw_score: number;
  total_penalty: number;
  final_score: number;
  rank: number;
  normalized_utilities: Record<CriterionKey, number>;
  penalties_breakdown: {
    budget: number;
    latency: number;
    availability: number;
    capacity: number;
  };
  architecture_id: ArchitectureId;
  architecture_name: string;
}

export interface DominatorDetail {
  dominator_id: ArchitectureId;
  dominator_name: string;
  cost_delta_usd: number;
  latency_delta_ms: number;
  availability_delta_pct: number;
}

export interface ParetoFrontierInfo {
  objectives: string[];
  efficient_ids: ArchitectureId[];
  dominated_by: Record<string, DominatorDetail[]>;
}

export interface RejectedAlternative {
  id: ArchitectureId;
  architecture_id: ArchitectureId;
  name: string;
  short_name: string;
  rank: number;
  final_score: number;
  raw_score: number;
  total_penalty: number;
  meets_all_constraints: boolean;
  violated_constraints: string[];
  is_pareto_efficient: boolean;
  reason: string;
}

export interface ExplainableRecommendation {
  winner_id: ArchitectureId;
  winner_name: string;
  winner_short_name: string;
  winner_score: number;
  all_constraints_met: boolean;
  summary_rationale: string;
  detailed_reasons: string[];
  rejected_alternatives: RejectedAlternative[];
  advantages: string[];
  limitations: string[];
  assumptions: string[];
  model_disclaimer: string;
  real_world_validation_steps: string[];
}

export interface SweepPointSummary {
  id: ArchitectureId;
  name: string;
  short_name: string;
  latency_ms: number;
  throughput_req_s: number;
  max_capacity_req_s: number;
  error_rate_pct: number;
  scalability_score: number;
  availability_pct: number;
  monthly_cost_usd: number;
  utilization_pct: number;
  cpu_usage_pct: number;
  ram_usage_mb: number;
  active_containers: number;
  over_scale_factor?: number;
  ipc_ms?: number;
  capacity_units?: number;
}

export interface DriverSweepEntry {
  concurrent_drivers: number;
  architectures: Record<ArchitectureId, SweepPointSummary>;
  metrics: ArchitectureMetrics[];
}

export interface InstanceSweepEntry {
  compute_instances: number;
  architectures: Record<ArchitectureId, SweepPointSummary>;
  metrics: ArchitectureMetrics[];
}

export interface SimulationResult {
  sim_input: SimulationInput;
  project_config: ProjectConfig;
  normalized_weights: Record<CriterionKey, number>;
  architectures: ArchitectureMetrics[];
  ranking: ArchitectureMetrics[];
  pareto_frontier: ParetoFrontierInfo;
  pareto_efficient_ids: ArchitectureId[];
  recommendation: ExplainableRecommendation;
  driver_sweep: DriverSweepEntry[];
  instance_sweep: InstanceSweepEntry[];
}

export interface ScenarioPreset {
  id: string;
  name: string;
  short_name: string;
  category: 'reference' | 'execution';
  is_reference: boolean;
  description: string;
  bogota_context: string;
  sim_input: SimulationInput;
  project_config_overrides: Partial<Omit<ProjectConfig, 'weights'>> & {
    weights?: Partial<DecisionWeights>;
  };
  expected_insight: string;
  expected_winner_id: ArchitectureId;
  paper_focus: string;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export type EngineSource = 'docker-fastapi' | 'local-ts';
