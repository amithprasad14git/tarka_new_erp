// Per-dashboard config — Unit Wise Recovery Target.

/**
 * Dashboard-specific settings beyond the registry entry in config/dashboards.js.
 */

export const unitWiseRecoveryTargetConfig = {
  key: "unit_wise_recovery_target",
  permissionKey: "dashboard_unit_wise_recovery_target",
  showCaseTarget: false,
  /** Companion sub-widgets rendered inside the same card (single API payload). */
  subWidgets: ["bankRecoveryPie", "kpiStrip", "monthWiseRecoveryTrend"],
  /** Recommended DB indexes for performant aggregation (see docs or DBA runbook). */
  recommendedIndexes: [
    "new_case_inward_amount_recovered (caseInwardId)",
    "new_case_inward_amount_recovered (recoveredDate)",
    "new_case_inward (unit)"
  ]
};
