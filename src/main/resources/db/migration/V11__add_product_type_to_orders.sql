-- V11__add_product_type_to_orders.sql
-- Add missing product_type column to orders table

-- Check if column exists first (for idempotency)
SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'trading'
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'product_type'
);

-- Add column only if it doesn't exist
SET @sql = IF(@col_exists = 0,
              'ALTER TABLE orders ADD COLUMN product_type VARCHAR(20) DEFAULT ''INTRADAY''',
              'SELECT ''Column already exists'' AS message'
           );

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing NULL values (safe even if column exists)
UPDATE orders
SET product_type = 'INTRADAY'
WHERE product_type IS NULL;