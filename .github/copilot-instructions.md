# GitHub Copilot Instructions for RELELAPOS

This project is the RELELAPOS Restaurant Ordering and Point of Sale (POS) system.

## Key Guidelines:
- **Server**: Uses vanilla Node.js HTTP in `server.js`, compatible with Vercel serverless (`api/index.js`).
- **Database**: Supabase (`supabase_client.js`) using `@supabase/supabase-js`. Schema is in `supabase_schema.sql`.
- **Storefront Client**: Custom storefront logic resides in `subway_cart_client.js` and `subway_slider_client.js`.
- **Admin Studio**: `admin/index.html` manages orders, menus, finances, and hardware print queues.
- **Hardware Printing**: Thermal printing queue handled by `print_store.js` and consumed by `relelapos-printer-daemon/`.
- Ensure changes maintain compatibility with both local execution (`npm start`) and Vercel serverless deployments (`vercel.json`).
