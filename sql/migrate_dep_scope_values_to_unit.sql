-- Replace legacy scope token `dep` with `unit` in user_permissions (run once if any column ever stored `dep`).
-- Safe if no rows match (0 rows updated).

UPDATE user_permissions
SET view_scope = 'unit'
WHERE LOWER(TRIM(COALESCE(view_scope, ''))) = 'dep';

UPDATE user_permissions
SET edit_scope = 'unit'
WHERE LOWER(TRIM(COALESCE(edit_scope, ''))) = 'dep';

UPDATE user_permissions
SET delete_scope = 'unit'
WHERE LOWER(TRIM(COALESCE(delete_scope, ''))) = 'dep';

UPDATE user_permissions
SET data_scope = 'unit'
WHERE LOWER(TRIM(COALESCE(data_scope, ''))) = 'dep';
