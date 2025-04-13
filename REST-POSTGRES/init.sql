CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    about TEXT NOT NULL,
    price DECIMAL NOT NULL
);
INSERT INTO products (name, about, price) VALUES
  ('My first game', 'This is an awesome game', '60');

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password TEXT NOT NULL
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    userId INTEGER REFERENCES users(id),  
    total NUMERIC NOT NULL,
    payment BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_products (
    orderId INTEGER REFERENCES orders(id),
    productId INTEGER REFERENCES products(id),
    quantity INTEGER DEFAULT 1, -- quantité de produit
    PRIMARY KEY (orderId, productId)
);

ALTER TABLE products 
ADD COLUMN "reviewIds" INTEGER[] DEFAULT '{}',
ADD COLUMN "averageScore" NUMERIC(3,2) DEFAULT 0;

CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER REFERENCES users(id),
  "productId" INTEGER REFERENCES products(id),
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  content TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_product ON reviews("productId");

CREATE INDEX idx_reviews_user ON reviews("userId");

ALTER TABLE reviews ADD CONSTRAINT unique_user_product UNIQUE ("userId", "productId");

