-- Row-level list/edit/delete scope per module (see lib/rowScope.js, User Permissions matrix).
-- Run once against your ERP database.

ALTER TABLE user_permissions
  ADD COLUMN data_scope VARCHAR(16) NOT NULL DEFAULT 'all'
  COMMENT 'all | unit | own'
  AFTER can_delete;
