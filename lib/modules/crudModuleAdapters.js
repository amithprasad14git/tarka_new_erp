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
import { applyReturnCaseBeforeWrite } from "./returnCase";

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
  }
};

export function getCrudModuleAdapter(moduleKey) {
  return ADAPTERS[moduleKey] || null;
}

