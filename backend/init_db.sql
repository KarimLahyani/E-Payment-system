CREATE TABLE IF NOT EXISTS request_info (
    id SERIAL PRIMARY KEY UNIQUE,
    request_type VARCHAR(255),
    pop_id VARCHAR(255),
    ref_number VARCHAR(255),
    workstation_id VARCHAR(255),
    app_sender VARCHAR(255),
    stan VARCHAR(255),
    request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_data (
    id SERIAL PRIMARY KEY,
    pos_timestamp TIMESTAMP,
    language_code VARCHAR(10),
    card_entry_mode VARCHAR(50),
    shift_number VARCHAR(50),
    clerk_id VARCHAR(50),
    pos_name VARCHAR(50),
    global BOOLEAN,
    split BOOLEAN,
    long_format BOOLEAN,
    unattended BOOLEAN,
    waiting_card BOOLEAN,
    choice_pay_kind BOOLEAN,
    request_info_id INTEGER REFERENCES request_info(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS basket_data (
    id SERIAL PRIMARY KEY,
    total_amount VARCHAR(50),
    pre_auth_amount VARCHAR(50),
    currency VARCHAR(10),
    request_info_id INTEGER REFERENCES request_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    name VARCHAR(255),
    product_code VARCHAR(255) PRIMARY KEY,
    unit_price NUMERIC(10, 2),
    unit_measure VARCHAR(50),
    tax_code VARCHAR(50)
);

-- Seed dummy data if the table is empty
INSERT INTO products (name, product_code, unit_price, unit_measure, tax_code)
SELECT 'Premium Unleaded', '101', 1.95, 'L', 'A'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_code = '101');

INSERT INTO products (name, product_code, unit_price, unit_measure, tax_code)
SELECT 'Diesel', '102', 1.85, 'L', 'A'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_code = '102');

INSERT INTO products (name, product_code, unit_price, unit_measure, tax_code)
SELECT 'Coffee', '201', 2.50, 'Unit', 'B'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_code = '201');

INSERT INTO products (name, product_code, unit_price, unit_measure, tax_code)
SELECT 'Car Wash (Basic)', '301', 10.00, 'Unit', 'C'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_code = '301');

INSERT INTO products (name, product_code, unit_price, unit_measure, tax_code)
SELECT 'Sandwich', '202', 5.50, 'Unit', 'B'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE product_code = '202');

CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    basket_data_id INTEGER REFERENCES basket_data(id) ON DELETE CASCADE,
    product_code VARCHAR(255) REFERENCES products(product_code),
    amount VARCHAR(255),
    quantity VARCHAR(255),
    add_prod_code VARCHAR(255),
    reverse_sale VARCHAR(255),
    sale_channel VARCHAR(255),
    rebate_label VARCHAR(255),
    add_prod_info VARCHAR(255),
    pump_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (basket_data_id, product_code)
);

CREATE TABLE IF NOT EXISTS loyalty (
    id SERIAL PRIMARY KEY,
    loyalty_flag BOOLEAN,
    card_entry_mode VARCHAR(50),
    loyalty_card VARCHAR(255),
    loyalty_pan VARCHAR(255),
    card_entry_mode_new VARCHAR(50),
    loyalty_card_new VARCHAR(255),
    loyalty_pan_new VARCHAR(255),
    loyalty_amount VARCHAR(50),
    loyalty_original_amount VARCHAR(50),
    loyalty_approval_code VARCHAR(50),
    loyalty_acquirer_id VARCHAR(50),
    loyalty_acquirer_batch VARCHAR(50),
    bonus_card BOOLEAN,
    request_info_id INTEGER REFERENCES request_info(id) ON DELETE CASCADE,
    loyalty_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS response_info (
    id INTEGER PRIMARY KEY REFERENCES request_info(id) ON DELETE CASCADE,
    request_type VARCHAR(255),
    overall_result VARCHAR(255),
    error_condition VARCHAR(255),
    stan VARCHAR(255),
    terminal_id VARCHAR(255),
    terminal_batch VARCHAR(255),
    amount VARCHAR(255),
    card_number VARCHAR(255),
    customer_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    card_type VARCHAR(255),
    number VARCHAR(255),
    expiry VARCHAR(50),
    passcode VARCHAR(50),
    balance NUMERIC(10, 2),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default cards
INSERT INTO cards (name, card_type, number, expiry, passcode, balance, status)
SELECT 'Karim Lahyani', 'Premium Loyalty', '4532111122229012', '2030-12', '4321', 350.00, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM cards WHERE number = '4532111122229012');

INSERT INTO cards (name, card_type, number, expiry, passcode, balance, status)
SELECT 'John Doe', 'Standard Corporate', '4532333344441044', '2029-05', '2468', 180.00, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM cards WHERE number = '4532333344441044');

INSERT INTO cards (name, card_type, number, expiry, passcode, balance, status)
SELECT 'Blocked Contractor', 'Standard Corporate', '4532555566665520', '2028-09', '1111', 100.00, 'BLOCKED'
WHERE NOT EXISTS (SELECT 1 FROM cards WHERE number = '4532555566665520');

INSERT INTO cards (name, card_type, number, expiry, passcode, balance, status)
SELECT 'Expired Service Card', 'Standard Corporate', '4532777788887780', '2025-01', '9999', 500.00, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM cards WHERE number = '4532777788887780');
