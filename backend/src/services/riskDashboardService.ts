import { prisma } from '../lib/prisma';

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
  // Get all non-archived risks with necessary fields
  const risks = await prisma.risk.findMany({
    where: {
      archived: false,
    },
    select: {
      dateAdded: true,
      createdAt: true,
      calculatedScore: true,
      mitigatedScore: true,
      mitigationImplemented: true,
    },
  });

  // Calculate current snapshot from all risks (fallback if no quarterly data)
  const currentSnapshot: LatestSnapshot = {
    total_risk_score: 0,
    implemented_mitigation_score: 0,
    non_implemented_mitigation_score: 0,
    no_mitigation_score: 0,
    risk_score_delta: 0,
  };

  risks.forEach((risk) => {
    currentSnapshot.total_risk_score += risk.calculatedScore;

    if (risk.mitigatedScore !== null) {
      if (risk.mitigationImplemented) {
        currentSnapshot.implemented_mitigation_score += risk.mitigatedScore;
      } else {
        currentSnapshot.non_implemented_mitigation_score += risk.mitigatedScore;
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
  let latest_snapshot: LatestSnapshot;
  if (quarterlySeries.length > 0) {
    const latest = quarterlySeries[quarterlySeries.length - 1];
    latest_snapshot = {
      total_risk_score: latest.total_risk_score,
      implemented_mitigation_score: latest.implemented_mitigation_score,
      non_implemented_mitigation_score: latest.non_implemented_mitigation_score,
      no_mitigation_score: latest.no_mitigation_score,
      risk_score_delta: latest.risk_score_delta,
    };
  } else {
    // No quarterly data - use current snapshot from all risks
    latest_snapshot = currentSnapshot;
  }

  return {
    latest_snapshot,
    quarterly_series: quarterlySeries,
  };
}

