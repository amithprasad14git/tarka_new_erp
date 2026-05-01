/**
 * =============================================================================
 * After-create hooks (runs before the database “saves for good”)
 * =============================================================================
 * Generic CRUD only runs INSERT. Some screens need extra work in the same breath,
 * e.g. stamping a Case No. Those steps run here on the same connection and inside
 * the same transaction: if anything fails, the new row is rolled back too—no
 * half-saved records.
 *
 * Convention: each module’s custom server logic lives in ONE file under lib/modules/
 * (e.g. newCaseInward.js). Import only its entry point here — do not split one
 * module across multiple lib/modules/<module>*.js files.
 * =============================================================================
 */
import { assignNewCaseInwardCaseNo } from "./modules/newCaseInward";
import { assignPublicNoticeRefNo } from "./modules/publicNotice";
import { assignReturnCaseRefNo } from "./modules/returnCase";
import { assignTransferCaseRefNo } from "./modules/transferCase";

/**
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {string} moduleKey Key from config/modules.js (URL / API module name)
 * @param {number} recordId New row’s primary key from INSERT
 */
export async function runAfterCreateInTransaction(conn, moduleKey, recordId) {
  if (moduleKey === "new_case_inward") {
    await assignNewCaseInwardCaseNo(conn, recordId);
    return;
  }
  if (moduleKey === "transfer_case") {
    await assignTransferCaseRefNo(conn, recordId);
    return;
  }
  if (moduleKey === "public_notice") {
    await assignPublicNoticeRefNo(conn, recordId);
    return;
  }
  if (moduleKey === "return_case") {
    await assignReturnCaseRefNo(conn, recordId);
  }
}
