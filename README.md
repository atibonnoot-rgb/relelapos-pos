# RELELAPOS — Restaurant Online Ordering, KDS & POS System

A high-performance online ordering storefront, kitchen display system (KDS), administrative studio, and hardware thermal printing daemon.

---

## 🌟 Tech Stack & Architecture

- **Backend / Routing**: Node.js HTTP server (`server.js`), deployed seamlessly to **Vercel Serverless** via `api/index.js` and `vercel.json`.
- **Database & Realtime**: [Supabase](https://supabase.com) (PostgreSQL) with Realtime websocket sync for live incoming orders and hardware printer job queues.
- **Frontend Customer Storefront**: Responsive Subway ordering app located in `eversub.dotpe.in/` with client customizations injected by `subway_cart_client.js` and `subway_slider_client.js`.
- **Admin Studio Dashboard**: Full-featured administrative panel located in `admin/index.html` (Orders, Live KDS, Menu Studio, Financial Overview, Banner Manager, Thermal Printer Controls).
- **POS Hardware Daemon**: `relelapos-printer-daemon/` for real-time ESC/POS thermal printing of KOT (Kitchen Order Tickets) and Customer Bills.

---

## 📁 Repository Structure

```text
├── server.js                   # Primary Node.js router, REST APIs, and static server
├── api/
│   └── index.js                # Vercel Serverless Function wrapper
├── admin/
│   └── index.html              # Admin Studio UI (Orders, Menu Studio, Finances, Printers)
├── eversub.dotpe.in/           # Customer storefront static assets (HTML/CSS/JS)
├── subway_cart_client.js       # Customer cart, customization modal, and checkout logic
├── subway_slider_client.js     # Promotional banner slider client script
├── supabase_client.js          # Supabase SDK initialization and fallback handling
├── supabase_schema.sql         # SQL schema definitions for Supabase tables
├── menu_store.js               # Menu categories, items, and variant management
├── cart_handler.js             # Cart pricing, tax calculation, and order construction
├── finance_store.js            # Restaurant sales, tax, and revenue records
├── banner_store.js             # Store banner CRUD
├── print_store.js              # Hardware thermal print job queue manager
├── relelapos-printer-daemon/   # Local background daemon for ESC/POS thermal printers
├── custom_menu.json            # Active restaurant menu database (JSON fallback/cache)
├── banners.json                # Active banner sliders
├── vercel.json                 # Vercel deployment configuration
├── .env.example                # Environment variables template
└── .gitignore                  # Git ignore rules
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18.x or later recommended)
- npm

### 2. Setup
Clone the repository and install dependencies:
```bash
git clone <repository_url>
cd <repository_folder>
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Fill in your Supabase credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
PORT=3000
```

### 4. Database Setup
Execute the SQL script in your Supabase SQL Editor:
- Open `supabase_schema.sql` and run all queries to create `orders`, `print_jobs`, and row security policies.

### 5. Running the Application
```bash
npm start
```
The server will start on port `3000`:
- **Storefront**: [http://localhost:3000/store/521/1/999](http://localhost:3000/store/521/1/999) *(Root `/` redirects here)*
- **Admin Studio**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 🛠️ Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/store/521/1/999` | Main customer ordering storefront |
| `GET` | `/admin` | Admin dashboard & order manager |
| `GET` | `/api/admin/menu` | Get current menu categories & items |
| `POST` | `/api/admin/categories` | Add a new menu category |
| `PUT` | `/api/admin/categories/:id` | Update category details |
| `DELETE` | `/api/admin/categories/:id` | Delete category |
| `POST` | `/api/admin/items` | Add a new menu item |
| `PUT` | `/api/admin/items/:id` | Update item |
| `DELETE` | `/api/admin/items/:id` | Delete item |
| `GET` | `/api/orders` | Fetch orders list / realtime |
| `POST` | `/api/orders` | Submit new customer order |
| `GET` | `/api/printer/jobs` | Hardware printer job polling endpoint |
| `POST` | `/api/printer/claim` | Claim pending print job |
| `POST` | `/api/printer/printed` | Mark print job as completed |

---

## ☁️ Deployment

This project deploys directly to **Vercel**:
- Production entries are routed through `api/index.js` as defined in `vercel.json`.
- Ensure environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are added in **Vercel Project Settings -> Environment Variables**.
