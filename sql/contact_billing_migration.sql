-- Contact credits, persistent property unlocks, and Razorpay payments
CREATE TABLE IF NOT EXISTS user_contact_wallets (
  user_id INT NOT NULL PRIMARY KEY,
  credits_remaining INT NOT NULL DEFAULT 0,
  free_unlock_used TINYINT(1) NOT NULL DEFAULT 0,
  plan_code VARCHAR(16) NULL,
  plan_expires_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_unlocks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  listing_id INT NOT NULL,
  unlock_type VARCHAR(16) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_contact_unlock (user_id, listing_id),
  KEY idx_contact_unlocks_user (user_id),
  KEY idx_contact_unlocks_listing (listing_id)
);

CREATE TABLE IF NOT EXISTS billing_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan_code VARCHAR(16) NOT NULL,
  amount_paise INT NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  credits_granted INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'created', -- created | failed | paid. Credits are applied only when status becomes paid.
  razorpay_order_id VARCHAR(64) NULL,
  razorpay_payment_id VARCHAR(64) NULL,
  razorpay_signature VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  UNIQUE KEY uk_billing_order (razorpay_order_id),
  KEY idx_billing_payments_user (user_id),
  KEY idx_billing_payments_status (status)
);
