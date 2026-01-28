import { prisma } from '../lib/prisma';
import { getRiskLevel, hasPolicyNonConformance } from './riskService';

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
  implemented_mitigation_count: number;
  non_implemented_mitigation_score: number;
  non_implemented_mitigation_count: number;
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
      dueDate: Date | null;
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
      acceptedAt: Date;
      ownerName: string | null;
    }>;
  };
  reviews: {
    overdue_count: number;
    upcoming_count: number;
    overdue: Array<{
      id: string;
      title: string;
      nextReviewDate: Date;
      ownerName: string | null;
    }>;
    upcoming: Array<{
      id: string;
      title: string;
      nextReviewDate: Date;
      ownerName: string | null;
    }>;
  };
  nonconformance: {
    policy_nonconformance_count: number;
    policy_nonconformance_score: number;
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

/**
 * Get quarter number (1-4) from a date
 */
function getQuarter(date: Date): number {
  const month = date.getMonth(); // 0-11
  return Math.floor(month / 3) + 1;
}

/**
 * Aggregate risk data by quarter
 * Groups risks by year and quarter based on dateAdded field
 */
export async function getRiskDashboardSummary(): Promise<RiskDashboardSummary> {
  return getRiskDashboardSummaryWithFilters({});
}

export async function getRiskDashboardSummaryWithFilters(
  filters: RiskDashboardFilters
): Promise<RiskDashboardSummary> {
  const now = new Date();
  const baseWhere: {
    OR: Array<{ archived: boolean; archivedDate?: { gt: Date } | null }>;
    departmentId?: string;
    riskCategory?: string;
    ownerUserId?: string;
    status?: string;
  } = {
    OR: [
      { archived: false },
      { archived: true, archivedDate: null },
      { archived: true, archivedDate: { gt: now } },
    ],
  };

  if (filters.department) {
    // Support both departmentId (UUID) and department name (legacy)
    // Check if it's a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.department)) {
      baseWhere.departmentId = filters.department;
    } else {
      // Legacy: department name - need to look up ID
      const dept = await prisma.department.findUnique({
        where: { name: filters.department },
      });
      if (dept) {
        baseWhere.departmentId = dept.id;
      } else {
        // Department not found - return empty results
        baseWhere.departmentId = '00000000-0000-0000-0000-000000000000';
      }
    }
  }
  if (filters.riskCategory) {
    baseWhere.riskCategory = filters.riskCategory;
  }
  if (filters.ownerUserId) {
    baseWhere.ownerUserId = filters.ownerUserId;
  }
  if (filters.status) {
    baseWhere.status = filters.status;
  }

  const risks = await prisma.risk.findMany({
    where: baseWhere,
    select: {
      id: true,
      title: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      riskCategory: true,
      status: true,
      dateAdded: true,
      createdAt: true,
      archived: true,
      archivedDate: true,
      calculatedScore: true,
      mitigatedScore: true,
      mitigationImplemented: true,
      confidentialityScore: true,
      integrityScore: true,
      availabilityScore: true,
      mitigatedConfidentialityScore: true,
      mitigatedIntegrityScore: true,
      mitigatedAvailabilityScore: true,
      mitigatedLikelihood: true,
      likelihood: true,
      nextReviewDate: true,
      acceptedAt: true,
      appetiteThreshold: true,
      mitigationDescription: true,
      initialRiskTreatmentCategory: true,
      owner: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  // Calculate current snapshot from all risks (fallback if no quarterly data)
  const currentSnapshot: LatestSnapshot = {
    total_risk_score: 0,
    implemented_mitigation_score: 0,
    implemented_mitigation_count: 0,
    non_implemented_mitigation_score: 0,
    non_implemented_mitigation_count: 0,
    no_mitigation_score: 0,
    risk_score_delta: 0,
  };

  // Filter risks for current snapshot: exclude archived risks with archive date in the past
  const currentRisks = risks.filter((risk: {
    archived: boolean;
    archivedDate: Date | null;
  }) => {
    if (!risk.archived) return true;
    if (risk.archivedDate === null) return true; // Backward compatibility
    return risk.archivedDate > now;
  });

  currentRisks.forEach((risk) => {
    currentSnapshot.total_risk_score += risk.calculatedScore;

    if (risk.mitigatedScore !== null) {
      if (risk.mitigationImplemented) {
        currentSnapshot.implemented_mitigation_score += risk.mitigatedScore;
        currentSnapshot.implemented_mitigation_count += 1;
      } else {
        currentSnapshot.non_implemented_mitigation_score += risk.mitigatedScore;
        currentSnapshot.non_implemented_mitigation_count += 1;
      }
    } else {
      currentSnapshot.no_mitigation_score += risk.calculatedScore;
    }
  });

  currentSnapshot.risk_score_delta = currentSnapshot.total_risk_score - currentSnapshot.implemented_mitigation_score;

  // Group risks by year and quarter
  const quarterlyMap = new Map<string, {
    year: number;
    quarter: number;
    risks: Array<{
      calculatedScore: number;
      mitigatedScore: number | null;
      mitigationImplemented: boolean;
    }>;
  }>();

  risks.forEach((risk) => {
    // Handle missing dateAdded by using createdAt or current date
    let dateToUse: Date;
    if (risk.dateAdded) {
      dateToUse = new Date(risk.dateAdded);
    } else if (risk.createdAt) {
      dateToUse = new Date(risk.createdAt);
    } else {
      dateToUse = new Date(); // Fallback to current date
    }

    const year = dateToUse.getFullYear();
    const quarter = getQuarter(dateToUse);
    const key = `${year}-Q${quarter}`;

    // Calculate end of quarter date
    const endOfQuarterMonth = (quarter - 1) * 3 + 2; // Last month of quarter (0-indexed: 2, 5, 8, 11)
    const endOfQuarter = new Date(year, endOfQuarterMonth + 1, 0, 23, 59, 59, 999); // Last moment of last day of quarter

    // Include risk in quarter if:
    // - Risk is not archived, OR
    // - Risk is archived but archivedDate is null (backward compat), OR
    // - Risk is archived but archivedDate is after the end of this quarter
    const shouldIncludeInQuarter = 
      !risk.archived || 
      risk.archivedDate === null || 
      (risk.archivedDate && risk.archivedDate > endOfQuarter);

    if (shouldIncludeInQuarter) {
      if (!quarterlyMap.has(key)) {
        quarterlyMap.set(key, {
          year,
          quarter,
          risks: [],
        });
      }

      quarterlyMap.get(key)!.risks.push({
        calculatedScore: risk.calculatedScore,
        mitigatedScore: risk.mitigatedScore,
        mitigationImplemented: risk.mitigationImplemented,
      });
    }
  });

  // Calculate metrics for each quarter
  const quarterlySeries: QuarterlyDataPoint[] = [];

  quarterlyMap.forEach((quarterData) => {
    let total_risk_score = 0;
    let implemented_mitigation_score = 0;
    let non_implemented_mitigation_score = 0;
    let no_mitigation_score = 0;

    quarterData.risks.forEach((risk) => {
      total_risk_score += risk.calculatedScore;

      if (risk.mitigatedScore !== null) {
        if (risk.mitigationImplemented) {
          implemented_mitigation_score += risk.mitigatedScore;
        } else {
          non_implemented_mitigation_score += risk.mitigatedScore;
        }
      } else {
        no_mitigation_score += risk.calculatedScore;
      }
    });

    const risk_score_delta = total_risk_score - implemented_mitigation_score;

    quarterlySeries.push({
      year: quarterData.year,
      quarter: quarterData.quarter,
      total_risk_score,
      implemented_mitigation_score,
      non_implemented_mitigation_score,
      no_mitigation_score,
      risk_score_delta,
    });
  });

  // Sort by year and quarter (ascending)
  quarterlySeries.sort((a, b) => {
    if (a.year !== b.year) {
      return a.year - b.year;
    }
    return a.quarter - b.quarter;
  });

  // Get latest snapshot (most recent quarter, or use current snapshot if no quarterly data)
  // Note: For counts, we always use current snapshot since quarterly data doesn't track counts
  let latest_snapshot: LatestSnapshot;
  if (quarterlySeries.length > 0) {
    const latest = quarterlySeries[quarterlySeries.length - 1];
    latest_snapshot = {
      total_risk_score: latest.total_risk_score,
      implemented_mitigation_score: latest.implemented_mitigation_score,
      implemented_mitigation_count: currentSnapshot.implemented_mitigation_count,
      non_implemented_mitigation_score: latest.non_implemented_mitigation_score,
      non_implemented_mitigation_count: currentSnapshot.non_implemented_mitigation_count,
      no_mitigation_score: latest.no_mitigation_score,
      risk_score_delta: latest.risk_score_delta,
    };
  } else {
    // No quarterly data - use current snapshot from all risks
    latest_snapshot = currentSnapshot;
  }

  const baseLevel = (): { LOW: number; MEDIUM: number; HIGH: number } => ({
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
  });

  const inherentLevels = baseLevel();
  const residualLevels = baseLevel();
  const by_department: Record<string, { inherent: { LOW: number; MEDIUM: number; HIGH: number }; residual: { LOW: number; MEDIUM: number; HIGH: number } }> = {};
  const by_category: Record<string, { inherent: { LOW: number; MEDIUM: number; HIGH: number }; residual: { LOW: number; MEDIUM: number; HIGH: number } }> = {};
  const heatmap = new Map<string, { likelihood: number; impact: number; count: number }>();

  const missingMitigation: Array<{
    id: string;
    title: string;
    calculatedScore: number;
    mitigationImplemented: boolean;
  }> = [];

  const acceptedAboveAppetite: Array<{
    id: string;
    title: string;
    residualScore: number;
    appetiteThreshold: number;
    acceptedAt: Date;
    ownerName: string | null;
  }> = [];

  const reviewOverdue: Array<{ id: string; title: string; nextReviewDate: Date; ownerName: string | null }> = [];
  const reviewUpcoming: Array<{ id: string; title: string; nextReviewDate: Date; ownerName: string | null }> = [];

  let policyNonConformanceCount = 0;
  let policyNonConformanceScore = 0;

  currentRisks.forEach((risk) => {
    const inherentLevel = getRiskLevel(risk.calculatedScore);
    inherentLevels[inherentLevel]++;

    const residualScore = risk.mitigatedScore !== null ? risk.mitigatedScore : risk.calculatedScore;
    const residualLevel = getRiskLevel(residualScore);
    residualLevels[residualLevel]++;

    const departmentKey = risk.department?.name || (risk.departmentId || 'UNASSIGNED');
    if (!by_department[departmentKey]) {
      by_department[departmentKey] = { inherent: baseLevel(), residual: baseLevel() };
    }
    by_department[departmentKey].inherent[inherentLevel]++;
    by_department[departmentKey].residual[residualLevel]++;

    const categoryKey = risk.riskCategory || 'UNCATEGORIZED';
    if (!by_category[categoryKey]) {
      by_category[categoryKey] = { inherent: baseLevel(), residual: baseLevel() };
    }
    by_category[categoryKey].inherent[inherentLevel]++;
    by_category[categoryKey].residual[residualLevel]++;

    const confidentiality = risk.confidentialityScore ?? 1;
    const integrity = risk.integrityScore ?? 1;
    const availability = risk.availabilityScore ?? 1;
    const likelihood = risk.likelihood ?? 1;
    // Impact = sum of CIA scores (3-15), mapped to 1-5 scale for heatmap display
    const impactSum = confidentiality + integrity + availability; // Range: 3-15
    // Map sum (3-15) to display scale (1-5): 3-5=1, 6-8=2, 9-11=3, 12-14=4, 15=5
    const impact = Math.ceil(impactSum / 3);
    const heatmapKey = `${likelihood}-${impact}`;
    const existing = heatmap.get(heatmapKey);
    if (existing) {
      existing.count += 1;
    } else {
      heatmap.set(heatmapKey, { likelihood, impact, count: 1 });
    }

    if (!risk.mitigationImplemented && !risk.mitigationDescription) {
      missingMitigation.push({
        id: risk.id,
        title: risk.title,
        calculatedScore: risk.calculatedScore,
        mitigationImplemented: risk.mitigationImplemented,
      });
    }

    const hasNonConformance = hasPolicyNonConformance({
      initialRiskTreatmentCategory: risk.initialRiskTreatmentCategory,
      calculatedScore: risk.calculatedScore,
      mitigatedConfidentialityScore: risk.mitigatedConfidentialityScore,
      mitigatedIntegrityScore: risk.mitigatedIntegrityScore,
      mitigatedAvailabilityScore: risk.mitigatedAvailabilityScore,
      mitigatedLikelihood: risk.mitigatedLikelihood,
      mitigatedScore: risk.mitigatedScore,
      mitigationDescription: risk.mitigationDescription,
    });
    if (hasNonConformance) {
      policyNonConformanceCount++;
      policyNonConformanceScore += risk.calculatedScore;
    }

    if (risk.acceptedAt && risk.appetiteThreshold !== null) {
      if (residualScore > risk.appetiteThreshold) {
        acceptedAboveAppetite.push({
          id: risk.id,
          title: risk.title,
          residualScore,
          appetiteThreshold: risk.appetiteThreshold,
          acceptedAt: risk.acceptedAt,
          ownerName: risk.owner?.displayName || null,
        });
      }
    }

    if (risk.nextReviewDate) {
      if (risk.nextReviewDate < now) {
        reviewOverdue.push({
          id: risk.id,
          title: risk.title,
          nextReviewDate: risk.nextReviewDate,
          ownerName: risk.owner?.displayName || null,
        });
      } else {
        const thirtyDaysFromNow = new Date(now);
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        if (risk.nextReviewDate <= thirtyDaysFromNow) {
          reviewUpcoming.push({
            id: risk.id,
            title: risk.title,
            nextReviewDate: risk.nextReviewDate,
            ownerName: risk.owner?.displayName || null,
          });
        }
      }
    }
  });

  const actions = await prisma.riskTreatmentAction.findMany({
    where: risks.length > 0 ? { riskId: { in: risks.map((risk) => risk.id) } } : { riskId: { in: [] } },
    select: {
      id: true,
      title: true,
      riskId: true,
      dueDate: true,
      status: true,
      effectivenessScore: true,
      completedAt: true,
      risk: {
        select: {
          title: true,
        },
      },
      owner: {
        select: {
          displayName: true,
        },
      },
    },
  });

  let open = 0;
  let in_progress = 0;
  let completed = 0;
  let overdue = 0;
  const effectiveness: Record<string, number> = {};
  const overdue_items: Array<{
    id: string;
    title: string;
    riskId: string;
    riskTitle: string;
    ownerName: string | null;
    dueDate: Date | null;
  }> = [];

  actions.forEach((action) => {
    const status = action.status;
    if (status === 'COMPLETED') {
      completed++;
    } else if (status === 'IN_PROGRESS') {
      in_progress++;
    } else {
      open++;
    }

    if (action.dueDate && action.dueDate < now && status !== 'COMPLETED') {
      overdue++;
      overdue_items.push({
        id: action.id,
        title: action.title,
        riskId: action.riskId,
        riskTitle: action.risk.title,
        ownerName: action.owner?.displayName || null,
        dueDate: action.dueDate,
      });
    }

    const scoreKey = action.effectivenessScore ? String(action.effectivenessScore) : 'unrated';
    effectiveness[scoreKey] = (effectiveness[scoreKey] || 0) + 1;
  });

  const acceptedRisks = currentRisks.filter((risk) => risk.acceptedAt);
  const acceptanceAges = acceptedRisks.map((risk) => {
    const acceptedAt = risk.acceptedAt as Date;
    const diffMs = now.getTime() - acceptedAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  });

  const averageAgeDays = acceptanceAges.length > 0
    ? Math.round(acceptanceAges.reduce((sum, value) => sum + value, 0) / acceptanceAges.length)
    : null;
  const oldestAgeDays = acceptanceAges.length > 0 ? Math.max(...acceptanceAges) : null;

  return {
    latest_snapshot,
    quarterly_series: quarterlySeries,
    risk_count: currentRisks.length,
    risk_levels: {
      inherent: inherentLevels,
      residual: residualLevels,
    },
    heatmap: Array.from(heatmap.values()),
    by_department,
    by_category,
    treatment_actions: {
      total: actions.length,
      open,
      in_progress,
      completed,
      overdue,
      completion_rate: actions.length > 0 ? Math.round((completed / actions.length) * 100) : 0,
      effectiveness,
      overdue_items: overdue_items.slice(0, 20),
    },
    acceptance: {
      accepted_count: acceptedRisks.length,
      accepted_above_appetite_count: acceptedAboveAppetite.length,
      average_age_days: averageAgeDays,
      oldest_age_days: oldestAgeDays,
      accepted_above_appetite: acceptedAboveAppetite.slice(0, 20),
    },
    reviews: {
      overdue_count: reviewOverdue.length,
      upcoming_count: reviewUpcoming.length,
      overdue: reviewOverdue.slice(0, 20),
      upcoming: reviewUpcoming.slice(0, 20),
    },
    nonconformance: {
      policy_nonconformance_count: policyNonConformanceCount,
      policy_nonconformance_score: policyNonConformanceScore,
      missing_mitigation_count: missingMitigation.length,
      missing_mitigation: missingMitigation.slice(0, 20),
    },
  };
}

