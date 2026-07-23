import { existsSync, unlinkSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = new URL("./example.sqlite", import.meta.url).pathname;

if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    signup_date TEXT NOT NULL
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    order_date TEXT NOT NULL
  );
`);

const insertCustomer = db.prepare("INSERT INTO customers (id, name, email, signup_date) VALUES (?, ?, ?, ?)");
insertCustomer.run(1, "Ava Chen", "ava@example.com", "2025-01-10");
insertCustomer.run(2, "Ben Ortiz", "ben@example.com", "2025-02-14");
insertCustomer.run(3, "Carla Diaz", "carla@example.com", "2025-03-02");

const insertProduct = db.prepare("INSERT INTO products (id, name, price_cents) VALUES (?, ?, ?)");
insertProduct.run(1, "Widget", 1999);
insertProduct.run(2, "Gadget", 4999);
insertProduct.run(3, "Gizmo", 2999);

const insertOrder = db.prepare(
  "INSERT INTO orders (id, customer_id, product_id, quantity, order_date) VALUES (?, ?, ?, ?, ?)",
);
insertOrder.run(1, 1, 1, 2, "2025-04-01");
insertOrder.run(2, 1, 2, 1, "2025-04-15");
insertOrder.run(3, 2, 3, 3, "2025-05-01");
insertOrder.run(4, 3, 1, 1, "2025-05-20");
insertOrder.run(5, 3, 3, 2, "2025-06-01");

db.close();

console.log(`Seeded example database at ${DB_PATH}`);
