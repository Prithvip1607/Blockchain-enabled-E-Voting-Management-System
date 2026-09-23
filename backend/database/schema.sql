-- Reference schema. The backend creates this automatically on startup (SQLAlchemy create_all).
CREATE DATABASE IF NOT EXISTS chainvote CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE chainvote;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  voter_id      VARCHAR(64)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt hash
  role          VARCHAR(16)  NOT NULL DEFAULT 'user',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create a dedicated, least-privilege database user (change the password):
-- CREATE USER 'chainvote'@'localhost' IDENTIFIED BY 'change-me';
-- GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX ON chainvote.* TO 'chainvote'@'localhost';
