-- Upgrade path: minimal `user_permissions` (id, user_id, module, can_*) → add per-action row scopes.
-- Your current table:
--   id, user_id, module, can_view, can_create, can_edit, can_delete
-- After this script, each row also has view_scope / edit_scope / delete_scope (own | unit | all).
--
-- Run once. If columns already exist, MySQL will error — skip or remove those ADD COLUMN lines.

ALTER TABLE user_permissions
  ADD COLUMN view_scope VARCHAR(16) NOT NULL DEFAULT 'all'
    COMMENT 'own | unit | all — list filter scope'
    AFTER can_delete,
  ADD COLUMN edit_scope VARCHAR(16) NOT NULL DEFAULT 'all'
    COMMENT 'own | unit | all — who may edit rows'
    AFTER view_scope,
  ADD COLUMN delete_scope VARCHAR(16) NOT NULL DEFAULT 'all'
    COMMENT 'own | unit | all — who may delete rows'
    AFTER edit_scope;

-- Existing rows: new columns default to 'all' (see full access for that action until you change it in the UI).
