import { Router, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getRiskLevel, hasPolicyNonConformance } from '../services/riskService';
import { getRiskDashboardSummary } from '../services/riskDashboardService';

const router = Router();

// GET /api/dashboard - comprehensive dashboard statistics
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Get current user for acknowledgment stats
    const user = req.user ? await prisma.user.findUnique({
      where: { email: req.user.email || '' },
    }) : null;

    // ===== DOCUMENT STATISTICS =====
    // Overdue documents
    const overdueDocuments = await prisma.document.findMany({
      where: {
        nextReviewDate: {
          lt: now,
        },
        status: { in: ['APPROVED', 'IN_REVIEW'] },
        ReviewTask: {
          none: {
            status: { in: ['PENDING', 'OVERDUE'] },
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: {
        nextReviewDate: 'asc',
      },
      take: 10,
    });

    // Upcoming documents (next 30 days) - no limit to get accurate count
    const upcomingDocuments = await prisma.document.findMany({
      where: {
        nextReviewDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
        status: { in: ['APPROVED', 'IN_REVIEW'] },
        ReviewTask: {
          none: {
            status: { in: ['PENDING', 'OVERDUE'] },
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: {
        nextReviewDate: 'asc',
      },
      // Removed take: 10 limit to get accurate count matching Reviews dashboard
    });

    // Documents missing review dates
    const documentsMissingReviewDate = await prisma.document.findMany({
      where: {
        nextReviewDate: null,
        status: { in: ['APPROVED', 'IN_REVIEW'] },
        ReviewTask: {
          none: {
            status: { in: ['PENDING', 'OVERDUE'] },
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 10,
    });

    // Overdue review tasks
    const overdueReviewTasks = await prisma.reviewTask.findMany({
      where: {
        dueDate: {
          lt: now,
        },
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            version: true,
            type: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
      take: 10,
    });

    // Upcoming review tasks (next 30 days) - no limit to get accurate count
    const upcomingReviewTasks = await prisma.reviewTask.findMany({
      where: {
        dueDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
        status: 'PENDING',
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            version: true,
            type: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
      // Removed take: 10 limit to get accurate count matching Reviews dashboard
    });

    // Documents by status
    const documentsByStatus = await prisma.document.groupBy({
      by: ['status'],
      _count: true,
    });

    // ===== RISK STATISTICS =====
    // Get all non-archived risks
    const allRisks = await prisma.risk.findMany({
      where: {
        archived: false,
      },
      select: {
        id: true,
        title: true,
        calculatedScore: true,
        mitigatedScore: true,
        mitigationImplemented: true,
        initialRiskTreatmentCategory: true,
        residualRiskTreatmentCategory: true,
        mitigatedConfidentialityScore: true,
        mitigatedIntegrityScore: true,
        mitigatedAvailabilityScore: true,
        mitigatedLikelihood: true,
        mitigationDescription: true,
      },
    });

    // Calculate risk statistics
    let totalRiskScore = 0;
    let implementedMitigationRiskScore = 0;
    let nonImplementedMitigationRiskScore = 0;
    const risksByLevel: { LOW: number; MEDIUM: number; HIGH: number } = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    const mitigatedRisksByLevel: { LOW: number; MEDIUM: number; HIGH: number } = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    const risksWithMitigationNotImplemented: Array<{
      id: string;
      title: string;
      calculatedScore: number;
      mitigatedScore: number | null;
    }> = [];
    const risksByTreatmentCategory: { [key: string]: number } = {};
    let policyNonConformanceCount = 0;
    const risksWithPolicyNonConformance: Array<{
      id: string;
      title: string;
      initialRiskTreatmentCategory: string | null;
    }> = [];

    allRisks.forEach((risk) => {
      // Total risk score
      totalRiskScore += risk.calculatedScore;

      // Risk levels (Initial - based on calculatedScore)
      const riskLevel = getRiskLevel(risk.calculatedScore);
      risksByLevel[riskLevel]++;

      // Mitigated scores
      if (risk.mitigatedScore !== null) {
        if (risk.mitigationImplemented) {
          implementedMitigationRiskScore += risk.mitigatedScore;
        } else {
          nonImplementedMitigationRiskScore += risk.mitigatedScore;
          risksWithMitigationNotImplemented.push({
            id: risk.id,
            title: risk.title,
            calculatedScore: risk.calculatedScore,
            mitigatedScore: risk.mitigatedScore,
          });
        }
      }

      // Mitigated risk levels - include ALL risks
      // Use mitigatedScore if available, otherwise use calculatedScore (no mitigation applied)
      const scoreForMitigatedLevel = risk.mitigatedScore !== null ? risk.mitigatedScore : risk.calculatedScore;
      const mitigatedLevel = getRiskLevel(scoreForMitigatedLevel);
      mitigatedRisksByLevel[mitigatedLevel]++;

      // Treatment categories
      const treatmentCategory = risk.residualRiskTreatmentCategory || risk.initialRiskTreatmentCategory || 'UNCATEGORIZED';
      risksByTreatmentCategory[treatmentCategory] = (risksByTreatmentCategory[treatmentCategory] || 0) + 1;

      // Policy non-conformance
      if (hasPolicyNonConformance(risk)) {
        policyNonConformanceCount++;
        risksWithPolicyNonConformance.push({
          id: risk.id,
          title: risk.title,
          initialRiskTreatmentCategory: risk.initialRiskTreatmentCategory,
        });
      }
    });

    // Risk score delta
    const riskScoreDelta = totalRiskScore - (implementedMitigationRiskScore + nonImplementedMitigationRiskScore);

    // ===== CONTROL STATISTICS =====
    // Get all controls
    const allControls = await prisma.control.findMany({
      select: {
        id: true,
        code: true,
        title: true,
        selectedForRiskAssessment: true,
        selectedForContractualObligation: true,
        selectedForLegalRequirement: true,
        selectedForBusinessRequirement: true,
        implemented: true,
      },
    });

    // Calculate control statistics
    let selectedControlsCount = 0;
    let excludedControlsCount = 0;
    let selectedButNotImplementedCount = 0;
    const controlsBySelectionReason = {
      riskAssessment: 0,
      contractualObligation: 0,
      legalRequirement: 0,
      businessRequirement: 0,
    };
    const selectedButNotImplementedControls: Array<{
      id: string;
      code: string;
      title: string;
    }> = [];

    allControls.forEach((control) => {
      const isSelected =
        control.selectedForRiskAssessment ||
        control.selectedForContractualObligation ||
        control.selectedForLegalRequirement ||
        control.selectedForBusinessRequirement;

      if (isSelected) {
        selectedControlsCount++;
        if (!control.implemented) {
          selectedButNotImplementedCount++;
          selectedButNotImplementedControls.push({
            id: control.id,
            code: control.code,
            title: control.title,
          });
        }
      } else {
        excludedControlsCount++;
      }

      // Selection reason breakdown
      if (control.selectedForRiskAssessment) controlsBySelectionReason.riskAssessment++;
      if (control.selectedForContractualObligation) controlsBySelectionReason.contractualObligation++;
      if (control.selectedForLegalRequirement) controlsBySelectionReason.legalRequirement++;
      if (control.selectedForBusinessRequirement) controlsBySelectionReason.businessRequirement++;
    });

    // ===== SUPPLIER REVIEW STATISTICS =====
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const elevenMonthsAgo = new Date();
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);

    // Suppliers with no review date
    const suppliersMissingReviewDate = await prisma.supplier.findMany({
      where: {
        reviewDate: null,
        status: { in: ['ACTIVE', 'IN_ONBOARDING'] },
      },
      select: {
        id: true,
        name: true,
        reviewDate: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 20,
    });

    // Suppliers overdue (>12 months since review)
    const suppliersOverdue = await prisma.supplier.findMany({
      where: {
        reviewDate: {
          lt: twelveMonthsAgo,
        },
        status: { in: ['ACTIVE', 'IN_ONBOARDING'] },
      },
      select: {
        id: true,
        name: true,
        reviewDate: true,
      },
      orderBy: {
        reviewDate: 'asc',
      },
      take: 20,
    });

    // Suppliers with warning (within 1 month of 12 months)
    const suppliersWarning = await prisma.supplier.findMany({
      where: {
        reviewDate: {
          gte: twelveMonthsAgo,
          lt: elevenMonthsAgo,
        },
        status: { in: ['ACTIVE', 'IN_ONBOARDING'] },
      },
      select: {
        id: true,
        name: true,
        reviewDate: true,
      },
      orderBy: {
        reviewDate: 'asc',
      },
      take: 20,
    });

    // ===== ACKNOWLEDGMENT STATISTICS =====
    let pendingAcknowledgments: any[] = [];
    let acknowledgmentStats: any = null;

    if (user) {
      // Get documents requiring acknowledgment
      const approvedDocuments = await prisma.document.findMany({
        where: {
          status: 'APPROVED',
          requiresAcknowledgement: true,
        },
        include: {
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      });

      // Get user's latest acknowledgments
      const userAcknowledgments = await prisma.acknowledgment.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          acknowledgedAt: 'desc',
        },
      });

      // Create a map of documentId -> latest acknowledgment version
      const acknowledgmentMap = new Map<string, string>();
      userAcknowledgments.forEach((ack) => {
        const existing = acknowledgmentMap.get(ack.documentId);
        if (!existing || ack.documentVersion > existing) {
          acknowledgmentMap.set(ack.documentId, ack.documentVersion);
        }
      });

      // Filter documents that need acknowledgment
      pendingAcknowledgments = approvedDocuments
        .filter((doc) => {
          const lastAcknowledgedVersion = acknowledgmentMap.get(doc.id);
          return !lastAcknowledgedVersion || doc.version !== lastAcknowledgedVersion;
        })
        .slice(0, 10);

      // Overall acknowledgment statistics
      const totalStaffUsers = await prisma.user.count({
        where: {
          role: 'STAFF',
        },
      });

      const acknowledgmentCompletionPromises = approvedDocuments.map(async (doc) => {
        const acknowledgments = await prisma.acknowledgment.count({
          where: {
            documentId: doc.id,
            documentVersion: doc.version,
          },
        });

        return {
          documentId: doc.id,
          documentTitle: doc.title,
          documentVersion: doc.version,
          acknowledgedCount: acknowledgments,
          totalStaffCount: totalStaffUsers,
          completionPercentage: totalStaffUsers > 0 ? (acknowledgments / totalStaffUsers) * 100 : 0,
        };
      });

      const acknowledgmentCompletion = await Promise.all(acknowledgmentCompletionPromises);

      acknowledgmentStats = {
        totalDocumentsRequiringAcknowledgment: approvedDocuments.length,
        totalStaffUsers,
        acknowledgmentCompletion,
      };
    }

    // ===== RESPONSE =====
    res.json({
      documents: {
        overdue: overdueDocuments,
        upcoming: upcomingDocuments,
        missingReviewDate: documentsMissingReviewDate,
        overdueReviewTasks,
        upcomingReviewTasks,
        byStatus: documentsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
      },
      risks: {
        totalCount: allRisks.length,
        totalRiskScore,
        implementedMitigationRiskScore,
        nonImplementedMitigationRiskScore,
        riskScoreDelta,
        byLevel: risksByLevel,
        mitigatedByLevel: mitigatedRisksByLevel,
        withMitigationNotImplemented: risksWithMitigationNotImplemented.slice(0, 20),
        byTreatmentCategory: risksByTreatmentCategory,
        policyNonConformanceCount,
        withPolicyNonConformance: risksWithPolicyNonConformance.slice(0, 20),
      },
      controls: {
        totalCount: allControls.length,
        selectedCount: selectedControlsCount,
        excludedCount: excludedControlsCount,
        selectedButNotImplementedCount,
        selectedButNotImplemented: selectedButNotImplementedControls.slice(0, 20),
        bySelectionReason: controlsBySelectionReason,
      },
      acknowledgments: {
        pending: pendingAcknowledgments,
        stats: acknowledgmentStats,
      },
      suppliers: {
        missingReviewDate: suppliersMissingReviewDate,
        overdue: suppliersOverdue,
        warning: suppliersWarning,
        missingReviewDateCount: suppliersMissingReviewDate.length,
        overdueCount: suppliersOverdue.length,
        warningCount: suppliersWarning.length,
      },
      lastUpdated: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/dashboard/staff - staff-specific dashboard data
router.get('/staff', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { email: req.user.email || '' },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Get pending acknowledgments count
    const approvedDocuments = await prisma.document.findMany({
      where: {
        status: 'APPROVED',
        requiresAcknowledgement: true,
      },
    });

    const userAcknowledgments = await prisma.acknowledgment.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        acknowledgedAt: 'desc',
      },
    });

    // Create a map of documentId -> latest acknowledgment version
    const acknowledgmentMap = new Map<string, string>();
    userAcknowledgments.forEach((ack) => {
      const existing = acknowledgmentMap.get(ack.documentId);
      if (!existing || ack.documentVersion > existing) {
        acknowledgmentMap.set(ack.documentId, ack.documentVersion);
      }
    });

    // Filter documents that need acknowledgment
    const pendingDocuments = approvedDocuments.filter((doc) => {
      const lastAcknowledgedVersion = acknowledgmentMap.get(doc.id);
      return !lastAcknowledgedVersion || doc.version !== lastAcknowledgedVersion;
    });

    const pendingAcknowledgmentsCount = pendingDocuments.length;

    // Get recently updated documents (APPROVED, sorted by lastChangedDate DESC, limit 10)
    const recentlyUpdatedDocuments = await prisma.document.findMany({
      where: {
        status: 'APPROVED',
        lastChangedDate: {
          not: null,
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: {
        lastChangedDate: 'desc',
      },
      take: 10,
    });

    // Check which documents the user has acknowledged
    const recentlyUpdatedWithAckStatus = recentlyUpdatedDocuments.map((doc) => {
      const lastAcknowledgedVersion = acknowledgmentMap.get(doc.id);
      const isAcknowledged = lastAcknowledgedVersion === doc.version;
      
      return {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        version: doc.version,
        owner: doc.owner,
        storageLocation: doc.storageLocation,
        documentUrl: doc.documentUrl,
        requiresAcknowledgement: doc.requiresAcknowledgement,
        lastChangedDate: doc.lastChangedDate,
        isAcknowledged,
      };
    });

    // Review status counts
    const overdueCount = await prisma.document.count({
      where: {
        nextReviewDate: {
          lt: now,
        },
        status: { in: ['APPROVED', 'IN_REVIEW'] },
      },
    });

    const upcomingCount = await prisma.document.count({
      where: {
        nextReviewDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
        status: { in: ['APPROVED', 'IN_REVIEW'] },
      },
    });

    res.json({
      pendingAcknowledgmentsCount,
      recentlyUpdatedDocuments: recentlyUpdatedWithAckStatus,
      reviewStatus: {
        overdueCount,
        upcomingCount,
      },
      lastUpdated: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching staff dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch staff dashboard data' });
  }
});

// GET /api/risk-dashboard/summary - risk dashboard quarterly aggregation
router.get('/risk-dashboard/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const summary = await getRiskDashboardSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching risk dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch risk dashboard summary' });
  }
});

export { router as dashboardRouter };

