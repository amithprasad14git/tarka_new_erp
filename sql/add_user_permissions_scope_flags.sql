-- Row scope as three flags (replaces single data_scope text if you prefer).
-- Exactly one should be set per row; the app normalizes on save.
-- Run after `add_user_permissions_data_scope.sql` if you use both, or omit data_scope if unused.

ALTER TABLE user_permissions
  ADD COLUMN scope_all TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '1 = see all rows (within CRUD rights)'
    AFTER can_delete,
  ADD COLUMN scope_unit TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = unit-scoped rows'
    AFTER scope_all,
  ADD COLUMN scope_own TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = own rows only'
    AFTER scope_unit;

-- Optional: backfill from legacy data_scope if present
-- UPDATE user_permissions SET scope_all = 1, scope_unit = 0, scope_own = 0 WHERE data_scope = 'all' OR data_scope IS NULL OR TRIM(data_scope) = '';
-- UPDATE user_permissions SET scope_all = 0, scope_unit = 1, scope_own = 0 WHERE TRIM(LOWER(data_scope)) = 'unit';
-- UPDATE user_permissions SET scope_all = 0, scope_unit = 0, scope_own = 1 WHERE TRIM(LOWER(data_scope)) = 'own';
