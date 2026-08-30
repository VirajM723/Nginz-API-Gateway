-- NginZ Core Schema Definition

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'CREATED', -- CREATED, PAYMENT_PENDING, PAID, FAILED
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Gateway Configurations Table
CREATE TABLE IF NOT EXISTS gateway_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(255) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Gateway Configuration
INSERT INTO gateway_configs (config_key, config_value)
VALUES 
  ('rate_limit', '{"maxTokens": 100, "refillRate": 100, "windowMs": 60000}'),
  ('circuit_breaker', '{"failureThreshold": 5, "recoveryTimeoutMs": 30000}')
ON CONFLICT (config_key) DO NOTHING;
