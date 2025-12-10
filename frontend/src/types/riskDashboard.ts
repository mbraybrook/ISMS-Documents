export interface QuarterlyDataPoint {
  year: number;
  quarter: number;
  total_risk_score: number;
  implemented_mitigation_score: number;
  non_implemented_mitigation_score: number;
  no_mitigation_score: number;
  risk_score_delta: number;
}

export interface LatestSnapshot {
  total_risk_score: number;
  implemented_mitigation_score: number;
  non_implemented_mitigation_score: number;
  no_mitigation_score: number;
  risk_score_delta: number;
}

export interface RiskDashboardSummary {
  latest_snapshot: LatestSnapshot;
  quarterly_series: QuarterlyDataPoint[];
}


