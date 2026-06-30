/**
 * CRUD “adapter” registry — connects each special module to its server rules.
 *
 * Layman terms: when someone clicks Save on a module screen, the shared CRUD service
 * runs first. If that module has an entry here, we call its `lib/modules/<module>.js`
 * helpers (dates, vouchers, case transfers, etc.) before writing to MySQL.
 *
 * Generic modules (simple masters) are NOT listed — they only use `config/modules.js`
 * field rules (`required`, types, etc.).
 *
 * See `config/modules.js` header table and README § “Module-by-module validations”.
 */

import {
  applyNewCaseInwardBeforeWrite,
  applyNewCaseInwardGetByIdLocks,
  assertNewCaseInwardRowEditableByUser
} from "./newCaseInward";
import {
  applyTransferCaseBeforeWrite,
  applyTransferCaseOwnershipInTransaction,
  loadTransferCaseOwnershipRowById
} from "./transferCase";
import { applyPublicNoticeBeforeWrite, buildPublicNoticeUpdateAckBody } from "./publicNotice";
import { syncBranchMasterActiveForRboIfActiveChanged } from "./rboMaster";
import { applyReturnCaseBeforeWrite } from "./returnCase";
import { applySarfaesiCaseStatusUpdateBeforeWrite } from "./sarfaesiCaseStatusUpdate";
import { applyInvoicesReceivedBeforeWrite, normalizeInvoicesReceivedInvoiceFkFields } from "./invoicesReceived";
import { applyAccountsAssetsInvestmentsBeforeWrite } from "./accountsAssetsInvestments";
import { applyAccountsCashDepositWithdrawBeforeWrite } from "./accountsCashDepositWithdraw";
import { applyAccountsCurrentAcTransferBeforeWrite } from "./accountsCurrentAcTransfer";
import { applyAccountsExpenseVoucherBeforeWrite } from "./accountsExpenseVoucher";
import { applyAccountsLoanAcBeforeWrite } from "./accountsLoanAc";
import { applyAccountsSuspenseEntryBeforeWrite } from "./accountsSuspenseEntry";
import { applyUserPermissionsBeforeWrite } from "./userPermissions";
import { applyUsersBeforeWrite } from "./users";
import { applyCurrentAccountOpeningBalanceBeforeWrite } from "./currentAccountOpeningBalance";
import {
  afterRecoveryInvoiceWrite,
  applyRecoveryInvoiceBeforeWrite
} from "./recoveryInvoice";
import {
  afterSarfaesiInvoiceWrite,
  applySarfaesiInvoiceBeforeWrite
} from "./sarfaesiInvoice";
import {
  afterVehicleInvoiceWrite,
  applyVehicleInvoiceBeforeWrite
} from "./vehicleInvoice";
import {
  applyTaskBeforeWrite,
  applyTaskAfterCreateWrite,
  applyTaskAfterUpdateWrite
} from "./task";
import {
  applyReminderBeforeWrite,
  applyReminderAfterCreateWrite,
  applyReminderAfterUpdateWrite
} from "./reminder";

