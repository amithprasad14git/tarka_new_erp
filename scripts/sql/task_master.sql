-- Task Management tables for task_master module (config/modules.js).
-- Run after `users` exists. Adjust INT UNSIGNED if your users.id is signed INT.

CREATE TABLE IF NOT EXISTS `task_master` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `taskTitle`       VARCHAR(200) NOT NULL,
  `description`     TEXT NULL,
  `assignee`        INT UNSIGNED NOT NULL,
  `followUpPerson`  INT UNSIGNED NULL,
  `dueDate`         DATE NULL,
  `priority`        VARCHAR(20) NOT NULL DEFAULT 'Medium',
  `status`          VARCHAR(30) NOT NULL DEFAULT 'Pending',
  `createdBy`       INT UNSIGNED NULL,
  `createdDate`     VARCHAR(19) NULL,
  `modifiedBy`      INT UNSIGNED NULL,
  `modifiedDate`    VARCHAR(19) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_task_master_assignee` (`assignee`),
  KEY `idx_task_master_followUpPerson` (`followUpPerson`),
  KEY `idx_task_master_status` (`status`),
  KEY `idx_task_master_createdBy` (`createdBy`),
  KEY `idx_task_master_dueDate` (`dueDate`),
  CONSTRAINT `fk_task_master_assignee`
    FOREIGN KEY (`assignee`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_task_master_followUpPerson`
    FOREIGN KEY (`followUpPerson`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_task_master_createdBy`
    FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_task_master_modifiedBy`
    FOREIGN KEY (`modifiedBy`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_status_history` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `taskId`      INT UNSIGNED NOT NULL,
  `fromStatus`  VARCHAR(30) NULL,
  `toStatus`    VARCHAR(30) NOT NULL,
  `changedBy`   INT UNSIGNED NOT NULL,
  `changedAt`   DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_task_status_history_taskId` (`taskId`),
  CONSTRAINT `fk_task_status_history_task`
    FOREIGN KEY (`taskId`) REFERENCES `task_master` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_status_history_changedBy`
    FOREIGN KEY (`changedBy`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_activity_log` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `taskId`     INT UNSIGNED NOT NULL,
  `fieldName`  VARCHAR(30) NOT NULL,
  `fromValue`  VARCHAR(200) NULL,
  `toValue`    VARCHAR(200) NOT NULL,
  `changedBy`  INT UNSIGNED NOT NULL,
  `changedAt`  DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_task_activity_log_taskId` (`taskId`),
  CONSTRAINT `fk_task_activity_log_task`
    FOREIGN KEY (`taskId`) REFERENCES `task_master` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_activity_log_changedBy`
    FOREIGN KEY (`changedBy`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_comments` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `taskId`       INT UNSIGNED NOT NULL,
  `commentText`  TEXT NOT NULL,
  `commentedBy`  INT UNSIGNED NOT NULL,
  `commentedAt`  DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_task_comments_taskId` (`taskId`),
  CONSTRAINT `fk_task_comments_task`
    FOREIGN KEY (`taskId`) REFERENCES `task_master` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_comments_commentedBy`
    FOREIGN KEY (`commentedBy`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional migration for existing databases:
-- ALTER TABLE `task_master`
--   ADD COLUMN `followUpPerson` INT UNSIGNED NULL AFTER `assignee`,
--   ADD KEY `idx_task_master_followUpPerson` (`followUpPerson`),
--   ADD CONSTRAINT `fk_task_master_followUpPerson`
--     FOREIGN KEY (`followUpPerson`) REFERENCES `users` (`id`);
--
-- Backfill activity log from legacy status history:
-- INSERT INTO `task_activity_log` (`taskId`, `fieldName`, `fromValue`, `toValue`, `changedBy`, `changedAt`)
-- SELECT `taskId`, 'status', `fromStatus`, `toStatus`, `changedBy`, `changedAt` FROM `task_status_history`;
