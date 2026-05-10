// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

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
import { applyAccountsAssetsInvestmentsBeforeWrite } from "./accountsAssetsInvestments";
import { applyAccountsCashDepositWithdrawBeforeWrite } from "./accountsCashDepositWithdraw";
import { applyAccountsCurrentAcTransferBeforeWrite } from "./accountsCurrentAcTransfer";
import { applyAccountsExpenseVoucherBeforeWrite } from "./accountsExpenseVoucher";
import { applyAccountsLoanAcBeforeWrite } from "./accountsLoanAc";
import { applyUserPermissionsBeforeWrite } from "./userPermissions";

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
    requiresUpdateTransaction: true,
    beforeUpdateWrite: async ({ conn, oldRow, merged }) => applyTransferCaseBeforeWrite(conn, { oldRow, merged }),
    beforeCreateWrite: async ({ conn, merged }) => applyTransferCaseBeforeWrite(conn, { oldRow: null, merged }),
    afterUpdateWrite: async ({ conn, oldRow, merged }) => {
      const moved = await applyTransferCaseOwnershipInTransaction(conn, { ...oldRow, ...merged });
      if (!moved?.caseId || !moved?.oldCaseRow || !moved?.newCaseRow) return { extraAuditLogs: [] };
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
    beforeUpdateWrite: async ({ conn, oldRow, merged, childTableRows }) =>
      applyPublicNoticeBeforeWrite(conn, { oldRow, merged, childTableRows }),
    beforeCreateWrite: async ({ conn, merged, childTableRows }) =>
      applyPublicNoticeBeforeWrite(conn, { oldRow: null, merged, childTableRows }),
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
    beforeUpdateWrite: async ({ conn, oldRow, merged, childTableRows, id }) =>
      applyReturnCaseBeforeWrite(conn, {
        oldRow,
        merged,
        childTableRows,
        parentRecordId: Number(id)
      }),
    beforeCreateWrite: async ({ conn, merged, childTableRows }) =>
      applyReturnCaseBeforeWrite(conn, {
        oldRow: null,
        merged,
        childTableRows,
        parentRecordId: null
      })
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
    beforeCreateWrite: async ({ conn, merged }) =>
      applyAccountsCurrentAcTransferBeforeWrite(conn, { oldRow: null, merged }),
    beforeUpdateWrite: async ({ conn, oldRow, merged }) =>
      applyAccountsCurrentAcTransferBeforeWrite(conn, { oldRow, merged })
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
  // Only active users may appear on user_id LoV (config); this enforces the same rule on save.
  user_permissions: {
    requiresUpdateTransaction: true,
    beforeCreateWrite: async ({ conn, merged }) =>
      applyUserPermissionsBeforeWrite(conn, { merged, oldRow: null }),
    beforeUpdateWrite: async ({ conn, oldRow, merged }) =>
      applyUserPermissionsBeforeWrite(conn, { oldRow, merged })
  }
};

export function getCrudModuleAdapter(moduleKey) {
  return ADAPTERS[moduleKey] || null;
}

