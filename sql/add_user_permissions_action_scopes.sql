-- Per-action row scopes (View / Edit / Delete). Values: own | unit | all.
-- Run on MySQL after `user_permissions` exists. Safe to run once.

ALTER TABLE user_permissions
  ADD COLUMN view_scope VARCHAR(16) NOT NULL DEFAULT 'all'
    COMMENT 'own | unit | all — list filter scope',
  ADD COLUMN edit_scope VARCHAR(16) NOT NULL DEFAULT 'all'
    COMMENT 'own | unit | all — who may edit rows',
  ADD COLUMN delete_scope VARCHAR(16) NOT NULL DEFAULT 'all'
    COMMENT 'own | unit | all — who may delete rows';

-- Optional: migrate from legacy single scope (data_scope)
-- UPDATE user_permissions SET view_scope = TRIM(LOWER(data_scope)), edit_scope = TRIM(LOWER(data_scope)), delete_scope = TRIM(LOWER(data_scope))
-- WHERE data_scope IS NOT NULL AND TRIM(data_scope) <> '';

-- Optional: migrate from legacy scope_* flags (same scope for all actions)
-- UPDATE user_permissions SET view_scope = 'all', edit_scope = 'all', delete_scope = 'all' WHERE scope_all = 1;
-- UPDATE user_permissions SET view_scope = 'unit', edit_scope = 'unit', delete_scope = 'unit' WHERE scope_unit = 1 AND COALESCE(scope_all,0) = 0;
-- UPDATE user_permissions SET view_scope = 'own', edit_scope = 'own', delete_scope = 'own' WHERE scope_own = 1 AND COALESCE(scope_all,0) = 0 AND COALESCE(scope_unit,0) = 0;
