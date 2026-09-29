-- =========================================================================
-- SEPARATE DEDICATED ADMIN DATABASE & TABLES SCHEMA FOR FOODSAVER / APP
-- =========================================================================

-- 1. CREATE SEPARATE DATABASE
CREATE DATABASE IF NOT EXISTS `foodsaver_admin_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `foodsaver_admin_db`;

-- -------------------------------------------------------------------------
-- 2. ADMIN ROLES & PERMISSIONS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_roles` (
    `role_id` VARCHAR(30) PRIMARY KEY,
    `role_name` VARCHAR(100) NOT NULL,
    `description` TEXT,
    `can_manage_users` BOOLEAN DEFAULT FALSE NOT NULL,
    `can_manage_merchants` BOOLEAN DEFAULT FALSE NOT NULL,
    `can_manage_ngos` BOOLEAN DEFAULT FALSE NOT NULL,
    `can_view_financials` BOOLEAN DEFAULT FALSE NOT NULL,
    `can_modify_settings` BOOLEAN DEFAULT FALSE NOT NULL,
    `can_view_audit_logs` BOOLEAN DEFAULT FALSE NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 3. DEDICATED ADMIN ACCOUNTS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_accounts` (
    `admin_id` VARCHAR(50) PRIMARY KEY,
    `role_id` VARCHAR(30) NOT NULL,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `phone_number` VARCHAR(30),
    `department` VARCHAR(100) DEFAULT 'Operations',
    `status` ENUM('ACTIVE', 'SUSPENDED', 'PENDING_2FA', 'INACTIVE') DEFAULT 'ACTIVE' NOT NULL,
    `two_factor_enabled` BOOLEAN DEFAULT FALSE NOT NULL,
    `two_factor_secret` VARCHAR(255) NULL,
    `last_login_at` TIMESTAMP NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `failed_login_attempts` INT DEFAULT 0 NOT NULL,
    `locked_until` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_admin_role` FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`role_id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 4. ADMIN AUDIT & ACTIVITY LOGS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
    `log_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `admin_id` VARCHAR(50) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(100) NOT NULL,
    `entity_id` VARCHAR(100) NULL,
    `old_values` JSON NULL,
    `new_values` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `status` ENUM('SUCCESS', 'FAILED', 'WARNING') DEFAULT 'SUCCESS' NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_admin_audit_admin` (`admin_id`),
    INDEX `idx_admin_audit_action` (`action`),
    INDEX `idx_admin_audit_entity` (`entity_type`, `entity_id`),
    INDEX `idx_admin_audit_date` (`created_at`),
    CONSTRAINT `fk_audit_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin_accounts`(`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 5. ADMIN VERIFICATIONS & COMPLIANCE REVIEWS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_verifications` (
    `verification_id` VARCHAR(50) PRIMARY KEY,
    `applicant_id` VARCHAR(50) NOT NULL,
    `applicant_type` ENUM('MERCHANT', 'NGO') NOT NULL,
    `business_or_ngo_name` VARCHAR(200) NOT NULL,
    `registration_number` VARCHAR(100) NULL,
    `document_type` VARCHAR(100) NOT NULL,
    `document_url` TEXT NOT NULL,
    `status` ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REQUEST_CHANGES') DEFAULT 'PENDING' NOT NULL,
    `reviewer_admin_id` VARCHAR(50) NULL,
    `review_notes` TEXT NULL,
    `reviewed_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_verif_status` (`status`),
    INDEX `idx_verif_applicant` (`applicant_id`),
    CONSTRAINT `fk_verif_admin` FOREIGN KEY (`reviewer_admin_id`) REFERENCES `admin_accounts`(`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 6. ADMIN SYSTEM APP CONFIGURATIONS & SETTINGS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_app_settings` (
    `setting_key` VARCHAR(100) PRIMARY KEY,
    `setting_category` VARCHAR(50) DEFAULT 'GENERAL' NOT NULL,
    `setting_value` TEXT NOT NULL,
    `data_type` ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING' NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_public` BOOLEAN DEFAULT FALSE NOT NULL,
    `last_modified_by` VARCHAR(50) NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_setting_admin` FOREIGN KEY (`last_modified_by`) REFERENCES `admin_accounts`(`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 7. ADMIN REALTIME OPERATIONAL NOTIFICATIONS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_notifications` (
    `notification_id` VARCHAR(50) PRIMARY KEY,
    `recipient_admin_id` VARCHAR(50) NULL, -- NULL means broadcast to all admins
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `metadata` JSON NULL,
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL') DEFAULT 'NORMAL' NOT NULL,
    `is_read` BOOLEAN DEFAULT FALSE NOT NULL,
    `read_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_admin_notif_read` (`is_read`),
    INDEX `idx_admin_notif_priority` (`priority`),
    CONSTRAINT `fk_notif_admin` FOREIGN KEY (`recipient_admin_id`) REFERENCES `admin_accounts`(`admin_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 8. ADMIN ANALYTICS & METRICS SNAPSHOTS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_metrics_snapshots` (
    `snapshot_id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `snapshot_type` ENUM('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY') DEFAULT 'DAILY' NOT NULL,
    `snapshot_date` DATE NOT NULL,
    `total_merchants_active` INT DEFAULT 0 NOT NULL,
    `total_customers_active` INT DEFAULT 0 NOT NULL,
    `total_ngos_active` INT DEFAULT 0 NOT NULL,
    `total_meals_saved` INT DEFAULT 0 NOT NULL,
    `total_gross_merchandise_value` DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    `total_platform_revenue` DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    `total_co2_kg_avoided` DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_snapshot_date_type` (`snapshot_date`, `snapshot_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 9. ADMIN ACTIVE SESSIONS & API ACCESS TOKENS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_access_tokens` (
    `token_id` VARCHAR(50) PRIMARY KEY,
    `admin_id` VARCHAR(50) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL UNIQUE,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `is_revoked` BOOLEAN DEFAULT FALSE NOT NULL,
    `expires_at` TIMESTAMP NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_token_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin_accounts`(`admin_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- 10. SEED INITIAL ROLES & SUPER ADMIN ACCOUNT
-- -------------------------------------------------------------------------
INSERT INTO `admin_roles` (`role_id`, `role_name`, `description`, `can_manage_users`, `can_manage_merchants`, `can_manage_ngos`, `can_view_financials`, `can_modify_settings`, `can_view_audit_logs`)
VALUES 
('SUPER_ADMIN', 'Super Administrator', 'Full unrestricted platform and administrative authority', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE),
('OPS_ADMIN', 'Operations Admin', 'Manages merchant onboarding, verification reviews, and support', TRUE, TRUE, TRUE, FALSE, FALSE, TRUE),
('FINANCE_ADMIN', 'Finance Administrator', 'Manages platform payouts, settlements, and financial metrics', FALSE, FALSE, FALSE, TRUE, FALSE, TRUE),
('AUDITOR', 'Compliance Auditor', 'Read-only access for compliance, audit trails, and logs', FALSE, FALSE, FALSE, FALSE, FALSE, TRUE)
ON DUPLICATE KEY UPDATE `role_name` = VALUES(`role_name`);

-- Seed Default Master System Administrator Account (Password: Admin@12345)
-- Bcrypt Hash: $2a$10$R9h/cIPz0gi.URNNWBROlOKFfP0G34n7/5G0Q30q8k/Eep6gA8J1q
INSERT INTO `admin_accounts` (`admin_id`, `role_id`, `email`, `password_hash`, `full_name`, `phone_number`, `department`, `status`)
VALUES 
('adm_master_1', 'SUPER_ADMIN', 'admin@foodsaver.com', '$2a$10$R9h/cIPz0gi.URNNWBROlOKFfP0G34n7/5G0Q30q8k/Eep6gA8J1q', 'Master System Admin', '+91 98765 00000', 'Executive Engineering', 'ACTIVE')
ON DUPLICATE KEY UPDATE `status` = 'ACTIVE';

-- Seed Default Admin Application Settings
INSERT INTO `admin_app_settings` (`setting_key`, `setting_category`, `setting_value`, `data_type`, `description`, `is_public`, `last_modified_by`)
VALUES
('platform_name', 'BRANDING', 'FoodSaver Direct Connect', 'STRING', 'Global platform application name', TRUE, 'adm_master_1'),
('nearby_discovery_radius_km', 'GEO_LOCATION', '2.0', 'NUMBER', 'Customer food rescue discovery radius in kilometers', TRUE, 'adm_master_1'),
('ngo_donation_radius_km', 'GEO_LOCATION', '5.0', 'NUMBER', 'NGO surplus food donation notification radius in kilometers', TRUE, 'adm_master_1'),
('platform_commission_pct', 'FINANCIAL', '5.0', 'NUMBER', 'Percentage platform fee charged per completed order', FALSE, 'adm_master_1'),
('maintenance_mode', 'SYSTEM', 'false', 'BOOLEAN', 'Global emergency maintenance lock toggle', TRUE, 'adm_master_1')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
