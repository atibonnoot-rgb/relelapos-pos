# CLAUDE.md — RELELAPOS Development Guide for Claude

## Project Overview
RELELAPOS is an online restaurant ordering system (Subway menu clone), KDS, and POS thermal printer management app.

## Tech Stack
- **Server**: Node.js standard HTTP (`server.js`), compatible with Vercel Serverless (`api/index.js` & `vercel.json`).
- **Database**: Supabase PostgreSQL (`@supabase/supabase-js`, `supabase_client.js`, `supabase_schema.sql`).
- **Storefront Client**: Vanilla JS injected into `eversub.dotpe.in/` via `subway_cart_client.js` and `subway_slider_client.js`.
- **Admin Studio UI**: Single-page application at `admin/index.html`.
- **Hardware Printing**: Thermal printer daemon in `relelapos-printer-daemon/` consuming jobs from `print_store.js`.

## Setup & Commands
- **Install dependencies**: `npm install`
- **Start local server**: `npm start` (runs on `http://localhost:3000`)
- **Storefront URL**: `http://localhost:3000/store/521/1/999`
- **Admin Studio URL**: `http://localhost:3000/admin`

## Development Guidelines
1. **Storefront Bundle**: Do not manually modify minified vendor bundles inside `eversub.dotpe.in/` unless necessary. Feature changes to cart/checkout belong in `subway_cart_client.js`.
2. **Vercel Compatibility**: Keep all routing in `server.js` exportable to `api/index.js` without relying on persistent local filesystem state when deployed.
3. **Environment**: Never hardcode credentials. Use `.env` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
