-- Reminder Management tables for reminder_master module (config/modules.js).
-- Run after `users` exists. Adjust INT UNSIGNED if your users.id is signed INT.

CREATE TABLE IF NOT EXISTS `reminder_master` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reminderTitle`   VARCHAR(200) NOT NULL,
  `notes`           TEXT NULL,
  `dueDate`         DATE NULL,
  `recurrenceType`  VARCHAR(20) NOT NULL DEFAULT 'None',
  `status`          VARCHAR(30) NOT NULL DEFAULT 'Pending',
  `seriesRootId`    INT UNSIGNED NULL,
  `spawnedFromId`   INT UNSIGNED NULL,
  `createdBy`       INT UNSIGNED NULL,
  `createdDate`     VARCHAR(19) NULL,
  `modifiedBy`      INT UNSIGNED NULL,
  `modifiedDate`    VARCHAR(19) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_reminder_master_createdBy` (`createdBy`),
  KEY `idx_reminder_master_status` (`status`),
  KEY `idx_reminder_master_dueDate` (`dueDate`),
  KEY `idx_reminder_master_recurrenceType` (`recurrenceType`),
  KEY `idx_reminder_master_seriesRootId` (`seriesRootId`),
  KEY `idx_reminder_master_spawnedFromId` (`spawnedFromId`),
  CONSTRAINT `fk_reminder_master_createdBy`
    FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_reminder_master_modifiedBy`
    FOREIGN KEY (`modifiedBy`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_reminder_master_seriesRootId`
    FOREIGN KEY (`seriesRootId`) REFERENCES `reminder_master` (`id`),
  CONSTRAINT `fk_reminder_master_spawnedFromId`
    FOREIGN KEY (`spawnedFromId`) REFERENCES `reminder_master` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reminder_activity_log` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reminderId` INT UNSIGNED NOT NULL,
  `fieldName`  VARCHAR(30) NOT NULL,
  `fromValue`  VARCHAR(200) NULL,
  `toValue`    VARCHAR(200) NOT NULL,
  `changedBy`  INT UNSIGNED NOT NULL,
  `changedAt`  DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_reminder_activity_log_reminderId` (`reminderId`),
  CONSTRAINT `fk_reminder_activity_log_reminder`
    FOREIGN KEY (`reminderId`) REFERENCES `reminder_master` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reminder_activity_log_changedBy`
    FOREIGN KEY (`changedBy`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
