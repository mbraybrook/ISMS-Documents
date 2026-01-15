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
  risk_count: number;
  risk_levels: {
    inherent: { LOW: number; MEDIUM: number; HIGH: number };
    residual: { LOW: number; MEDIUM: number; HIGH: number };
  };
  heatmap: Array<{ likelihood: number; impact: number; count: number }>;
  by_department: Record<string, { inherent: { LOW: number; MEDIUM: number; HIGH: number }; residual: { LOW: number; MEDIUM: number; HIGH: number } }>;
  by_category: Record<string, { inherent: { LOW: number; MEDIUM: number; HIGH: number }; residual: { LOW: number; MEDIUM: number; HIGH: number } }>;
  treatment_actions: {
    total: number;
    open: number;
    in_progress: number;
    completed: number;
    overdue: number;
    completion_rate: number;
    effectiveness: Record<string, number>;
    overdue_items: Array<{
      id: string;
      title: string;
      riskId: string;
      riskTitle: string;
      ownerName: string | null;
      dueDate: string | null;
    }>;
  };
  acceptance: {
    accepted_count: number;
    accepted_above_appetite_count: number;
    average_age_days: number | null;
    oldest_age_days: number | null;
    accepted_above_appetite: Array<{
      id: string;
      title: string;
      residualScore: number;
      appetiteThreshold: number;
      acceptedAt: string;
      ownerName: string | null;
    }>;
  };
  reviews: {
    overdue_count: number;
    upcoming_count: number;
    overdue: Array<{
      id: string;
      title: string;
      nextReviewDate: string;
      ownerName: string | null;
    }>;
    upcoming: Array<{
      id: string;
      title: string;
      nextReviewDate: string;
      ownerName: string | null;
    }>;
  };
  nonconformance: {
    policy_nonconformance_count: number;
    missing_mitigation_count: number;
    missing_mitigation: Array<{
      id: string;
      title: string;
      calculatedScore: number;
      mitigationImplemented: boolean;
    }>;
  };
}

export interface RiskDashboardFilters {
  department?: string;
  riskCategory?: string;
  ownerUserId?: string;
  status?: string;
}








