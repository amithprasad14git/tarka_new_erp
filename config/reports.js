// Configuration — report screens (filters, columns, layout). CRUD modules live in config/modules.js.

import {
  AUDIT_LOG_ACTION_OPTIONS,
  buildAuditLogModuleFilterOptions
} from "../lib/reports/auditLogReportOptions.js";

/**
 * Report registry: keys match `user_permissions.module` and `/dashboard/<key>`.
 * SQL for each report lives in lib/reports/<key>.js (one file per report).
 */
export const reports = {
  report_new_case_inward_register: {
    label: "Case Inward Register",
    icon: "📥",
    group: "Case Related Reports",

    fields: [
      { name: "fromDate", type: "date", label: "From Date", required: true, maxToday: true, default: "monthStart" },
      { name: "toDate", type: "date", label: "To Date", required: true, maxToday: true, default: "monthEnd" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        lookup: { module: "branch_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "loanCategory",
        type: "lookup",
        label: "Loan Category",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Category",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanType",
        type: "lookup",
        label: "Loan Type",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Type",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "npaStatus",
        type: "lookup",
        label: "NPA Status",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "NPA Status",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "receivedFrom",
        type: "lookup",
        label: "Received From",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Case Received From",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "fileMaintenance",
        type: "lookup",
        label: "File Maintenance",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "File Maintenance",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ],

    reportLayout: {
      title: "NEW CASE INWARD REGISTER"
    },

    reportStyle: {
      totalRow: { labelColumn: "npaStatusLabel" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      {
        key: "entrustmentDate",
        label: "ENTRUSTMENT DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      { key: "unitLabel", label: "UNIT", align: "left", widthExcel: 8, widthHtml: "6rem", hideWhenFilterSet: "unit" },
      { key: "caseNo", label: "CASE NO", align: "center", widthExcel: 12, widthHtml: "7.5rem" },
      { key: "bankLabel", label: "BANK", align: "center", widthExcel: 10, widthHtml: "6rem", hideWhenFilterSet: "bank" },
      { key: "hoZoLabel", label: "HO/ZO", align: "left", widthExcel: 10, widthHtml: "6rem", hideWhenFilterSet: "ho_zo" },
      { key: "rboRoLabel", label: "RBO/RO", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "rbo_ro" },
      { key: "branchLabel", label: "BRANCH", align: "left", widthExcel: 28, widthHtml: "12rem", hideWhenFilterSet: "branch" },
      { key: "borrower", label: "BORROWER", align: "left", widthExcel: 32, widthHtml: "11rem" },
      { key: "loanAccountNo", label: "LOAN AC NO", align: "left", widthExcel: 14, widthHtml: "9rem" },
      { key: "loanTypeLabel", label: "LOAN TYPE", align: "left", widthExcel: 14, widthHtml: "7rem", hideWhenFilterSet: "loanType" },
      { key: "npaStatusLabel", label: "NPA STATUS", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "npaStatus" },
      {
        key: "npaDate",
        label: "NPA DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      {
        key: "closureBalance",
        label: "CLOSURE BALANCE",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 16,
        widthHtml: "10rem"
      }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/

  report_branch_register: {
    label: "Branch Register",
    icon: "🏦",
    group: "General Reports",

    fields: [
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "active",
        type: "select",
        label: "Active",
        ui: { emptyOptionLabel: "Select One" },
        options: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" }
        ]
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" }
    ],

    reportLayout: {
      title: "BRANCH REGISTER"
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      { key: "bankLabel", label: "BANK", align: "left", widthExcel: 18, widthHtml: "6rem", hideWhenFilterSet: "bank" },
      { key: "hoZoLabel", label: "HO/ZO", align: "left", widthExcel: 10, widthHtml: "6rem", hideWhenFilterSet: "ho_zo" },
      { key: "rboRoLabel", label: "RBO/RO", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "rbo_ro" },
      { key: "branchCode", label: "BRANCH CODE", align: "center", widthExcel: 12, widthHtml: "7.5rem" },
      { key: "branchName", label: "BRANCH NAME", align: "left", widthExcel: 28, widthHtml: "12rem" },
      { key: "place", label: "PLACE", align: "left", widthExcel: 16, widthHtml: "8rem" },
      { key: "active", label: "ACTIVE", align: "center", widthExcel: 8, widthHtml: "5rem", hideWhenFilterSet: "active" }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/

  report_pending_cases_on_hand: {
    label: "Pending Cases on Hand",
    icon: "⏳",
    group: "Case Related Reports",

    fields: [
      { name: "asOnDate", type: "date", label: "As on Date", required: true, maxToday: true, default: "today" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        lookup: { module: "branch_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "receivedFrom",
        type: "lookup",
        label: "Received From",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Case Received From",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "fileMaintenance",
        type: "lookup",
        label: "File Maintenance",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "File Maintenance",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanCategory",
        type: "lookup",
        label: "Loan Category",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Category",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanType",
        type: "lookup",
        label: "Loan Type",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Type",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "npaStatus",
        type: "lookup",
        label: "NPA Status",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "NPA Status",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ],

    reportLayout: {
      title: "PENDING CASES ON HAND"
    },

    reportStyle: {
      totalRow: { labelColumn: "entrustmentDate" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      {
        key: "entrustmentDate",
        label: "ENTRUSTMENT DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      { key: "caseNo", label: "CASE NO", align: "center", widthExcel: 12, widthHtml: "7.5rem" },
      { key: "hoZoLabel", label: "HO/ZO", align: "left", widthExcel: 10, widthHtml: "6rem", hideWhenFilterSet: "ho_zo" },
      { key: "rboRoLabel", label: "RBO/RO", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "rbo_ro" },
      { key: "branchLabel", label: "BRANCH", align: "left", widthExcel: 28, widthHtml: "12rem", hideWhenFilterSet: "branch" },
      {
        key: "receivedFromLabel",
        label: "RECEIVED FROM",
        align: "left",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "receivedFrom"
      },
      { key: "borrower", label: "BORROWER", align: "left", widthExcel: 32, widthHtml: "11rem" },
      { key: "loanAccountNo", label: "LOAN AC NO", align: "left", widthExcel: 14, widthHtml: "9rem" },
      { key: "loanTypeLabel", label: "LOAN TYPE", align: "left", widthExcel: 14, widthHtml: "7rem", hideWhenFilterSet: "loanType" },
      { key: "npaStatusLabel", label: "NPA STATUS", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "npaStatus" },
      {
        key: "npaDate",
        label: "NPA DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      {
        key: "closureBalance",
        label: "CLOSURE BALANCE",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 20,
        widthHtml: "10rem"
      },
      { key: "caseStatusLabel", label: "CASE STATUS", align: "left", widthExcel: 16, widthHtml: "8rem" },
      {
        key: "amountRecovered",
        label: "AMOUNT RECOVERED",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 20,
        widthHtml: "10rem"
      },
      { key: "caseStatusRemarks", label: "REMARKS", align: "left", widthExcel: 24, widthHtml: "10rem" }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/

  report_search_loan_ac: {
    label: "Search Loan AC",
    icon: "🔍",
    group: "Case Related Reports",

    fields: [
      { name: "asOnDate", type: "date", label: "As on Date", required: true, maxToday: true, default: "today" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        lookup: { module: "branch_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "receivedFrom",
        type: "lookup",
        label: "Received From",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Case Received From",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "fileMaintenance",
        type: "lookup",
        label: "File Maintenance",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "File Maintenance",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanCategory",
        type: "lookup",
        label: "Loan Category",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Category",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanType",
        type: "lookup",
        label: "Loan Type",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Type",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "npaStatus",
        type: "lookup",
        label: "NPA Status",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "NPA Status",
          extraLovParams: { f_active: "Yes" }
        }
      },
      { name: "searchLoanAc", type: "text", label: "Search by Loan AC" },
      { name: "searchName", type: "text", label: "Search by Name" },
      { name: "searchCaseNo", type: "text", label: "Search by Case No" },
      {
        name: "dataType",
        type: "select",
        label: "Data Type",
        required: true,
        default: "All",
        options: [
          { label: "All", value: "All" },
          { label: "Ongoing Cases", value: "Ongoing" },
          { label: "Settled Cases", value: "Settled" },
          { label: "Returned Cases", value: "Returned" }
        ]
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ],

    reportLayout: {
      title: "SEARCH LOAN AC"
    },

    reportStyle: {
      totalRow: { labelColumn: "entrustmentDate" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      {
        key: "entrustmentDate",
        label: "ENTRUSTMENT DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      { key: "caseNo", label: "CASE NO", align: "center", widthExcel: 12, widthHtml: "7.5rem" },
      { key: "hoZoLabel", label: "HO/ZO", align: "left", widthExcel: 10, widthHtml: "6rem", hideWhenFilterSet: "ho_zo" },
      { key: "rboRoLabel", label: "RBO/RO", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "rbo_ro" },
      { key: "branchLabel", label: "BRANCH", align: "left", widthExcel: 28, widthHtml: "12rem", hideWhenFilterSet: "branch" },
      {
        key: "receivedFromLabel",
        label: "RECEIVED FROM",
        align: "left",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "receivedFrom"
      },
      { key: "borrower", label: "BORROWER", align: "left", widthExcel: 32, widthHtml: "11rem" },
      { key: "loanAccountNo", label: "LOAN AC NO", align: "left", widthExcel: 14, widthHtml: "9rem" },
      { key: "loanTypeLabel", label: "LOAN TYPE", align: "left", widthExcel: 14, widthHtml: "7rem", hideWhenFilterSet: "loanType" },
      { key: "npaStatusLabel", label: "NPA STATUS", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "npaStatus" },
      {
        key: "npaDate",
        label: "NPA DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      {
        key: "closureBalance",
        label: "CLOSURE BALANCE",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 16,
        widthHtml: "10rem"
      },
      { key: "caseStatusLabel", label: "CASE STATUS", align: "left", widthExcel: 16, widthHtml: "8rem" },
      {
        key: "amountRecovered",
        label: "AMOUNT RECOVERED",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 16,
        widthHtml: "10rem"
      },
      { key: "caseStatusRemarks", label: "REMARKS", align: "left", widthExcel: 24, widthHtml: "10rem" }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/

  report_part_recovered_cases: {
    label: "Part Recovered Cases",
    icon: "💰",
    group: "Case Related Reports",

    fields: [
      { name: "asOnDate", type: "date", label: "As on Date", required: true, maxToday: true, default: "today" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        lookup: { module: "branch_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "receivedFrom",
        type: "lookup",
        label: "Received From",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Case Received From",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "fileMaintenance",
        type: "lookup",
        label: "File Maintenance",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "File Maintenance",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanCategory",
        type: "lookup",
        label: "Loan Category",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Category",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanType",
        type: "lookup",
        label: "Loan Type",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Type",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "npaStatus",
        type: "lookup",
        label: "NPA Status",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "NPA Status",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ],

    reportLayout: {
      title: "PART RECOVERED CASES"
    },

    reportStyle: {
      totalRow: { labelColumn: "entrustmentDate" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      {
        key: "entrustmentDate",
        label: "ENTRUSTMENT DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      { key: "caseNo", label: "CASE NO", align: "center", widthExcel: 12, widthHtml: "7.5rem" },
      { key: "hoZoLabel", label: "HO/ZO", align: "left", widthExcel: 10, widthHtml: "6rem", hideWhenFilterSet: "ho_zo" },
      { key: "rboRoLabel", label: "RBO/RO", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "rbo_ro" },
      { key: "branchLabel", label: "BRANCH", align: "left", widthExcel: 28, widthHtml: "12rem", hideWhenFilterSet: "branch" },
      {
        key: "receivedFromLabel",
        label: "RECEIVED FROM",
        align: "left",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "receivedFrom"
      },
      { key: "borrower", label: "BORROWER", align: "left", widthExcel: 32, widthHtml: "11rem" },
      { key: "loanAccountNo", label: "LOAN AC NO", align: "left", widthExcel: 14, widthHtml: "9rem" },
      { key: "loanTypeLabel", label: "LOAN TYPE", align: "left", widthExcel: 14, widthHtml: "7rem", hideWhenFilterSet: "loanType" },
      { key: "npaStatusLabel", label: "NPA STATUS", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "npaStatus" },
      {
        key: "npaDate",
        label: "NPA DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      {
        key: "closureBalance",
        label: "CLOSURE BALANCE",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 16,
        widthHtml: "10rem"
      },
      { key: "caseStatusLabel", label: "CASE STATUS", align: "left", widthExcel: 16, widthHtml: "8rem" },
      {
        key: "amountRecovered",
        label: "AMOUNT RECOVERED",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 16,
        widthHtml: "10rem"
      },
      { key: "caseStatusRemarks", label: "REMARKS", align: "left", widthExcel: 24, widthHtml: "10rem" }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/

  report_returned_cases: {
    label: "Returned Cases",
    icon: "⛔",
    group: "Case Related Reports",

    fields: [
      { name: "fromDate", type: "date", label: "Return From Date", required: true, maxToday: true, default: "monthStart" },
      { name: "toDate", type: "date", label: "Return To Date", required: true, maxToday: true, default: "monthEnd" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        lookup: { module: "branch_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "receivedFrom",
        type: "lookup",
        label: "Received From",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Case Received From",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "fileMaintenance",
        type: "lookup",
        label: "File Maintenance",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "File Maintenance",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanCategory",
        type: "lookup",
        label: "Loan Category",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Category",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanType",
        type: "lookup",
        label: "Loan Type",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Type",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "npaStatus",
        type: "lookup",
        label: "NPA Status",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "NPA Status",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ],

    reportLayout: {
      title: "RETURNED CASES"
    },

    reportStyle: {
      totalRow: { labelColumn: "entrustmentDate" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      {
        key: "entrustmentDate",
        label: "ENTRUSTMENT DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      { key: "caseNo", label: "CASE NO", align: "center", widthExcel: 12, widthHtml: "7.5rem" },
      { key: "hoZoLabel", label: "HO/ZO", align: "left", widthExcel: 10, widthHtml: "6rem", hideWhenFilterSet: "ho_zo" },
      { key: "rboRoLabel", label: "RBO/RO", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "rbo_ro" },
      { key: "branchLabel", label: "BRANCH", align: "left", widthExcel: 28, widthHtml: "12rem", hideWhenFilterSet: "branch" },
      {
        key: "receivedFromLabel",
        label: "RECEIVED FROM",
        align: "left",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "receivedFrom"
      },
      { key: "borrower", label: "BORROWER", align: "left", widthExcel: 32, widthHtml: "11rem" },
      { key: "loanAccountNo", label: "LOAN AC NO", align: "left", widthExcel: 14, widthHtml: "9rem" },
      { key: "loanTypeLabel", label: "LOAN TYPE", align: "left", widthExcel: 14, widthHtml: "7rem", hideWhenFilterSet: "loanType" },
      { key: "npaStatusLabel", label: "NPA STATUS", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "npaStatus" },
      {
        key: "npaDate",
        label: "NPA DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      {
        key: "closureBalance",
        label: "CLOSURE BALANCE",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 16,
        widthHtml: "10rem"
      },
      {
        key: "amountRecovered",
        label: "AMOUNT RECOVERED",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 16,
        widthHtml: "10rem"
      },
      {
        key: "returnDate",
        label: "RETURN DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      { key: "caseStatusRemarks", label: "REMARKS", align: "left", widthExcel: 24, widthHtml: "10rem" }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/

  report_settled_cases: {
    label: "Settled Cases",
    icon: "✅",
    group: "Case Related Reports",

    fields: [
      { name: "fromDate", type: "date", label: "Settled From Date", required: true, maxToday: true, default: "monthStart" },
      { name: "toDate", type: "date", label: "Settled To Date", required: true, maxToday: true, default: "today" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        lookup: { module: "branch_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "receivedFrom",
        type: "lookup",
        label: "Received From",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Case Received From",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "fileMaintenance",
        type: "lookup",
        label: "File Maintenance",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "File Maintenance",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanCategory",
        type: "lookup",
        label: "Loan Category",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Category",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "loanType",
        type: "lookup",
        label: "Loan Type",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Loan Type",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "npaStatus",
        type: "lookup",
        label: "NPA Status",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "NPA Status",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ],

    reportLayout: {
      title: "SETTLED CASES"
    },

    reportStyle: {
      totalRow: { labelColumn: "entrustmentDate" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      {
        key: "entrustmentDate",
        label: "ENTRUSTMENT DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      { key: "caseNo", label: "CASE NO", align: "center", widthExcel: 12, widthHtml: "7.5rem" },
      { key: "hoZoLabel", label: "HO/ZO", align: "left", widthExcel: 10, widthHtml: "6rem", hideWhenFilterSet: "ho_zo" },
      { key: "rboRoLabel", label: "RBO/RO", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "rbo_ro" },
      { key: "branchLabel", label: "BRANCH", align: "left", widthExcel: 28, widthHtml: "12rem", hideWhenFilterSet: "branch" },
      {
        key: "receivedFromLabel",
        label: "RECEIVED FROM",
        align: "left",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "receivedFrom"
      },
      { key: "borrower", label: "BORROWER", align: "left", widthExcel: 32, widthHtml: "11rem" },
      { key: "loanAccountNo", label: "LOAN AC NO", align: "left", widthExcel: 14, widthHtml: "9rem" },
      { key: "loanTypeLabel", label: "LOAN TYPE", align: "left", widthExcel: 14, widthHtml: "7rem", hideWhenFilterSet: "loanType" },
      { key: "npaStatusLabel", label: "NPA STATUS", align: "left", widthExcel: 10, widthHtml: "5rem", hideWhenFilterSet: "npaStatus" },
      {
        key: "npaDate",
        label: "NPA DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      {
        key: "amountRecovered",
        label: "AMOUNT RECOVERED",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 16,
        widthHtml: "10rem"
      },
      {
        key: "closureBalance",
        label: "NPA REDUCED",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 16,
        widthHtml: "10rem"
      },
      {
        key: "settledDate",
        label: "SETTLED DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 14,
        widthHtml: "7rem"
      },
      { key: "caseStatusLabel", label: "CASE STATUS", align: "left", widthExcel: 16, widthHtml: "8rem" }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // Region Wise Cummulative — custom layout (reportLayout.mode: custom). SQL: lib/reports/report_region_wise_cumulative_report.js

  report_region_wise_cumulative_report: {
    label: "Region Wise Cummulative Report",
    icon: "🧮",
    group: "Case Related Reports",

    fields: [
      {
        name: "financialYear",
        type: "lookup",
        label: "Financial Year",
        required: true,
        lookup: { module: "financial_year_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        lookup: { module: "branch_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ],

    reportLayout: {
      mode: "custom",
      customRenderer: "region_wise_cumulative",
      title: "REGION WISE CUMMULATIVE REPORT",
      contentAlign: "center",
      showGeneratedAt: false,
      showOutputMeta: false,
      filterSummaryExcludeFields: ["outputFormat", "financialYear"]
    },

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // Unit Wise Cummulative — custom layout (reportLayout.mode: custom). SQL: lib/reports/report_unit_wise_cumulative_report.js

  report_unit_wise_cumulative_report: {
    label: "Unit Wise Cummulative Report",
    icon: "🧑‍🤝‍🧑",
    group: "Case Related Reports",

    fields: [
      {
        name: "financialYear",
        type: "lookup",
        label: "Financial Year",
        required: true,
        lookup: { module: "financial_year_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        lookup: { module: "branch_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "dataType",
        type: "select",
        label: "Data Type",
        required: true,
        default: "Month Wise",
        options: [
          { label: "Month Wise", value: "Month Wise" },
          { label: "Summary", value: "Summary" }
        ]
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ],

    reportLayout: {
      mode: "custom",
      customRenderer: "unit_wise_cumulative",
      title: "UNIT WISE CUMMULATIVE REPORT",
      contentAlign: "center",
      showGeneratedAt: false,
      showOutputMeta: false,
      filterSummaryExcludeFields: ["outputFormat", "financialYear"]
    },

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // SARFAESI Case Report — custom layout (reportLayout.mode: custom). SQL: lib/reports/report_sarfaesi_case_report.js

  report_sarfaesi_case_report: {
    label: "SARFAESI Case Report",
    icon: "🏣",
    group: "Case Related Reports",

    fields: [
      { name: "asOnDate", type: "date", label: "As on Date", required: true, maxToday: true, default: "today" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        lookup: { module: "branch_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "receivedFrom",
        type: "lookup",
        label: "Received From",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Case Received From",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ],

    reportLayout: {
      mode: "custom",
      customRenderer: "sarfaesi_case_report",
      title: "SARFAESI CASE STATUS REPORT",
      showGeneratedAt: false,
      showOutputMeta: false,
      filterSummaryExcludeFields: ["outputFormat"]
    },

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // Audit Log Report — standard table layout. SQL: lib/reports/report_audit_log_report.js

  report_audit_log_report: {
    label: "Audit Log Report",
    icon: "🧾",
    group: "General Reports",

    fields: [
      { name: "fromDate", type: "date", label: "From Date", required: true, maxToday: true, default: "monthStart" },
      { name: "toDate", type: "date", label: "To Date", required: true, maxToday: true, default: "monthEnd" },
      {
        name: "module",
        type: "select",
        label: "Module",
        ui: { emptyOptionLabel: "All" },
        options: buildAuditLogModuleFilterOptions()
      },
      {
        name: "action",
        type: "select",
        label: "Action",
        ui: { emptyOptionLabel: "All" },
        options: AUDIT_LOG_ACTION_OPTIONS
      },
      {
        name: "user",
        type: "lookup",
        label: "User",
        lookup: { module: "users", valueField: "id", labelField: "fullName" }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    reportLayout: {
      title: "AUDIT LOG REPORT",
      filterSummaryExcludeFields: ["outputFormat"]
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      { key: "createdDate", label: "CREATED DATE", align: "center", widthExcel: 20, widthHtml: "7rem" },
      {
        key: "userLabel",
        label: "USER",
        align: "left",
        widthExcel: 18,
        widthHtml: "11rem",
        hideWhenFilterSet: "user"
      },
      {
        key: "moduleLabel",
        label: "MODULE",
        align: "left",
        widthExcel: 22,
        widthHtml: "8rem",
        hideWhenFilterSet: "module"
      },
      {
        key: "action",
        label: "ACTION",
        align: "center",
        widthExcel: 10,
        widthHtml: "5rem",
        hideWhenFilterSet: "action"
      },
      { key: "recordLabel", label: "RECORD", align: "left", widthExcel: 24, widthHtml: "10rem" },
      { key: "oldData", label: "OLD DATA", align: "left", widthExcel: 48, widthHtml: "10rem" },
      { key: "newData", label: "NEW DATA", align: "left", widthExcel: 48, widthHtml: "10rem" }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // Assets & Investments Ledger — standard table layout. SQL: lib/reports/report_assets_investments_ledger.js

  report_assets_investments_ledger: {
    label: "Assets & Investments Ledger",
    icon: "🚗",
    group: "Accounts Reports",

    fields: [
      { name: "fromMonth", type: "month", label: "From Month", required: true, default: "currentMonth" },
      { name: "toMonth", type: "month", label: "To Month", required: true, default: "currentMonth" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "paidTo",
        type: "lookup",
        label: "Paid To",
        lookup: {
          module: "party_master",
          valueField: "id",
          ui: "popup",
          pickerLimit: 25,
          pickerSortBy: "partyName",
          extraLovParams: { f_active: "Yes" },
          pickerColumns: [
            { field: "partyName", header: "Party Name" },
            { field: "address", header: "Address" }
          ]
        }
      },
      {
        name: "paymentMode",
        type: "select",
        label: "Payment Mode",
        ui: { emptyOptionLabel: "All" },
        options: [
          { label: "Card", value: "Card" },
          { label: "Cheque", value: "Cheque" },
          { label: "Cash", value: "Cash" },
          { label: "UPI", value: "UPI" }
        ]
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [{ parent: "unit", child: "npaCurrentAc", lovParam: "f_unit" }],

    reportLayout: {
      title: "ASSETS & INVESTMENTS LEDGER",
      filterSummaryExcludeFields: ["outputFormat"]
    },

    reportStyle: {
      totalRow: { labelColumn: "voucherNo" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      { key: "voucherNo", label: "VOUCHER NO", align: "center", widthExcel: 16, widthHtml: "7.5rem" },
      {
        key: "date",
        label: "DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      {
        key: "unitLabel",
        label: "UNIT",
        align: "left",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "unit"
      },
      {
        key: "paidToLabel",
        label: "PAID TO",
        align: "left",
        widthExcel: 22,
        widthHtml: "11rem",
        hideWhenFilterSet: "paidTo"
      },
      { key: "remarks", label: "REMARKS", align: "left", widthExcel: 24, widthHtml: "10rem" },
      {
        key: "paymentMode",
        label: "PAYMENT MODE",
        align: "center",
        widthExcel: 12,
        widthHtml: "5rem",
        hideWhenFilterSet: "paymentMode"
      },
      {
        key: "npaCurrentAcLabel",
        label: "NPA CURRENT AC",
        align: "left",
        widthExcel: 18,
        widthHtml: "8rem",
        hideWhenFilterSet: "npaCurrentAc"
      },
      { key: "chequeNo", label: "CHEQUE NO", align: "left", widthExcel: 14, widthHtml: "7.5rem" },
      {
        key: "chequeDate",
        label: "CHEQUE DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      { key: "inFavourOf", label: "IN FAVOUR OF", align: "left", widthExcel: 20, widthHtml: "11rem" },
      {
        key: "amount",
        label: "AMOUNT",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 14,
        widthHtml: "10rem"
      }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // Cash Deposit & Withdraw Ledger — standard table layout. SQL: lib/reports/report_cash_deposit_withdraw_ledger.js

  report_cash_deposit_withdraw_ledger: {
    label: "Cash Deposit & Withdraw Ledger",
    icon: "💰",
    group: "Accounts Reports",

    fields: [
      { name: "month", type: "month", label: "Month", required: true, default: "currentMonth" },
      {
        name: "transactionType",
        type: "select",
        label: "Transaction Type",
        required: true,
        options: [
          { label: "Withdraw", value: "Withdraw" },
          { label: "Deposit", value: "Deposit" }
        ]
      },
      {
        name: "paymentMode",
        type: "select",
        label: "Payment Mode",
        ui: { emptyOptionLabel: "All" },
        options: [
          { label: "Card", value: "Card" },
          { label: "Cheque", value: "Cheque" },
          { label: "Cash", value: "Cash" },
          { label: "UPI", value: "UPI" }
        ]
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    reportLayout: {
      title: "CASH DEPOSIT & WITHDRAW LEDGER",
      filterSummaryExcludeFields: ["outputFormat"]
    },

    reportStyle: {
      totalRow: { labelColumn: "voucherNo" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      { key: "voucherNo", label: "VOUCHER NO", align: "center", widthExcel: 16, widthHtml: "7.5rem" },
      {
        key: "date",
        label: "DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      {
        key: "unitLabel",
        label: "UNIT",
        align: "left",
        widthExcel: 14,
        widthHtml: "6rem"
      },
      {
        key: "transactionType",
        label: "TRANSACTION TYPE",
        align: "center",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "transactionType"
      },
      {
        key: "paymentMode",
        label: "PAYMENT MODE",
        align: "center",
        widthExcel: 12,
        widthHtml: "5rem",
        hideWhenFilterSet: "paymentMode"
      },
      { key: "remarks", label: "REMARKS", align: "left", widthExcel: 24, widthHtml: "10rem" },
      {
        key: "npaCurrentAcLabel",
        label: "NPA CURRENT AC",
        align: "left",
        widthExcel: 18,
        widthHtml: "8rem",
        hideWhenFilterSet: "npaCurrentAc"
      },
      { key: "chequeNo", label: "CHEQUE NO", align: "left", widthExcel: 14, widthHtml: "7.5rem" },
      {
        key: "chequeDate",
        label: "CHEQUE DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      { key: "inFavourOf", label: "IN FAVOUR OF", align: "left", widthExcel: 20, widthHtml: "11rem" },
      {
        key: "amount",
        label: "AMOUNT",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 14,
        widthHtml: "10rem"
      }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // Expense Ledger — standard table with optional grouped sections. SQL: lib/reports/report_expense_ledger.js

  report_expense_ledger: {
    label: "Expense Ledger",
    icon: "💸",
    group: "Accounts Reports",

    fields: [
      { name: "month", type: "month", label: "Month", required: true, default: "currentMonth" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "paymentMode",
        type: "select",
        label: "Payment Mode",
        ui: { emptyOptionLabel: "All" },
        options: [
          { label: "Card", value: "Card" },
          { label: "Cheque", value: "Cheque" },
          { label: "Cash", value: "Cash" },
          { label: "UPI", value: "UPI" }
        ]
      },
      {
        name: "paidTo",
        type: "lookup",
        label: "Party",
        lookup: {
          module: "party_master",
          valueField: "id",
          ui: "popup",
          pickerLimit: 25,
          pickerSortBy: "partyName",
          extraLovParams: { f_active: "Yes" },
          pickerColumns: [
            { field: "partyName", header: "Party Name" },
            { field: "address", header: "Address" }
          ]
        }
      },
      {
        name: "expenseCategory",
        type: "lookup",
        label: "Expense Category",
        lookup: {
          module: "lookup_value_master",
          valueField: "id",
          filterLookupTypeName: "Payment Category",
          extraLovParams: { f_active: "Yes" }
        }
      },
      {
        name: "dataType",
        type: "select",
        label: "Data Type",
        required: true,
        default: "General",
        options: [
          { label: "General", value: "General" },
          { label: "Payment Mode Wise", value: "Payment Mode Wise" },
          { label: "Expense Category Wise", value: "Expense Category Wise" }
        ]
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [{ parent: "unit", child: "npaCurrentAc", lovParam: "f_unit" }],

    reportLayout: {
      title: "EXPENSE LEDGER",
      filterSummaryExcludeFields: ["outputFormat"]
    },

    reportStyle: {
      totalRow: { labelColumn: "voucherNo", label: "Total" },
      sectionHeaderRow: { background: "#c6e6ec" },
      sectionTotalRow: { labelColumn: "voucherNo", label: "Subtotal", background: "#f9f984" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      { key: "voucherNo", label: "VOUCHER NO", align: "center", widthExcel: 16, widthHtml: "7.5rem" },
      {
        key: "date",
        label: "DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      {
        key: "unitLabel",
        label: "UNIT",
        align: "left",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "unit"
      },
      {
        key: "paidToLabel",
        label: "PARTY",
        align: "left",
        widthExcel: 22,
        widthHtml: "11rem",
        hideWhenFilterSet: "paidTo"
      },
      {
        key: "expenseCategoryLabel",
        label: "EXPENSE CATEGORY",
        align: "left",
        widthExcel: 18,
        widthHtml: "8rem",
        hideWhenFilterSet: "expenseCategory",
        hideWhenDataType: "Expense Category Wise"
      },
      { key: "remarks", label: "REMARKS", align: "left", widthExcel: 24, widthHtml: "10rem" },
      {
        key: "paymentMode",
        label: "PAYMENT MODE",
        align: "center",
        widthExcel: 12,
        widthHtml: "5rem",
        hideWhenFilterSet: "paymentMode",
        hideWhenDataType: "Payment Mode Wise"
      },
      {
        key: "npaCurrentAcLabel",
        label: "NPA CURRENT AC",
        align: "left",
        widthExcel: 18,
        widthHtml: "8rem",
        hideWhenFilterSet: "npaCurrentAc"
      },
      { key: "chequeNo", label: "CHEQUE NO", align: "left", widthExcel: 14, widthHtml: "7.5rem" },
      {
        key: "chequeDate",
        label: "CHEQUE DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      { key: "inFavourOf", label: "IN FAVOUR OF", align: "left", widthExcel: 20, widthHtml: "11rem" },
      {
        key: "amount",
        label: "AMOUNT",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 14,
        widthHtml: "10rem"
      }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // Loan Account Ledger — standard table layout. SQL: lib/reports/report_loan_account_ledger.js

  report_loan_account_ledger: {
    label: "Loan Account Ledger",
    icon: "📉",
    group: "Accounts Reports",

    fields: [
      { name: "asOnDate", type: "date", label: "As on Date", required: true, maxToday: true, default: "today" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "transactionType",
        type: "select",
        label: "Transaction Type",
        ui: { emptyOptionLabel: "All" },
        options: [
          { label: "Receipt", value: "Receipt" },
          { label: "Payment", value: "Payment" }
        ]
      },
      {
        name: "paymentMode",
        type: "select",
        label: "Payment Mode",
        ui: { emptyOptionLabel: "All" },
        options: [
          { label: "Card", value: "Card" },
          { label: "Cheque", value: "Cheque" },
          { label: "Cash", value: "Cash" },
          { label: "UPI", value: "UPI" }
        ]
      },
      {
        name: "party",
        type: "lookup",
        label: "Party",
        lookup: {
          module: "party_master",
          valueField: "id",
          ui: "popup",
          pickerLimit: 25,
          pickerSortBy: "partyName",
          extraLovParams: { f_active: "Yes" },
          pickerColumns: [
            { field: "partyName", header: "Party Name" },
            { field: "address", header: "Address" }
          ]
        }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [{ parent: "unit", child: "npaCurrentAc", lovParam: "f_unit" }],

    reportLayout: {
      title: "LOAN ACCOUNT LEDGER",
      filterSummaryExcludeFields: ["outputFormat"]
    },

    reportStyle: {
      totalRow: { labelColumn: "voucherNo" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      { key: "voucherNo", label: "VOUCHER NO", align: "center", widthExcel: 16, widthHtml: "7.5rem" },
      {
        key: "date",
        label: "DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      {
        key: "unitLabel",
        label: "UNIT",
        align: "left",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "unit"
      },
      {
        key: "transactionType",
        label: "TRANSACTION TYPE",
        align: "center",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "transactionType"
      },
      {
        key: "partyLabel",
        label: "PARTY",
        align: "left",
        widthExcel: 22,
        widthHtml: "11rem",
        hideWhenFilterSet: "party"
      },
      { key: "remarks", label: "REMARKS", align: "left", widthExcel: 24, widthHtml: "10rem" },
      {
        key: "paymentMode",
        label: "PAYMENT MODE",
        align: "center",
        widthExcel: 12,
        widthHtml: "5rem",
        hideWhenFilterSet: "paymentMode"
      },
      {
        key: "npaCurrentAcLabel",
        label: "NPA CURRENT AC",
        align: "left",
        widthExcel: 18,
        widthHtml: "8rem",
        hideWhenFilterSet: "npaCurrentAc"
      },
      { key: "chequeNo", label: "CHEQUE NO", align: "left", widthExcel: 14, widthHtml: "7.5rem" },
      {
        key: "chequeDate",
        label: "CHEQUE DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      { key: "inFavourOf", label: "IN FAVOUR OF", align: "left", widthExcel: 20, widthHtml: "11rem" },
      {
        key: "receiptAmount",
        label: "RECEIPT AMOUNT",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 14,
        widthHtml: "10rem"
      },
      {
        key: "paymentAmount",
        label: "PAYMENT AMOUNT",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 14,
        widthHtml: "10rem"
      }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // Current AC Transfer Ledger — standard table layout. SQL: lib/reports/report_current_ac_transfer_ledger.js

  report_current_ac_transfer_ledger: {
    label: "Current AC Transfer Ledger",
    icon: "➡️",
    group: "Accounts Reports",

    fields: [
      { name: "fromMonth", type: "month", label: "From Month", required: true, default: "currentMonth" },
      { name: "toMonth", type: "month", label: "To Month", required: true, default: "currentMonth" },
      {
        name: "fromCurrentAc",
        type: "lookup",
        label: "From Current AC",
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "toCurrentAc",
        type: "lookup",
        label: "To Current AC",
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    reportLayout: {
      title: "CURRENT AC TRANSFER LEDGER",
      filterSummaryExcludeFields: ["outputFormat"]
    },

    reportStyle: {
      totalRow: { labelColumn: "voucherNo" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      { key: "voucherNo", label: "VOUCHER NO", align: "center", widthExcel: 16, widthHtml: "7.5rem" },
      {
        key: "date",
        label: "DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      {
        key: "fromCurrentAcLabel",
        label: "FROM CURRENT AC",
        align: "left",
        widthExcel: 18,
        widthHtml: "8rem",
        hideWhenFilterSet: "fromCurrentAc"
      },
      {
        key: "toCurrentAcLabel",
        label: "TO CURRENT AC",
        align: "left",
        widthExcel: 18,
        widthHtml: "8rem",
        hideWhenFilterSet: "toCurrentAc"
      },
      { key: "remarks", label: "REMARKS", align: "left", widthExcel: 24, widthHtml: "10rem" },
      {
        key: "amount",
        label: "AMOUNT",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 14,
        widthHtml: "10rem"
      }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // Suspense AC Ledger — standard table layout. SQL: lib/reports/report_suspense_ac_ledger.js

  report_suspense_ac_ledger: {
    label: "Suspense AC Ledger",
    icon: "❓",
    group: "Accounts Reports",

    fields: [
      { name: "fromMonth", type: "month", label: "From Month", required: true, default: "currentMonth" },
      { name: "toMonth", type: "month", label: "To Month", required: true, default: "currentMonth" },
      {
        name: "transactionType",
        type: "select",
        label: "Transaction Type",
        ui: { emptyOptionLabel: "All" },
        options: [
          { label: "Debit", value: "Debit" },
          { label: "Credit", value: "Credit" }
        ]
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    reportLayout: {
      title: "SUSPENSE AC LEDGER",
      filterSummaryExcludeFields: ["outputFormat"]
    },

    reportStyle: {
      totalRow: { labelColumn: "voucherNo" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      { key: "voucherNo", label: "VOUCHER NO", align: "center", widthExcel: 16, widthHtml: "7.5rem" },
      {
        key: "date",
        label: "DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      {
        key: "transactionType",
        label: "TRANSACTION TYPE",
        align: "center",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "transactionType"
      },
      {
        key: "npaCurrentAcLabel",
        label: "NPA CURRENT AC",
        align: "left",
        widthExcel: 18,
        widthHtml: "8rem",
        hideWhenFilterSet: "npaCurrentAc"
      },
      { key: "remarks", label: "REMARKS", align: "left", widthExcel: 24, widthHtml: "10rem" },
      {
        key: "amount",
        label: "AMOUNT",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 14,
        widthHtml: "10rem"
      }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // Invoice Ledger — standard table layout. SQL: lib/reports/report_invoice_ledger.js

  report_invoice_ledger: {
    label: "Invoice Ledger",
    icon: "📄",
    group: "Accounts Reports",

    fields: [
      { name: "month", type: "month", label: "Month", required: true, default: "currentMonth" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        lookup: { module: "branch_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "dataType",
        type: "select",
        label: "Data Type",
        required: true,
        default: "Show Active Invoices",
        options: [
          { label: "Show Active Invoices", value: "Show Active Invoices" },
          { label: "Show Pending Invoices", value: "Show Pending Invoices" },
          { label: "Show Cancelled Invoices", value: "Show Cancelled Invoices" }
        ]
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "unit", child: "npaCurrentAc", lovParam: "f_unit" },
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ],

    reportLayout: {
      title: "INVOICE LEDGER",
      filterSummaryExcludeFields: ["outputFormat"]
    },

    reportStyle: {
      totalRow: { labelColumn: "invoiceNo" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      {
        key: "invoiceDate",
        label: "INVOICE DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      { key: "invoiceNo", label: "INVOICE NO", align: "center", widthExcel: 16, widthHtml: "7.5rem" },
      { key: "caseNo", label: "CASE NO", align: "center", widthExcel: 12, widthHtml: "7.5rem" },
      { key: "borrower", label: "BORROWER", align: "left", widthExcel: 28, widthHtml: "11rem" },
      {
        key: "unitLabel",
        label: "UNIT",
        align: "left",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "unit"
      },
      {
        key: "bankLabel",
        label: "BANK",
        align: "center",
        widthExcel: 10,
        widthHtml: "6rem",
        hideWhenFilterSet: "bank"
      },
      {
        key: "branchLabel",
        label: "BRANCH",
        align: "left",
        widthExcel: 28,
        widthHtml: "12rem",
        hideWhenFilterSet: "branch"
      },
      {
        key: "npaCurrentAcLabel",
        label: "NPA CURRENT AC",
        align: "left",
        widthExcel: 18,
        widthHtml: "8rem",
        hideWhenFilterSet: "npaCurrentAc"
      },
      { key: "finalInvoice", label: "FINAL INVOICE", align: "center", widthExcel: 12, widthHtml: "5rem" },
      {
        key: "grandTotal",
        label: "INVOICE AMOUNT",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 14,
        widthHtml: "10rem"
      }
    ],

    maxRows: 50000
  },

  //**********************************************************************************************************/
  // Invoices Received Ledger — standard table layout. SQL: lib/reports/report_invoices_received_ledger.js

  report_invoices_received_ledger: {
    label: "Invoices Received Ledger",
    icon: "💵",
    group: "Accounts Reports",

    fields: [
      { name: "month", type: "month", label: "Month", required: true, default: "currentMonth" },
      {
        name: "unit",
        type: "lookup",
        label: "Unit",
        lookup: { module: "unit_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "npaCurrentAc",
        type: "lookup",
        label: "NPA Current AC",
        lookup: { module: "current_account_master", valueField: "id" }
      },
      {
        name: "bank",
        type: "lookup",
        label: "Bank",
        lookup: { module: "bank_master", valueField: "id", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "ho_zo",
        type: "lookup",
        label: "HO/ZO",
        lookup: { module: "ho_zo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "rbo_ro",
        type: "lookup",
        label: "RBO/RO",
        lookup: { module: "rbo_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "branch",
        type: "lookup",
        label: "Branch",
        lookup: { module: "branch_master", valueField: "id", ui: "picker", extraLovParams: { f_active: "Yes" } }
      },
      {
        name: "outputFormat",
        type: "select",
        label: "Report Type",
        required: true,
        default: "HTML",
        options: [
          { label: "HTML", value: "HTML" },
          { label: "Excel", value: "Excel" }
        ]
      }
    ],

    filterCascade: [
      { parent: "unit", child: "npaCurrentAc", lovParam: "f_unit" },
      { parent: "bank", child: "ho_zo", lovParam: "f_bank" },
      { parent: "ho_zo", child: "rbo_ro", lovParam: "f_ho_zo" },
      { parent: "rbo_ro", child: "branch", lovParam: "f_rbo_ro" }
    ],

    reportLayout: {
      title: "INVOICES RECEIVED LEDGER",
      filterSummaryExcludeFields: ["outputFormat"]
    },

    reportStyle: {
      totalRow: { labelColumn: "refNo" }
    },

    columns: [
      { key: "slNo", label: "SL. NO.", align: "center", widthExcel: 6, widthHtml: "4.5rem" },
      {
        key: "invoiceDate",
        label: "INVOICE DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      { key: "invoiceNo", label: "INVOICE NO", align: "center", widthExcel: 16, widthHtml: "7.5rem" },
      {
        key: "receivedDate",
        label: "RECEIVED DATE",
        type: "date",
        dateFormat: "dd/MM/yyyy",
        align: "center",
        widthExcel: 12,
        widthHtml: "7rem"
      },
      { key: "refNo", label: "REF NO", align: "center", widthExcel: 16, widthHtml: "7.5rem" },
      { key: "caseNo", label: "CASE NO", align: "center", widthExcel: 12, widthHtml: "7.5rem" },
      { key: "borrower", label: "BORROWER", align: "left", widthExcel: 24, widthHtml: "11rem" },
      {
        key: "unitLabel",
        label: "UNIT",
        align: "left",
        widthExcel: 14,
        widthHtml: "6rem",
        hideWhenFilterSet: "unit"
      },
      {
        key: "bankLabel",
        label: "BANK",
        align: "center",
        widthExcel: 10,
        widthHtml: "6rem",
        hideWhenFilterSet: "bank"
      },
      {
        key: "branchLabel",
        label: "BRANCH",
        align: "left",
        widthExcel: 28,
        widthHtml: "12rem",
        hideWhenFilterSet: "branch"
      },
      {
        key: "npaCurrentAcLabel",
        label: "NPA CURRENT AC",
        align: "left",
        widthExcel: 18,
        widthHtml: "8rem",
        hideWhenFilterSet: "npaCurrentAc"
      },
      {
        key: "billedAmount",
        label: "BILLED AMOUNT",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 14,
        widthHtml: "10rem"
      },
      {
        key: "tdsPercentage",
        label: "TDS LESS %",
        type: "number",
        align: "right",
        widthExcel: 10,
        widthHtml: "5rem"
      },
      {
        key: "tdsAmount",
        label: "TDS AMOUNT",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 14,
        widthHtml: "10rem"
      },
      {
        key: "receivedAmount",
        label: "RECEIVED AMOUNT",
        type: "inr",
        align: "right",
        sum: true,
        widthExcel: 14,
        widthHtml: "10rem"
      },
      { key: "roundOff", label: "ROUND OFF", align: "center", widthExcel: 12, widthHtml: "5rem" }
    ],

    maxRows: 50000
  }

  //**********************************************************************************************************/



};
