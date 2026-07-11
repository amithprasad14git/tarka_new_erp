/**
 * Allow Recovery Invoice without a linked case (config: caseNo optional).
 * Run once per environment after deploying the app change.
 */
ALTER TABLE recovery_invoice MODIFY COLUMN caseNo INT NULL;
