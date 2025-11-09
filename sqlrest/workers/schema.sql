-- SQL REST API Sample Schema for Cloudflare D1
-- Run with: wrangler d1 execute sqlrest-db --file=./schema.sql

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    category TEXT,
    stock_quantity INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- Insert sample data
INSERT OR IGNORE INTO customers (id, name, email, phone, address, city, country) VALUES 
    (1, 'John Doe', 'john.doe@example.com', '+1-555-0101', '123 Main St', 'New York', 'USA'),
    (2, 'Jane Smith', 'jane.smith@example.com', '+1-555-0102', '456 Oak Ave', 'Los Angeles', 'USA'),
    (3, 'Bob Johnson', 'bob.johnson@example.com', '+1-555-0103', '789 Pine Rd', 'Chicago', 'USA'),
    (4, 'Alice Brown', 'alice.brown@example.com', '+1-555-0104', '321 Elm St', 'Houston', 'USA'),
    (5, 'Charlie Wilson', 'charlie.wilson@example.com', '+1-555-0105', '654 Maple Dr', 'Phoenix', 'USA');

INSERT OR IGNORE INTO categories (id, name, description) VALUES 
    (1, 'Electronics', 'Electronic devices and gadgets'),
    (2, 'Clothing', 'Fashion and apparel'),
    (3, 'Books', 'Books and publications'),
    (4, 'Home & Garden', 'Home improvement and garden supplies'),
    (5, 'Sports', 'Sports equipment and gear');

INSERT OR IGNORE INTO products (id, name, sku, price, description, category, stock_quantity) VALUES 
    (1, 'Laptop Pro', 'LP-001', 999.99, 'High-performance laptop with 16GB RAM', 'Electronics', 50),
    (2, 'Wireless Mouse', 'WM-001', 29.99, 'Ergonomic wireless mouse', 'Electronics', 200),
    (3, 'Cotton T-Shirt', 'CT-001', 19.99, '100% cotton t-shirt', 'Clothing', 150),
    (4, 'JavaScript Guide', 'BJ-001', 39.99, 'Complete JavaScript programming guide', 'Books', 75),
    (5, 'Garden Hose', 'GH-001', 49.99, '50-foot expandable garden hose', 'Home & Garden', 30),
    (6, 'Yoga Mat', 'YM-001', 34.99, 'Non-slip exercise yoga mat', 'Sports', 100),
    (7, 'Smartphone', 'SP-001', 699.99, 'Latest smartphone with 5G', 'Electronics', 80),
    (8, 'Running Shoes', 'RS-001', 89.99, 'Professional running shoes', 'Sports', 120);

INSERT OR IGNORE INTO orders (id, customer_id, order_date, status, total_amount) VALUES 
    (1, 1, '2024-01-15 10:30:00', 'completed', 1029.98),
    (2, 2, '2024-01-16 14:20:00', 'pending', 59.98),
    (3, 3, '2024-01-17 09:15:00', 'shipped', 154.97),
    (4, 1, '2024-01-18 16:45:00', 'pending', 789.98),
    (5, 4, '2024-01-19 11:30:00', 'completed', 39.99);

INSERT OR IGNORE INTO order_items (id, order_id, product_id, quantity, unit_price, total_price) VALUES 
    (1, 1, 1, 1, 999.99, 999.99),
    (2, 1, 2, 1, 29.99, 29.99),
    (3, 2, 3, 2, 19.99, 39.98),
    (4, 2, 5, 1, 49.99, 49.99),
    (5, 3, 4, 3, 39.99, 119.97),
    (6, 3, 6, 1, 34.99, 34.99),
    (7, 4, 7, 1, 699.99, 699.99),
    (8, 4, 8, 1, 89.99, 89.99),
    (9, 5, 4, 1, 39.99, 39.99);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