const ADAPTERS = {
  new_case_inward: {
    beforeUpdateExistingRowEditable: async ({ conn, user, oldRow }) =>
      assertNewCaseInwardRowEditableByUser(conn, user, oldRow),
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, childTableRows, id }) =>
      applyNewCaseInwardBeforeWrite(conn, {
        user,
        oldRow,
        merged,
        childTableRows,
        parentId: Number(id)
      }),
    beforeCreateWrite: async ({ conn, user, merged, childTableRows }) =>
      applyNewCaseInwardBeforeWrite(conn, {
        user,
        oldRow: null,
        merged,
        childTableRows,
        parentId: null
      }),
    afterGetById: async ({ conn, user, row }) => applyNewCaseInwardGetByIdLocks(conn, user, row)
  },
  transfer_case: {
    // Ownership change on NCI must commit with the transfer_case row (rollback together on failure).
    requiresUpdateTransaction: true,
    beforeUpdateWrite: async ({ conn, user, oldRow, merged }) =>
      applyTransferCaseBeforeWrite(conn, { oldRow, merged, user }),
    beforeCreateWrite: async ({ conn, user, merged }) =>
      applyTransferCaseBeforeWrite(conn, { oldRow: null, merged, user }),
    afterUpdateWrite: async ({ conn, oldRow, merged }) => {
      const moved = await applyTransferCaseOwnershipInTransaction(conn, { ...oldRow, ...merged });
      if (!moved?.caseId || !moved?.oldCaseRow || !moved?.newCaseRow) return { extraAuditLogs: [] };
      // Audit log shows the case row change even though user saved Transfer Case.
      return {
        extraAuditLogs: [
          {
            moduleName: "new_case_inward",
            action: "update",
            recordId: Number(moved.caseId),
            oldData: moved.oldCaseRow,
            newData: moved.newCaseRow
          }
        ]
      };
    },
    afterCreateWrite: async ({ conn, insertId }) => {
        const transferRow = await loadTransferCaseOwnershipRowById(conn, insertId);
        const moved = await applyTransferCaseOwnershipInTransaction(conn, transferRow || null);
        if (!moved?.caseId || !moved?.oldCaseRow || !moved?.newCaseRow) return { extraAuditLogs: [] };
        // Same extra NCI audit entry as on update — case ownership changed on create too.
        return {
          extraAuditLogs: [
            {
              moduleName: "new_case_inward",
              action: "update",
              recordId: Number(moved.caseId),
              oldData: moved.oldCaseRow,
              newData: moved.newCaseRow
            }
          ]
        };
      }
  },
  public_notice: {
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, childTableRows }) =>
      applyPublicNoticeBeforeWrite(conn, { oldRow, merged, childTableRows, user }),
    beforeCreateWrite: async ({ conn, user, merged, childTableRows }) =>
      applyPublicNoticeBeforeWrite(conn, { oldRow: null, merged, childTableRows, user }),
    buildUpdateResponseBody: ({ moduleConfig, id, savedRow }) =>
      buildPublicNoticeUpdateAckBody(moduleConfig, id, savedRow)
  },
  rbo_master: {
    requiresUpdateTransaction: true,
    afterUpdateWrite: async ({ conn, id, merged, oldRow }) => {
      await syncBranchMasterActiveForRboIfActiveChanged(conn, {
        rboId: Number(id),
        oldRow,
        merged
      });
      return { extraAuditLogs: [] };
    }
  },
  return_case: {
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, childTableRows, id }) =>
      applyReturnCaseBeforeWrite(conn, {
        oldRow,
        merged,
        childTableRows,
        parentRecordId: Number(id),
        user
      }),
    beforeCreateWrite: async ({ conn, user, merged, childTableRows }) =>
      applyReturnCaseBeforeWrite(conn, {
        oldRow: null,
        merged,
        childTableRows,
        parentRecordId: null,
        user
      })
  },
  sarfaesi_case_status_update: {
    // Child particulars + case rules run in lib/modules/sarfaesiCaseStatusUpdate.js before INSERT/UPDATE.
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, childTableRows, id }) =>
      applySarfaesiCaseStatusUpdateBeforeWrite(conn, {
        oldRow,
        merged,
        childTableRows,
        parentRecordId: Number(id),
        user
      }),
    beforeCreateWrite: async ({ conn, user, merged, childTableRows }) =>
      applySarfaesiCaseStatusUpdateBeforeWrite(conn, {
        oldRow: null,
        merged,
        childTableRows,
        parentRecordId: null,
        user
      })
  },
  invoices_received: {
    // One invoice FK + received date / FY freeze — lib/modules/invoicesReceived.js.
    afterGetById: async ({ row }) => normalizeInvoicesReceivedInvoiceFkFields(row),
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, id }) =>
      applyInvoicesReceivedBeforeWrite(conn, {
        oldRow,
        merged,
        parentRecordId: Number(id),
        user
      }),
    beforeCreateWrite: async ({ conn, user, merged }) =>
      applyInvoicesReceivedBeforeWrite(conn, {
        oldRow: null,
        merged,
        parentRecordId: null,
        user
      })
  },
  recovery_invoice: {
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, childTableRows }) =>
      applyRecoveryInvoiceBeforeWrite(conn, { oldRow, merged, childTableRows, user }),
    beforeCreateWrite: async ({ conn, user, merged, childTableRows }) =>
      applyRecoveryInvoiceBeforeWrite(conn, { oldRow: null, merged, childTableRows, user }),
    afterCreateWrite: async ({ conn, insertId, merged }) =>
      afterRecoveryInvoiceWrite(conn, { insertId, merged }),
    afterUpdateWrite: async ({ conn, oldRow, merged, id }) =>
      afterRecoveryInvoiceWrite(conn, { oldRow, merged, id })
  },
  sarfaesi_invoice: {
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, childTableRows }) =>
      applySarfaesiInvoiceBeforeWrite(conn, { oldRow, merged, childTableRows, user }),
    beforeCreateWrite: async ({ conn, user, merged, childTableRows }) =>
      applySarfaesiInvoiceBeforeWrite(conn, { oldRow: null, merged, childTableRows, user }),
    afterCreateWrite: async ({ conn, insertId, merged }) =>
      afterSarfaesiInvoiceWrite(conn, { insertId, merged }),
    afterUpdateWrite: async ({ conn, oldRow, merged, id }) =>
      afterSarfaesiInvoiceWrite(conn, { oldRow, merged, id })
  },
  vehicle_invoice: {
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, childTableRows }) =>
      applyVehicleInvoiceBeforeWrite(conn, { oldRow, merged, childTableRows, user }),
    beforeCreateWrite: async ({ conn, user, merged, childTableRows }) =>
      applyVehicleInvoiceBeforeWrite(conn, { oldRow: null, merged, childTableRows, user }),
    afterCreateWrite: async ({ conn, insertId, merged }) =>
      afterVehicleInvoiceWrite(conn, { insertId, merged }),
    afterUpdateWrite: async ({ conn, oldRow, merged, id }) =>
      afterVehicleInvoiceWrite(conn, { oldRow, merged, id })
  },
  accounts_assets_investments: {
    // No child tables on parent row — force transactional update path so beforeUpdateWrite runs (cheque rules).
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, user, merged }) =>
      applyAccountsAssetsInvestmentsBeforeWrite(conn, { oldRow: null, merged, user, recordId: null }),
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, id }) =>
      applyAccountsAssetsInvestmentsBeforeWrite(conn, {
        oldRow,
        merged,
        user,
        recordId: id != null ? Number(id) : null
      })
  },
  accounts_cash_deposit_withdraw: {
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, user, merged }) =>
      applyAccountsCashDepositWithdrawBeforeWrite(conn, { oldRow: null, merged, user, recordId: null }),
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, id }) =>
      applyAccountsCashDepositWithdrawBeforeWrite(conn, {
        oldRow,
        merged,
        user,
        recordId: id != null ? Number(id) : null
      })
  },
  accounts_current_ac_transfer: {
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, user, merged }) =>
      applyAccountsCurrentAcTransferBeforeWrite(conn, { oldRow: null, merged, user }),
    beforeUpdateWrite: async ({ conn, user, oldRow, merged }) =>
      applyAccountsCurrentAcTransferBeforeWrite(conn, { oldRow, merged, user })
  },
  accounts_expense_voucher: {
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, user, merged }) =>
      applyAccountsExpenseVoucherBeforeWrite(conn, { oldRow: null, merged, user, recordId: null }),
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, id }) =>
      applyAccountsExpenseVoucherBeforeWrite(conn, {
        oldRow,
        merged,
        user,
        recordId: id != null ? Number(id) : null
      })
  },
  // Loan Account: mirrors expense-voucher pattern — transactional save so lib/modules/accountsLoanAc.js can
  // enforce payment mode / NPA / cheque / role-2 unit checks on create & update. Voucher stamp runs separately
  // in lib/moduleAfterCreate.js after INSERT, not here.
  accounts_loan_ac: {
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, user, merged }) =>
      applyAccountsLoanAcBeforeWrite(conn, { oldRow: null, merged, user, recordId: null }),
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, id }) =>
      applyAccountsLoanAcBeforeWrite(conn, {
        oldRow,
        merged,
        user,
        recordId: id != null ? Number(id) : null
      })
  },
  accounts_suspense_entry: {
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, user, merged }) =>
      applyAccountsSuspenseEntryBeforeWrite(conn, { oldRow: null, merged, user }),
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, id }) =>
      applyAccountsSuspenseEntryBeforeWrite(conn, {
        oldRow,
        merged,
        user,
        recordId: id != null ? Number(id) : null
      })
  },
  current_account_opening_balance: {
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, user, merged }) =>
      applyCurrentAccountOpeningBalanceBeforeWrite(conn, { oldRow: null, merged, user }),
    beforeUpdateWrite: async ({ conn, user, oldRow, merged }) =>
      applyCurrentAccountOpeningBalanceBeforeWrite(conn, { oldRow, merged, user })
  },
  users: {
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, merged }) =>
      applyUsersBeforeWrite(conn, { merged, oldRow: null, recordId: null }),
    beforeUpdateWrite: async ({ conn, oldRow, merged, id }) =>
      applyUsersBeforeWrite(conn, { merged, oldRow, recordId: id != null ? Number(id) : null })
  },
  // Only active users may appear on user_id LoV (config); this enforces the same rule on save.
  user_permissions: {
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, merged }) =>
      applyUserPermissionsBeforeWrite(conn, { merged, oldRow: null }),
    beforeUpdateWrite: async ({ conn, oldRow, merged }) =>
      applyUserPermissionsBeforeWrite(conn, { oldRow, merged })
  },
  task_master: {
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, user, merged, childTableRows }) => {
      await applyTaskBeforeWrite(conn, { user, merged, childTableRows });
    },
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, childTableRows }) => {
      await applyTaskBeforeWrite(conn, { user, merged, childTableRows, oldRow });
    },
    afterCreateWrite: async ({ conn, user, merged, insertId }) => {
      await applyTaskAfterCreateWrite(conn, { user, merged, insertId });
    },
    afterUpdateWrite: async ({ conn, user, oldRow, merged, id }) => {
      await applyTaskAfterUpdateWrite(conn, { user, oldRow, merged, id: Number(id) });
    }
  },
  reminder_master: {
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, user, merged, childTableRows }) => {
      await applyReminderBeforeWrite(conn, { user, merged, childTableRows });
    },
    beforeUpdateWrite: async ({ conn, user, oldRow, merged, childTableRows }) => {
      await applyReminderBeforeWrite(conn, { user, merged, childTableRows, oldRow });
    },
    afterCreateWrite: async ({ conn, user, merged, insertId }) => {
      await applyReminderAfterCreateWrite(conn, { user, merged, insertId });
    },
    afterUpdateWrite: async ({ conn, user, oldRow, merged, id }) => {
      await applyReminderAfterUpdateWrite(conn, { user, oldRow, merged, id: Number(id) });
    }
  }
};

export function getCrudModuleAdapter(moduleKey) {
  // Returns hooks for this module’s before/after save rules, or null for generic CRUD only.
  return ADAPTERS[moduleKey] || null;
}

