CREATE TABLE IF NOT EXISTS accounts (
  account_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  holder_name VARCHAR(100) NOT NULL,
  pin_hash VARCHAR(60) NOT NULL,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_account_balance CHECK (balance >= 0)
);
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id BIGINT NOT NULL,
  transaction_type VARCHAR(30) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_account FOREIGN KEY (account_id) REFERENCES accounts(account_id),
  INDEX idx_transactions_account_created (account_id, created_at)
);
