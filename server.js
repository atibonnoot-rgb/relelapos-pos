try {
  require('dotenv').config();
} catch (e) {}

process.on('uncaughtException', (err) => {
  console.error('Server Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('Server Unhandled Rejection:', reason);
});

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const menuStore = require('./menu_store');
const financeStore = require('./finance_store');
const bannerStore = require('./banner_store');
const printStore = require('./print_store');
const cartHandler = require('./cart_handler');

// Security token for KOT & POS hardware thermal printer daemon
const PRINTER_SECRET = process.env.PRINTER_SECRET || 'relelapos_pos_secret_token_7733';

function isPrinterAuthorized(req, parsedUrl) {
  const headerToken = req.headers['x-printer-secret'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  const queryToken = parsedUrl.searchParams.get('secret');
  return (headerToken === PRINTER_SECRET || queryToken === PRINTER_SECRET);
}

// Local POS Daemon push disabled per user request:
function callPosDaemon(order, isReprint) {
  return;
}
// -----------------------------------------------------------------

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const EVERSUB_DIR = path.join(BASE_DIR, 'eversub.dotpe.in');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp'
};

function proxyRequest(req, res, targetHost) {
  const cleanHeaders = { ...req.headers };
  delete cleanHeaders['host'];
  delete cleanHeaders['origin'];
  delete cleanHeaders['referer'];

  const options = {
    hostname: targetHost,
    port: 443,
    path: req.url,
    method: req.method,
    headers: {
      ...cleanHeaders,
      host: targetHost,
      origin: 'https://eversub.dotpe.in',
      referer: 'https://eversub.dotpe.in/store/521/1/999'
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    proxyRes.on('error', (err) => {
      console.error('proxyRes error:', err.message);
    });
    const headers = { ...proxyRes.headers, 'Access-Control-Allow-Origin': '*' };
    delete headers['content-security-policy'];
    delete headers['x-frame-options'];
    if (!res.headersSent) {
      res.writeHead(proxyRes.statusCode, headers);
    }
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`Proxy to ${targetHost} error:`, err.message);
    if (!res.headersSent) {
      try {
        res.writeHead(502);
        res.end('Proxy error: ' + err.message);
      } catch(e) {}
    }
  });

  req.on('error', () => {
    try { proxyReq.destroy(); } catch(e) {}
  });

  res.on('error', () => {
    try { proxyReq.destroy(); } catch(e) {}
  });

  req.pipe(proxyReq);
}

function fetchAndCache(url, localPath, res) {
  const getReq = https.get(url, (proxyRes) => {
    proxyRes.on('error', (err) => console.error('fetchAndCache proxyRes error:', err.message));
    if (proxyRes.statusCode === 200) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      const isGzip = proxyRes.headers['content-encoding'] === 'gzip';
      const fileStream = fs.createWriteStream(localPath);
      fileStream.on('error', (err) => console.error('fileStream error:', err.message));

      if (!res.headersSent) {
        res.writeHead(200, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*'
        });
      }

      if (isGzip) {
        const gunzip = zlib.createGunzip();
        gunzip.on('error', (err) => console.error('gunzip error:', err.message));
        proxyRes.pipe(gunzip).pipe(fileStream);
        proxyRes.pipe(res);
      } else {
        proxyRes.pipe(fileStream);
        proxyRes.pipe(res);
      }
    } else {
      if (!res.headersSent) {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'text/plain' });
        res.end(`Not found: ${proxyRes.statusCode}`);
      }
    }
  });

  getReq.on('error', (err) => {
    if (!res.headersSent) {
      try {
        res.writeHead(502);
        res.end('Fetch error: ' + err.message);
      } catch(e) {}
    }
  });

  res.on('error', () => {
    try { getReq.destroy(); } catch(e) {}
  });
}

function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`[${req.method}] ${pathname}`);

  // Root redirect directly to store
  if (pathname === '/' || pathname === '/index.html' || pathname === '/mobile' || pathname === '/mobile-view.html') {
    res.writeHead(302, { 'Location': '/store/521/1/999' });
    res.end();
    return;
  }

  // HTTrack mirror paths redirect (strip .html as well)
  if (pathname.startsWith('/eversub.dotpe.in/')) {
    let newPath = pathname.replace('/eversub.dotpe.in', '');
    if (newPath.endsWith('.html')) newPath = newPath.replace(/\.html$/, '');
    res.writeHead(302, { 'Location': newPath });
    res.end();
    return;
  }

  // If path ends with 999.html, redirect to 999
  if (pathname.endsWith('/999.html')) {
    res.writeHead(302, { 'Location': pathname.replace(/\.html$/, '') });
    res.end();
    return;
  }

  // Redirect undefined or null store paths
  if (pathname.endsWith('/undefined') || pathname.endsWith('/null')) {
    res.writeHead(302, { 'Location': '/store/521/1/999' });
    res.end();
    return;
  }

  // Intercept GTM & 3rd-party analytics to prevent 404 HTML SyntaxError
  if (pathname.includes('googletagmanager') || pathname.includes('gtm') || pathname.includes('google-analytics') || pathname.includes('criteo') || pathname.includes('connect.facebook.net')) {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end('/* gtm & analytics mock */ window.dataLayer = window.dataLayer || [];');
    return;
  }

  // Admin Studio Dashboard route
  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/index.html') {
    const adminHtml = path.join(BASE_DIR, 'admin', 'index.html');
    if (fs.existsSync(adminHtml)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(adminHtml).pipe(res);
      return;
    }
  }

  // Admin REST APIs
  if (pathname.startsWith('/api/admin/')) {
    const adminPath = pathname.slice('/api/admin/'.length);

    // GET /api/admin/menu
    if (adminPath === 'menu' && req.method === 'GET') {
      const data = menuStore.getMenu();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // POST /api/admin/categories
    if (adminPath === 'categories' && req.method === 'POST') {
      parseBody(req).then(body => {
        const cat = menuStore.addCategory(body);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cat));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // PUT /api/admin/categories/:id
    if (adminPath.startsWith('categories/') && req.method === 'PUT') {
      const id = adminPath.slice('categories/'.length);
      parseBody(req).then(body => {
        const cat = menuStore.updateCategory(id, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cat));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // DELETE /api/admin/categories/:id
    if (adminPath.startsWith('categories/') && req.method === 'DELETE') {
      const id = adminPath.slice('categories/'.length);
      try {
        const result = menuStore.deleteCategory(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
      return;
    }

    // POST /api/admin/items
    if (adminPath === 'items' && req.method === 'POST') {
      parseBody(req).then(body => {
        const item = menuStore.addItem(body);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(item));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // PUT /api/admin/items/:id
    if (adminPath.startsWith('items/') && req.method === 'PUT') {
      const id = adminPath.slice('items/'.length);
      parseBody(req).then(body => {
        const item = menuStore.updateItem(id, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(item));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // DELETE /api/admin/items/:id
    if (adminPath.startsWith('items/') && req.method === 'DELETE') {
      const id = adminPath.slice('items/'.length);
      try {
        const result = menuStore.deleteItem(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
      return;
    }

    // POST /api/admin/reset
    if (adminPath === 'reset' && req.method === 'POST') {
      const data = menuStore.resetMenu();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // POST/PUT/PATCH /api/admin/items/:id/status (Toggle In-Stock / 86)
    if (adminPath.startsWith('items/') && adminPath.endsWith('/status')) {
      const parts = adminPath.split('/');
      const id = parts[1];
      try {
        const item = menuStore.toggleItemStatus(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(item));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
      return;
    }

    // --- RESTAURANT FINANCE & POS APIS ---

    // GET /api/admin/finances (Full financial summary & reports)
    if (adminPath === 'finances' && req.method === 'GET') {
      const summary = financeStore.calculateSummary();
      const raw = financeStore.getFinances();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ summary, data: raw }));
      return;
    }

    // POST /api/admin/orders (Create POS / Online order)
    if (adminPath === 'orders' && req.method === 'POST') {
      parseBody(req).then(body => {
        const order = financeStore.createOrder(body);
        printStore.enqueuePrintJob(order, financeStore.getFinances().storeInfo);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(order));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // PUT/PATCH /api/admin/orders/:id/status (Update order status: New -> In Kitchen -> Ready -> Completed)
    if (adminPath.startsWith('orders/') && adminPath.endsWith('/status')) {
      const parts = adminPath.split('/');
      const orderId = parts[1];
      parseBody(req).then(body => {
        const updated = financeStore.updateOrderStatus(orderId, body.status);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(updated));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // DELETE /api/admin/orders/:id (or POST /api/admin/orders/:id/delete)
    if (adminPath.startsWith('orders/') && (req.method === 'DELETE' || adminPath.endsWith('/delete'))) {
      const orderId = adminPath.slice('orders/'.length).replace(/\/delete$/, '');
      try {
        const removed = financeStore.deleteOrder(orderId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(removed));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
      return;
    }

    // POST /api/admin/expenses (Add petty cash / daily store expense)
    if (adminPath === 'expenses' && req.method === 'POST') {
      parseBody(req).then(body => {
        const exp = financeStore.addExpense(body);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(exp));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // DELETE /api/admin/expenses/:id
    if (adminPath.startsWith('expenses/') && req.method === 'DELETE') {
      const expId = adminPath.slice('expenses/'.length);
      try {
        const removed = financeStore.deleteExpense(expId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(removed));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
      return;
    }

    // POST /api/admin/cash-drawer/settle (Close & settle cash drawer float)
    if (adminPath === 'cash-drawer/settle' && req.method === 'POST') {
      parseBody(req).then(body => {
        const settlement = financeStore.settleCashDrawer(body.actualCountedCash);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(settlement));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // POST /api/admin/cash-drawer/reset-shift (Open new cashier shift)
    if (adminPath === 'cash-drawer/reset-shift' && req.method === 'POST') {
      parseBody(req).then(body => {
        const shift = financeStore.resetDayShift(body.openingFloat);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(shift));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // PUT/PATCH /api/admin/inventory/:id
    if (adminPath.startsWith('inventory/') && (req.method === 'PUT' || req.method === 'PATCH')) {
      const invId = adminPath.slice('inventory/'.length);
      parseBody(req).then(body => {
        const inv = financeStore.updateInventoryItem(invId, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(inv));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // --- BANNER SLIDER MANAGEMENT APIS ---

    // GET /api/admin/banners
    if (adminPath === 'banners' && req.method === 'GET') {
      const banners = bannerStore.getBanners();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(banners));
      return;
    }

    // POST /api/admin/banners (Add new banner)
    if (adminPath === 'banners' && req.method === 'POST') {
      parseBody(req).then(body => {
        const banner = bannerStore.addBanner(body);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(banner));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // PUT /api/admin/banners/:id (Update banner)
    if (adminPath.startsWith('banners/') && req.method === 'PUT') {
      const id = adminPath.slice('banners/'.length);
      parseBody(req).then(body => {
        const banner = bannerStore.updateBanner(id, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(banner));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // POST /api/admin/banners/:id/toggle (Toggle active state)
    if (adminPath.startsWith('banners/') && adminPath.endsWith('/toggle')) {
      const id = adminPath.slice('banners/'.length).replace(/\/toggle$/, '');
      try {
        const banner = bannerStore.toggleBanner(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(banner));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
      return;
    }

    // DELETE /api/admin/banners/:id
    if (adminPath.startsWith('banners/') && req.method === 'DELETE') {
      const id = adminPath.slice('banners/'.length);
      try {
        const removed = bannerStore.deleteBanner(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(removed));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
      return;
    }

    // POST /api/admin/banners/reorder
    if (adminPath === 'banners/reorder' && req.method === 'POST') {
      parseBody(req).then(body => {
        const banners = bannerStore.reorderBanners(body.ids);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(banners));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // POST /api/admin/banners/upload (Upload image file)
    if (adminPath === 'banners/upload' && req.method === 'POST') {
      parseBody(req).then(body => {
        if (!body.imageBase64) {
          throw new Error('No image data provided');
        }
        const fileUrl = bannerStore.saveUploadedImage(body.imageBase64, body.fileName);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url: fileUrl }));
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      });
      return;
    }

    // POST /api/admin/banners/reset
    if (adminPath === 'banners/reset' && req.method === 'POST') {
      const banners = bannerStore.resetBanners();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(banners));
      return;
    }
  }

  // Intercept ANY Store Catalog API: Return custom editable menu instantly (0ms)
  if (pathname.includes('/catalog/') && (pathname.includes('/menu') || pathname.endsWith('/catalog') || pathname.includes('/mstore/'))) {
    const catalogData = menuStore.getStoreCatalog();
    const jsonStr = JSON.stringify(catalogData);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(jsonStr),
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(jsonStr);
    return;
  }

  // Intercept Merchant and Store info APIs to eliminate dotpe proxy lag and 401s
  if (pathname.startsWith('/api/merchant/external/store/')) {
    const jsonStr = JSON.stringify({
      status: true,
      store: {
        storeId: 521,
        merchantId: 21751,
        name: "Subway",
        serviceType: "instore",
        status: "ACTIVE",
        isOpen: true
      }
    });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(jsonStr),
      'Access-Control-Allow-Origin': '*'
    });
    res.end(jsonStr);
    return;
  }

  if (pathname.startsWith('/api/merchant/external/merchant/info')) {
    const jsonStr = JSON.stringify({
      status: true,
      merchant: {
        merchantId: 21751,
        name: "Subway",
        status: "ACTIVE"
      }
    });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(jsonStr),
      'Access-Control-Allow-Origin': '*'
    });
    res.end(jsonStr);
    return;
  }

  if (pathname.startsWith('/api/location/serviceability/')) {
    const jsonStr = JSON.stringify({ status: true, serviceable: true });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(jsonStr),
      'Access-Control-Allow-Origin': '*'
    });
    res.end(jsonStr);
    return;
  }

  // Intercept Cart APIs to allow newly added custom items and original items to be added seamlessly
  if (pathname === '/api/cart' || pathname === '/api/cart/' || pathname === '/api/cart/super') {
    if (req.method === 'POST') {
      parseBody(req).then(body => {
        const cartResponse = cartHandler.calculateCart(body);
        const jsonStr = JSON.stringify(cartResponse);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonStr),
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(jsonStr);
      }).catch(err => {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: false, error: err.message }));
      });
      return;
    }
    if (req.method === 'GET') {
      const cartResponse = cartHandler.getActiveCart();
      const jsonStr = JSON.stringify(cartResponse);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonStr),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(jsonStr);
      return;
    }
  }

  // Intercept Cart Validate API
  if (pathname === '/api/cart/validate' && req.method === 'POST') {
    parseBody(req).then(body => {
      const cartResponse = cartHandler.calculateCart(body);
      const jsonStr = JSON.stringify({
        status: true,
        data: {
          status: true,
          cart: cartResponse.cart,
          isCartValid: true,
          modifiedItems: {},
          removedItems: []
        }
      });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonStr),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(jsonStr);
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: false, error: err.message }));
    });
    return;
  }

  // Customer Store Order Placement API: Creates order in financeStore (restaurant_finances.json & Supabase)
  if ((pathname === '/api/order' || pathname === '/api/orders' || pathname === '/api/checkout' || pathname === '/api/cart/checkout' || pathname === '/api/cart/fd/checkout' || pathname === '/api/cart/super/checkout') && req.method === 'POST') {
    parseBody(req).then(async body => {
      const order = await financeStore.createOrder(body);
      const storeInfo = financeStore.getFinances().storeInfo;
      // Enqueue order for the counter POS laptop to pick up and print
      await printStore.enqueuePrintJob(order, storeInfo);

      const jsonStr = JSON.stringify({ status: true, order });
      res.writeHead(201, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonStr),
        'Access-Control-Allow-Origin': '*'
      });
      res.end(jsonStr);
    }).catch(err => {
      const errStr = JSON.stringify({ status: false, error: err.message });
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(errStr),
        'Access-Control-Allow-Origin': '*'
      });
      res.end(errStr);
    });
    return;
  }

  // --- REALTIME PRINTER DAEMON APIS (Diamond Precision & Idempotent) ---

  // GET /api/printer/jobs (Claim pending unprinted jobs for a printer device)
  if (pathname === '/api/printer/jobs' && req.method === 'GET') {
    if (!isPrinterAuthorized(req, parsedUrl)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ status: false, error: 'Unauthorized: Invalid or missing printer security token' }));
      return;
    }

    const deviceId = parsedUrl.searchParams.get('deviceId') || req.headers['x-device-id'] || 'daemon-laptop';
    const leaseSeconds = parseInt(parsedUrl.searchParams.get('lease')) || 60;
    printStore.claimPendingJobs(deviceId, leaseSeconds).then(jobs => {
      const jsonStr = JSON.stringify({ status: true, jobs, count: jobs.length, deviceId });
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonStr),
        'Access-Control-Allow-Origin': '*'
      });
      res.end(jsonStr);
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ status: false, error: err.message }));
    });
    return;
  }

  // POST /api/printer/ack (Acknowledge successful printing -> permanently marks printed)
  if (pathname === '/api/printer/ack' && req.method === 'POST') {
    if (!isPrinterAuthorized(req, parsedUrl)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ status: false, error: 'Unauthorized: Invalid or missing printer security token' }));
      return;
    }

    parseBody(req).then(async body => {
      const { jobId, deviceId, status } = body;
      const result = await printStore.acknowledgePrintJob(jobId, deviceId || 'daemon-laptop', status || 'PRINTED');
      const jsonStr = JSON.stringify(result);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonStr),
        'Access-Control-Allow-Origin': '*'
      });
      res.end(jsonStr);
    }).catch(err => {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(err.message);
    });
    return;
  }

  // POST /api/printer/reprint/:id (Admin & Storefront manual reprint trigger)
  if (pathname.startsWith('/api/printer/reprint/') && req.method === 'POST') {
    if (!isPrinterAuthorized(req, parsedUrl)) {
      res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ status: false, error: 'Unauthorized: Invalid or missing printer security token' }));
      return;
    }

    const orderId = pathname.slice('/api/printer/reprint/'.length);
    const storeInfo = financeStore.getFinances().storeInfo;
    const job = printStore.reprintOrder(orderId, storeInfo);
    let printResult = { success: true, queued: true };
    const jsonStr = JSON.stringify({ status: true, job, printResult });
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(jsonStr),
      'Access-Control-Allow-Origin': '*'
    });
    res.end(jsonStr);
    return;
  }

  // GET /api/printer/status (Monitor print queue status and pos daemon health)
  if (pathname === '/api/printer/status' && req.method === 'GET') {
    const queueStatus = printStore.getQueueStatus();

    // Quick check to POS Daemon on port 5001
    const checkDaemon = new Promise((resolve) => {
      const dReq = http.get(`http://127.0.0.1:${POS_DAEMON_PORT}/api/status`, { timeout: 400 }, (dRes) => {
        let raw = '';
        dRes.on('data', c => raw += c);
        dRes.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch(e) { resolve({ online: true }); }
        });
      });
      dReq.on('error', () => resolve({ online: false, error: 'ECONNREFUSED' }));
      dReq.on('timeout', () => { dReq.destroy(); resolve({ online: false, error: 'TIMEOUT' }); });
    });

    checkDaemon.then((daemonInfo) => {
      const payload = {
        status: true,
        ...queueStatus,
        daemon: daemonInfo
      };
      const jsonStr = JSON.stringify(payload);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonStr),
        'Access-Control-Allow-Origin': '*'
      });
      res.end(jsonStr);
    });
    return;
  }

  // Promo Banners API: return customized banner slider from bannerStore
  if (pathname.includes('/banners') && (pathname.includes('/merchant/') || pathname.includes('/21751'))) {
    const promoData = { promoBanners: bannerStore.getPromoBanners() };
    const jsonStr = JSON.stringify(promoData);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(jsonStr),
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(jsonStr);
    return;
  }

  // Serve uploaded banner images
  if (pathname.startsWith('/uploads/banners/')) {
    const filename = path.basename(pathname);
    const localFile = path.join(BASE_DIR, 'uploads', 'banners', filename);
    if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
      const ext = path.extname(localFile).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'image/png',
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(localFile).pipe(res);
      return;
    }
  }

  // API calls proxy to api.dotpe.in
  if (pathname.startsWith('/api/')) {
    req.url = req.url.replace(/([?&])domain=[^&]*/, '$1referer=eversub');
    req.url = req.url.replace(/([?&])mDomain=[^&]*/, '$1referer=eversub');
    proxyRequest(req, res, 'api.dotpe.in');
    return;
  }

  // Static files handling
  if (pathname.startsWith('/static/')) {
    const relativeStatic = pathname.slice('/static/'.length);
    const localStaticFile = path.join(EVERSUB_DIR, 'static', relativeStatic);

    if (fs.existsSync(localStaticFile) && fs.statSync(localStaticFile).isFile()) {
      const ext = path.extname(localStaticFile).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(localStaticFile).pipe(res);
      return;
    }

    const cdnStaticFile = path.join(BASE_DIR, 'cdn.dotpe.in', 'static', relativeStatic);
    if (fs.existsSync(cdnStaticFile) && fs.statSync(cdnStaticFile).isFile()) {
      const ext = path.extname(cdnStaticFile).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(cdnStaticFile).pipe(res);
      return;
    }

    fetchAndCache(`https://eversub.dotpe.in${pathname}`, localStaticFile, res);
    return;
  }

  // Self-unregistering Service Worker to ensure clean live updates
  if (pathname === '/worker.js' || pathname === '/service-worker.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end('self.addEventListener("install", () => self.skipWaiting()); self.addEventListener("activate", () => self.registration.unregister());');
    return;
  }

  // Mirrors subdirectories (cdn.dotpe.in, etc.)
  for (const domain of ['cdn.dotpe.in', 'assets.loginwithamazon.com', 'dynamic.criteo.com', 'www.google-analytics.com', 'connect.facebook.net']) {
    if (pathname.startsWith(`/${domain}/`)) {
      const rel = pathname.slice(`/${domain}/`.length);
      const localFile = path.join(BASE_DIR, domain, rel);
      if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
        const ext = path.extname(localFile).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(localFile).pipe(res);
        return;
      }
    }
  }

  // Direct files check
  const possibleLocalFile = path.join(BASE_DIR, pathname);
  if (fs.existsSync(possibleLocalFile) && fs.statSync(possibleLocalFile).isFile()) {
    const ext = path.extname(possibleLocalFile).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': (ext === '.js' || ext === '.css' || ext === '.html') ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600'
    });
    fs.createReadStream(possibleLocalFile).pipe(res);
    return;
  }

  // Root URL redirect to Store SPA
  if (pathname === '/' || pathname === '') {
    res.writeHead(302, { 'Location': '/store/521/1/999' });
    res.end();
    return;
  }

  // Store SPA routes
  if (pathname.startsWith('/store') || pathname.startsWith('/cart') || pathname.startsWith('/order') || pathname.startsWith('/catalog')) {
    // Direct store HTML - display all items and categories directly on the main screen

    // Direct store HTML
    const storeHtml = path.join(EVERSUB_DIR, 'store', '521', '1', '999.html');
    if (fs.existsSync(storeHtml)) {
      try {
        let htmlContent = fs.readFileSync(storeHtml, 'utf8');

        // Disable service worker to prevent registration/caching errors on mobile
        htmlContent = htmlContent.replace('"serviceWorker"in navigator', 'false');

        // Neutralize heavy blocking third-party tracking scripts cleanly without syntax errors
        htmlContent = htmlContent.replace(/<script[^>]*assets\.loginwithamazon\.com[^>]*><\/script>/gi, '');
        htmlContent = htmlContent.replace(/<script[^>]*dynamic\.criteo\.com[^>]*><\/script>/gi, '');
        htmlContent = htmlContent.replace(/<script>!function\(e,a,t,n,g,o,c\)[\s\S]*?ga\("send","pageview"\)<\/script>/gi, '');
        htmlContent = htmlContent.replace(/<script type="text\/javascript">window\.onAmazonLoginReady=[\s\S]*?login1\.js.*?\(document\)<\/script>/gi, '');

        const mobileInnerStyle = `
        <style id="mobile-inner-patch">
          /* Universal reset & scrollbar cleanup */
          * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
            box-sizing: border-box !important;
          }
          ::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
            background: transparent !important;
          }

          /* Immediately destroy and hide any DotPe loading screens, spinning animations, dot loaders, and skeleton shimmers */
          .dotpe-loader-main-container,
          .loader-gif,
          .loader-slider,
          .loading-home-container,
          .cs-section-loader,
          .cs-section-loader-inner,
          [class*="dotpe-loader"],
          [class*="loading-block"],
          [class*="load-animate"],
          [class*="section-loader"],
          [class*="loading-home"],
          .page-loading,
          .loading-wrapper,
          .store-loader,
          .loading-container,
          .main-loader,
          .spinner,
          .preloader,
          .dot-flashing {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            height: 0 !important;
            width: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            z-index: -99999 !important;
          }

          html, body {
            width: 100% !important;
            min-height: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: #f1f5f9 !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          }

          body.ReactModal__Body--open,
          body {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            position: static !important;
            height: auto !important;
          }

          /* Suppress ALL Dine In / Takeaway toggle overlays, dimmer overlays and timing popups */
          .ReactModalPortal:has(.menu-type-toggle-modal),
          .ReactModalPortal:has(.menu-type-toggle-wrap),
          .ReactModalPortal:has([class*="toggle-modal"]),
          .ReactModalPortal:has(.timing-popup),
          .ReactModal__Overlay:has(.menu-type-toggle-modal),
          .ReactModal__Overlay:has(.menu-type-toggle-wrap),
          .ReactModal__Overlay:has([class*="toggle-modal"]),
          .ReactModal__Overlay:has(.timing-popup),
          .menu-type-toggle-modal,
          .menu-type-toggle-wrap,
          .timing-popup,
          .dimmer-overlay {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
            opacity: 0 !important;
            width: 0 !important;
            height: 0 !important;
            z-index: -9999 !important;
          }

          /* Force hide ALL hamburger menu elements, floating menu icons, drawers and desktop navbars */
          .website-header,
          .website-header-container,
          .website-main-header,
          .website-menu-wrapper,
          .web-menu-container,
          .web-menu-border-style,
          .website-no-service-wrapper,
          .website-no-service,
          .website-header-service-timing,
          .location-container-in-banner,
          .new-banner-parent-container,
          .nav-menu-wrapper,
          .menu-view-icon,
          .nav-menu-modal,
          .menuBg,
          .nav-link,
          [class*="nav-menu"],
          [class*="menu-view"],
          [class*="menu-modal"],
          [class*="hamburger"],
          .floating-menu-btn,
          .menu-icon,
          .menu-button,
          .side-menu-container,
          .ReactModal__Overlay,
          .ReactModalPortal:not(#subway-cart-modal) {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            opacity: 0 !important;
            pointer-events: none !important;
            overflow: hidden !important;
          }

          /* Completely remove and hide 'People mostly order this with' upsells & add-ons tab */
          .popular-add-ons,
          .popular-add-ons.upsells,
          .popular-add-ons-main-container,
          .upsellHeader,
          .popular-items-main-container,
          .popular-items-inner-container,
          .popular-addons-heading,
          [class*="popular-add-ons"],
          [class*="popular-addons"],
          [class*="upsell"],
          [class*="up-sell"] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            pointer-events: none !important;
          }

          /* Hide original dotpe blue VIEW CART floating bar — we use our own green one */
          .website-cart-floating-bar-wrap,
          .cart-floating-bar-wrap,
          .floating-cart-bar,
          .chat-floating-bar,
          .chat-input-wrapper.chat-floating-bar,
          [class*="cart-floating-bar"],
          [class*="floating-bar-wrap"] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            pointer-events: none !important;
            opacity: 0 !important;
          }

          /* Responsive Centered App Shell Container - Unlocked for Natural Scrolling */
          #root,
          .store-catalog-wrapper {
            width: 100% !important;
            height: auto !important;
            min-height: 100vh !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
            display: block !important;
            overflow: visible !important;
            overflow-y: visible !important;
            position: static !important;
          }

          .main-store-page-wrap,
          .main-store-page-wrap-new {
            width: 100% !important;
            max-width: 500px !important;
            margin: 20px auto !important;
            padding: 0 !important;
            background-color: #ffffff !important;
            border: none !important;
            height: auto !important;
            min-height: calc(100vh - 40px) !important;
            box-shadow: 0 4px 25px rgba(0, 0, 0, 0.08) !important;
            border-radius: 20px 20px 0 0 !important;
            display: block !important;
            overflow: visible !important;
            overflow-y: visible !important;
            position: relative !important;
          }

          @media (max-width: 600px) {
            .main-store-page-wrap,
            .main-store-page-wrap-new {
              max-width: 100% !important;
              margin: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              height: auto !important;
              min-height: 100vh !important;
            }
          }

          .home-page {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 0 90px 0 !important;
            background-color: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
            display: block !important;
          }

          /* Top Green Subway Navigation Banner - Zero Extra Blank Space */
          .store-header-main-wrapper {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background-color: #008938 !important;
            position: relative !important;
            height: auto !important;
            min-height: 0 !important;
            border-radius: 20px 20px 0 0 !important;
            overflow: hidden !important;
          }

          @media (max-width: 600px) {
            .store-header-main-wrapper {
              border-radius: 0 !important;
            }
          }

          .store-header-main-wrapper .md-sbg,
          .store-header-main-wrapper .md-pbg {
            background-color: #008938 !important;
            margin: 0 !important;
            padding-bottom: 6px !important;
            height: auto !important;
            min-height: 0 !important;
          }

          .store-header-main-wrapper .store-location-header {
            padding: 12px 16px !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            background-color: #008938 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }

          .store-header-main-wrapper .store-location-header .logo-wrap {
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            border-radius: 8px !important;
            overflow: hidden !important;
            background-color: #ffffff !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin-right: 12px !important;
          }

          .store-header-main-wrapper .store-location-header .logo-wrap img {
            width: 34px !important;
            height: 34px !important;
            object-fit: contain !important;
          }

          .store-header-main-wrapper .store-location-header .store-detail {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            flex: 1 1 auto !important;
            overflow: hidden !important;
          }

          .store-header-main-wrapper .store-location-header .store-name {
            font-size: 16px !important;
            font-weight: 800 !important;
            color: #ffffff !important;
            margin: 0 0 2px 0 !important;
            padding: 0 !important;
            line-height: 1.2 !important;
          }

          .store-header-main-wrapper .store-location-header .store-name-loc {
            font-size: 12px !important;
            font-weight: 400 !important;
            color: rgba(255, 255, 255, 0.85) !important;
            margin: 0 !important;
            padding: 0 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          /* Dine In dropdown pill button */
          .store-header-main-wrapper .menu-type-chip-container {
            background-color: rgba(0, 0, 0, 0.22) !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            border-radius: 20px !important;
            padding: 6px 14px !important;
            display: flex !important;
            align-items: center !important;
            cursor: pointer !important;
          }

          .store-header-main-wrapper .menu-type-chip-container .menu-option {
            color: #ffffff !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            display: flex !important;
            align-items: center !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .store-header-main-wrapper .menu-type-chip-container .menu-option i {
            margin-left: 6px !important;
            font-size: 12px !important;
          }

          /* Search bar */
          .store-header-main-wrapper .header.header-search {
            padding: 0 16px 12px 16px !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background-color: #008938 !important;
            box-sizing: border-box !important;
          }

          .store-header-main-wrapper .header.header-search span {
            width: 100% !important;
            height: 42px !important;
            border-radius: 10px !important;
            background-color: #ffffff !important;
            border: none !important;
            display: flex !important;
            align-items: center !important;
            padding: 0 16px !important;
            color: #7f7f7f !important;
            font-size: 14px !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08) !important;
            cursor: pointer !important;
            box-sizing: border-box !important;
          }

          .store-header-main-wrapper .header.header-search span img {
            width: 16px !important;
            height: 16px !important;
            margin-right: 10px !important;
            opacity: 0.6 !important;
          }

          /* Carousel & Banner Slider: Responsive aspect ratio 620:330 - Zero cropping! */
          .store-header-main-wrapper .container {
            padding: 0 16px 14px 16px !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            background-color: #008938 !important;
            box-sizing: border-box !important;
            height: auto !important;
          }

          .store-header-main-wrapper .slider-wrapper,
          .slider-wrapper {
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }

          .store-header-main-wrapper .slider-block,
          .slider-block {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            position: relative !important;
          }

          .store-header-main-wrapper .carousel-root,
          .store-header-main-wrapper .carousel,
          .store-header-main-wrapper .carousel-slider,
          .store-header-main-wrapper .slider,
          .store-header-main-wrapper .slide {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            min-height: 0 !important;
            border-radius: 12px !important;
            box-sizing: border-box !important;
          }

          .store-header-main-wrapper .banner-img {
            width: 100% !important;
            height: auto !important;
            aspect-ratio: 620 / 330 !important;
            border-radius: 14px !important;
            overflow: hidden !important;
            background-color: #005a24 !important;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .store-header-main-wrapper .banner-img img,
          .store-header-main-wrapper .slide img {
            width: 100% !important;
            height: 100% !important;
            aspect-ratio: 620 / 330 !important;
            object-fit: cover !important;
            object-position: center !important;
            border-radius: 14px !important;
            display: block !important;
          }

          .carousel .control-dots {
            bottom: 8px !important;
            margin: 0 !important;
            padding: 4px 8px !important;
            background: rgba(0, 0, 0, 0.35) !important;
            backdrop-filter: blur(6px) !important;
            -webkit-backdrop-filter: blur(6px) !important;
            border-radius: 12px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: auto !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            gap: 5px !important;
            z-index: 10 !important;
          }

          .carousel .control-dots .dot {
            background: rgba(255, 255, 255, 0.65) !important;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25) !important;
            opacity: 1 !important;
            width: 7px !important;
            height: 7px !important;
            margin: 0 !important;
            border-radius: 50% !important;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
            cursor: pointer !important;
          }

          .carousel .control-dots .dot.selected {
            background: #FFC20E !important;
            width: 20px !important;
            border-radius: 4px !important;
            box-shadow: 0 2px 6px rgba(255, 194, 14, 0.5) !important;
          }

          /* Custom Smooth Subway Carousel */
          .subway-custom-carousel {
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            box-sizing: border-box !important;
          }

          .subway-slider-track-wrap {
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: hidden !important;
            border-radius: 12px !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16) !important;
            background-color: #005a24 !important;
            box-sizing: border-box !important;
          }

          .subway-slider-track {
            display: flex !important;
            flex-direction: row !important;
            width: 100% !important;
            transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1) !important;
            will-change: transform !important;
          }

          .subway-slider-slide {
            min-width: 100% !important;
            width: 100% !important;
            flex-shrink: 0 !important;
            cursor: pointer !important;
          }

          .subway-slider-slide .banner-img {
            width: 100% !important;
            aspect-ratio: 620 / 330 !important;
            height: auto !important;
            border-radius: 12px !important;
            overflow: hidden !important;
            background-color: #005a24 !important;
          }

          .subway-slider-slide img {
            width: 100% !important;
            height: 100% !important;
            aspect-ratio: 620 / 330 !important;
            object-fit: cover !important;
            object-position: center !important;
            border-radius: 12px !important;
            display: block !important;
          }

          .subway-slider-arrow {
            display: none !important;
          }

          /* Dots: Clean horizontal dashes on the green background below the banner */
          .subway-slider-dots {
            position: static !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
            margin: 10px auto 4px auto !important;
            padding: 0 !important;
            background: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            z-index: 5 !important;
          }

          .subway-slider-dot {
            width: 8px !important;
            height: 3px !important;
            border-radius: 2px !important;
            background: rgba(255, 255, 255, 0.38) !important;
            cursor: pointer !important;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
            border: none !important;
            box-shadow: none !important;
          }

          .subway-slider-dot.active {
            width: 18px !important;
            height: 3px !important;
            border-radius: 2px !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }

          /* Hide Category Bar to cleanly reveal Veg Only and Recommended Items */
          #subway-category-nav-bar {
            display: none !important;
          }

          /* Content & Categories Container */
          .category-container {
            padding-left: 16px !important;
            padding-right: 16px !important;
            padding-bottom: 40px !important;
            box-sizing: border-box !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            background-color: #ffffff !important;
          }

          .menu-category-items-wrap,
          .subcategory-items-wrap,
          .store-best-sell-items-wrap {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 16px 0 0 0 !important;
            padding: 0 !important;
            border: none !important;
            background-color: #ffffff !important;
          }

          .category-title,
          .subcategory-items-wrap .category-title,
          .store-best-sell-items-wrap h2 {
            font-size: 20px !important;
            font-weight: 800 !important;
            color: #000000 !important;
            letter-spacing: -0.3px !important;
            padding: 6px 0 10px 0 !important;
            margin: 0 !important;
            border-bottom: none !important;
            display: block !important;
            scroll-margin-top: 60px !important;
          }

          .category-title::before,
          .subcategory-items-wrap .category-title::before,
          .store-best-sell-items-wrap h2::before {
            display: none !important;
          }

          .store-menu-filters {
            padding: 16px 16px 4px 16px !important;
            margin: 0 !important;
            background-color: #ffffff !important;
            display: flex !important;
            align-items: center !important;
          }

          @media (max-width: 600px) {
            #subway-admin-link {
              display: none !important;
            }
          }

          .product-group-with-images,
          .product-group-with-images.grid-view,
          .best-sell-items-container {
            display: flex !important;
            flex-direction: column !important;
            grid-template-columns: none !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            background-color: #ffffff !important;
          }

          /* Item Card Layout - Entire Item Box Clickable */
          .item-layout-panel,
          .best-sell-items-inner-container,
          [class*="item-layout-panel"] {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 16px 0 20px 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            border-bottom: 1px solid #f1f3f5 !important;
            position: relative !important;
            min-height: 124px !important;
            cursor: pointer !important;
            user-select: none !important;
            -webkit-tap-highlight-color: rgba(0, 137, 56, 0.08) !important;
            transition: transform 0.12s ease !important;
          }
          .item-layout-panel:active,
          .best-sell-items-inner-container:active {
            transform: scale(0.985) !important;
          }

          .item-layout-panel:last-child,
          .best-sell-items-inner-container:last-child {
            border-bottom: none !important;
          }

          /* Left Details Column */
          .item-layout-inner-wrapper,
          .top-item-details-container {
            display: flex !important;
            flex-direction: row !important;
            align-items: flex-start !important;
            flex: 1 1 auto !important;
            min-width: 0 !important;
            max-width: calc(100% - 134px) !important;
            padding-right: 12px !important;
            box-sizing: border-box !important;
          }

          .food-type-icon-conatiner,
          .best-item-type {
            margin-right: 8px !important;
            margin-top: 3px !important;
            flex-shrink: 0 !important;
            width: 14px !important;
            height: 14px !important;
          }

          .item-layout-panel .title,
          .top-item-details-container .title,
          .best-sell-items-inner-container .title {
            font-size: 15px !important;
            font-weight: 700 !important;
            color: #111827 !important;
            line-height: 1.35 !important;
            letter-spacing: -0.2px !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
            margin: 0 0 4px 0 !important;
          }

          .item-layout-panel .price,
          .item-layout-panel .price span,
          .top-item-details-container .price,
          .top-item-details-container .price span,
          .best-sell-items-inner-container .price,
          .best-sell-items-inner-container .price span {
            font-size: 14px !important;
            font-weight: 700 !important;
            color: #1f2937 !important;
            margin: 0 !important;
          }

          .item-layout-panel .menu-item-description,
          .top-item-details-container .menu-item-description,
          .best-sell-items-inner-container .menu-item-description {
            font-size: 12px !important;
            line-height: 1.45 !important;
            color: #6b7280 !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
            margin-top: 4px !important;
          }

          /* Right Photo Column */
          .item-layout-panel .tw-pb-30,
          .item-layout-panel .md-pb30,
          .best-sell-items-inner-container .tw-pb-30,
          .best-sell-items-inner-container .md-pb30 {
            width: 120px !important;
            height: 104px !important;
            position: relative !important;
            flex-shrink: 0 !important;
            margin-left: auto !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            padding-bottom: 0 !important;
            margin-bottom: 0 !important;
          }

          .item-layout-panel .product-img-wrap,
          .best-sell-items-inner-container .product-img-wrap {
            width: 120px !important;
            height: 104px !important;
            border-radius: 14px !important;
            overflow: hidden !important;
            position: relative !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
            border: 1px solid rgba(0, 0, 0, 0.04) !important;
            background-size: cover !important;
            background-position: center !important;
          }

          .item-layout-panel .product-img-wrap img,
          .best-sell-items-inner-container .product-img-wrap img {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            border-radius: 14px !important;
            display: block !important;
          }

          /* ADD Button - Compact 82px x 32px matching user preference */
          .item-layout-panel:not(.item-without-image) .add-btn-container,
          .item-layout-panel:not(.item-without-image) .price-quantity-container .add-quantity-btn.add-cart-non-custom-btn,
          .store-best-sell-items-wrap .add-btn-container,
          .subcategory-items-wrap .add-btn-container,
          .add-btn-container {
            position: absolute !important;
            top: 84px !important;
            right: 14px !important;
            left: auto !important;
            bottom: auto !important;
            width: 82px !important;
            height: auto !important;
            min-height: 32px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            z-index: 10 !important;
          }

          .item-layout-panel .add-quantity-btn,
          .store-best-sell-items-wrap .add-quantity-btn,
          .subcategory-items-wrap .add-quantity-btn,
          .add-quantity-btn {
            width: 82px !important;
            min-width: 82px !important;
            height: 32px !important;
            min-height: 32px !important;
            line-height: 30px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background-color: #ffffff !important;
            border: 1.5px solid #008938 !important;
            border-radius: 8px !important;
            color: #008938 !important;
            font-size: 13px !important;
            font-weight: 800 !important;
            letter-spacing: 0.4px !important;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12) !important;
            cursor: pointer !important;
            box-sizing: border-box !important;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }

          .add-quantity-btn:hover {
            background-color: #f0fdf4 !important;
            transform: translateY(-1px) scale(1.02) !important;
            box-shadow: 0 4px 14px rgba(0, 137, 56, 0.22) !important;
          }

          .item-layout-panel .custmisable-btn,
          .store-best-sell-items-wrap .custmisable-btn,
          .subcategory-items-wrap .custmisable-btn,
          .custmisable-btn {
            position: static !important;
            font-size: 10px !important;
            font-weight: 500 !important;
            color: #727272 !important;
            text-align: center !important;
            margin-top: 3px !important;
            display: block !important;
            width: 100% !important;
            line-height: 1.2 !important;
          }

          /* Menu Item Counter [ - 1 + ] */
          .subway-item-counter {
            width: 82px !important;
            height: 32px !important;
            min-height: 32px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            background-color: #ffffff !important;
            border: 1.5px solid #008938 !important;
            border-radius: 8px !important;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12) !important;
            padding: 0 5px !important;
            box-sizing: border-box !important;
          }

          .subway-counter-btn {
            background: none !important;
            border: none !important;
            color: #008938 !important;
            font-size: 16px !important;
            font-weight: 800 !important;
            width: 22px !important;
            height: 22px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            border-radius: 4px !important;
            user-select: none !important;
          }

          .subway-counter-val {
            font-size: 13px !important;
            font-weight: 800 !important;
            color: #111827 !important;
            min-width: 16px !important;
            text-align: center !important;
            user-select: none !important;
          }

          /* Items WITHOUT Image (Add-Ons) */
          .item-layout-panel.item-without-image {
            min-height: 60px !important;
            padding: 14px 0 !important;
            align-items: center !important;
          }

          .item-layout-panel.item-without-image .item-layout-inner-wrapper {
            max-width: calc(100% - 96px) !important;
            padding-right: 8px !important;
          }

          .item-layout-panel.item-without-image .add-btn-container,
          .item-layout-panel.item-without-image .price-quantity-container .add-quantity-btn {
            position: absolute !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            right: 0 !important;
            left: auto !important;
            bottom: auto !important;
          }

          .item-layout-panel.item-without-image .add-quantity-btn {
            width: 82px !important;
            height: 32px !important;
          }

          /* Floating View Cart pill bar - curved corners in green */
          #subway-view-cart-bar {
            position: fixed !important;
            bottom: 18px !important;
            left: 50% !important;
            transform: translateX(-50%) translateY(120px) !important;
            width: calc(100% - 32px) !important;
            max-width: 468px !important;
            height: 54px !important;
            background: linear-gradient(135deg, #008938 0%, #00662a 100%) !important;
            border-radius: 27px !important;
            box-shadow: 0 10px 28px rgba(0, 137, 56, 0.42), 0 3px 10px rgba(0, 0, 0, 0.12) !important;
            border: 1px solid rgba(255, 255, 255, 0.28) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 0 20px !important;
            z-index: 99999 !important;
            color: #ffffff !important;
            cursor: pointer !important;
            transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease !important;
            opacity: 0 !important;
            pointer-events: none !important;
            font-family: inherit !important;
            box-sizing: border-box !important;
          }

          #subway-view-cart-bar.visible {
            transform: translateX(-50%) translateY(0) !important;
            opacity: 1 !important;
            pointer-events: auto !important;
          }

          #subway-view-cart-bar:hover {
            transform: translateX(-50%) translateY(-2px) scale(1.01) !important;
            box-shadow: 0 14px 34px rgba(0, 137, 56, 0.5) !important;
          }

          #subway-view-cart-bar:active {
            transform: translateX(-50%) translateY(0) scale(0.99) !important;
          }

          .subway-cart-left {
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
          }

          .subway-cart-badge {
            background: rgba(255, 255, 255, 0.22) !important;
            color: #ffffff !important;
            border-radius: 12px !important;
            padding: 3px 10px !important;
            font-size: 13px !important;
            font-weight: 800 !important;
          }

          .subway-cart-amount {
            font-size: 15px !important;
            font-weight: 700 !important;
            color: #ffffff !important;
          }

          .subway-cart-right {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            font-size: 15px !important;
            font-weight: 800 !important;
            letter-spacing: 0.3px !important;
          }

          .subway-cart-arrow {
            width: 18px !important;
            height: 18px !important;
            stroke-width: 2.5 !important;
          }

          /* Cart Modal Sheet & Backdrop */
          #subway-cart-modal {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 100000 !important;
            display: none !important;
            align-items: flex-end !important;
            justify-content: center !important;
            box-sizing: border-box !important;
          }

          #subway-cart-modal.open {
            display: flex !important;
          }

          .subway-cart-backdrop {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.55) !important;
            backdrop-filter: blur(4px) !important;
            animation: subwayFadeIn 0.25s ease forwards !important;
          }

          .subway-cart-sheet {
            position: relative !important;
            width: 100% !important;
            max-width: 500px !important;
            max-height: 90vh !important;
            background: #ffffff !important;
            border-radius: 24px 24px 0 0 !important;
            box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.25) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            animation: subwaySlideUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
            z-index: 2 !important;
            box-sizing: border-box !important;
          }

          @keyframes subwayFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes subwaySlideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }

          .subway-cart-header {
            padding: 16px 20px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            border-bottom: 1px solid #f1f3f5 !important;
          }

          .subway-cart-header h3 {
            font-size: 18px !important;
            font-weight: 800 !important;
            color: #111827 !important;
            margin: 0 !important;
          }

          .subway-cart-close {
            background: #f3f4f6 !important;
            border: none !important;
            width: 36px !important;
            height: 36px !important;
            border-radius: 50% !important;
            font-size: 18px !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: #374151 !important;
            font-weight: 800 !important;
            transition: all 0.15s ease !important;
            -webkit-tap-highlight-color: transparent !important;
          }

          .subway-cart-close:hover,
          .subway-cart-close:active {
            background: #e5e7eb !important;
            color: #111827 !important;
            transform: scale(1.08) !important;
          }

          .subway-cart-body {
            padding: 16px 20px !important;
            overflow-y: auto !important;
            flex: 1 1 auto !important;
            max-height: calc(90vh - 170px) !important;
            box-sizing: border-box !important;
          }

          .subway-cart-item {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: 10px 12px !important;
            background: #ffffff !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 14px !important;
            margin-bottom: 10px !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03) !important;
            box-sizing: border-box !important;
            gap: 10px !important;
          }

          .subway-cart-item-img {
            width: 52px !important;
            height: 52px !important;
            border-radius: 10px !important;
            object-fit: cover !important;
            flex-shrink: 0 !important;
            border: 1px solid #f1f3f5 !important;
            background: #f9fafb !important;
          }

          .subway-cart-item-info {
            flex: 1 1 auto !important;
            min-width: 0 !important;
            padding-right: 6px !important;
          }

          .subway-cart-item-name {
            font-size: 14px !important;
            font-weight: 800 !important;
            color: #111827 !important;
            margin-bottom: 2px !important;
            line-height: 1.25 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }

          .subway-cart-item-price {
            font-size: 12px !important;
            font-weight: 600 !important;
            color: #6b7280 !important;
          }

          .subway-cart-item-qty {
            display: flex !important;
            align-items: center !important;
            background: #f0fdf4 !important;
            border: 1.5px solid #008938 !important;
            border-radius: 8px !important;
            padding: 2px 4px !important;
            gap: 6px !important;
            flex-shrink: 0 !important;
          }

          .subway-cart-item-qty button {
            background: none !important;
            border: none !important;
            color: #008938 !important;
            font-size: 18px !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            width: 26px !important;
            height: 26px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 6px !important;
            padding: 0 !important;
            -webkit-tap-highlight-color: transparent !important;
          }

          .subway-cart-item-total {
            font-size: 14px !important;
            font-weight: 900 !important;
            color: #111827 !important;
            min-width: 50px !important;
            text-align: right !important;
            flex-shrink: 0 !important;
          }

          .subway-cart-bill {
            background: #f9fafb !important;
            border-radius: 12px !important;
            padding: 14px 16px !important;
            margin-top: 16px !important;
          }

          .subway-bill-row {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 13px !important;
            color: #4b5563 !important;
            margin-bottom: 8px !important;
          }

          .subway-bill-total {
            border-top: 1px solid #e5e7eb !important;
            padding-top: 10px !important;
            margin-top: 6px !important;
            font-size: 15px !important;
            font-weight: 800 !important;
            color: #111827 !important;
          }

          .subway-cart-footer {
            padding: 14px 20px !important;
            border-top: 1px solid #f1f3f5 !important;
            background: #ffffff !important;
          }

          .subway-place-order-btn {
            width: 100% !important;
            height: 50px !important;
            background: #008938 !important;
            color: #ffffff !important;
            border: none !important;
            border-radius: 12px !important;
            font-size: 16px !important;
            font-weight: 800 !important;
            letter-spacing: 0.3px !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: 0 4px 14px rgba(0, 137, 56, 0.35) !important;
            transition: all 0.2s ease !important;
          }

          .subway-place-order-btn:hover {
            background: #00732f !important;
            transform: translateY(-1px) !important;
          }

          /* Confirmed Order Tick Mark Screen */
          .subway-confirm-screen {
            padding: 32px 20px !important;
            text-align: center !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .subway-checkmark-wrapper {
            width: 80px !important;
            height: 80px !important;
            margin: 0 auto 18px auto !important;
            position: relative !important;
          }

          .subway-checkmark-svg {
            width: 80px !important;
            height: 80px !important;
            border-radius: 50% !important;
            display: block !important;
            stroke-width: 3.5 !important;
            stroke: #008938 !important;
            stroke-miterlimit: 10 !important;
            box-shadow: 0 0 0 rgba(0, 137, 56, 0.4) !important;
            animation: subwayFill 0.4s ease-in-out 0.4s forwards, subwayScale 0.3s ease-in-out 0.9s both !important;
          }

          .subway-checkmark-circle {
            stroke-dasharray: 166 !important;
            stroke-dashoffset: 166 !important;
            stroke-width: 3.5 !important;
            stroke-miterlimit: 10 !important;
            stroke: #008938 !important;
            fill: #e8f5e9 !important;
            animation: subwayStroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards !important;
          }

          .subway-checkmark-check {
            transform-origin: 50% 50% !important;
            stroke-dasharray: 48 !important;
            stroke-dashoffset: 48 !important;
            stroke: #008938 !important;
            stroke-width: 4 !important;
            animation: subwayStroke 0.35s cubic-bezier(0.65, 0, 0.45, 1) 0.65s forwards !important;
          }

          @keyframes subwayStroke {
            100% { stroke-dashoffset: 0; }
          }
          @keyframes subwayScale {
            0%, 100% { transform: none; }
            50% { transform: scale3d(1.12, 1.12, 1); }
          }
          @keyframes subwayFill {
            100% { box-shadow: 0 0 0 16px rgba(0, 137, 56, 0); }
          }
        </style>
        <script>
          (function() {
            // Unregister any old service worker to always fetch fresh layout
            try {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs => {
                  for (let r of regs) r.unregister();
                });
              }
            } catch(e) {}

            const observer = new MutationObserver(() => {
              const patch = document.getElementById('mobile-inner-patch');
              if (patch && patch.nextElementSibling) {
                document.head.appendChild(patch);
              }
            });
            observer.observe(document.head, { childList: true });

            // Continuously guarantee full natural scrolling for all 141+ menu items
            function ensureNaturalScrolling() {
              if (document.documentElement) {
                if (document.documentElement.style.overflowY === 'hidden') document.documentElement.style.overflowY = 'auto';
                if (document.documentElement.style.height === '100%') document.documentElement.style.height = 'auto';
              }
              if (document.body) {
                if (document.body.style.overflowY === 'hidden') document.body.style.overflowY = 'auto';
                if (document.body.style.height === '100%') document.body.style.height = 'auto';
                if (document.body.classList.contains('ReactModal__Body--open')) {
                  document.body.classList.remove('ReactModal__Body--open');
                }
              }
              const root = document.getElementById('root');
              if (root) {
                if (root.style.overflowY === 'hidden') root.style.overflowY = 'visible';
                if (root.style.height && root.style.height !== 'auto') root.style.height = 'auto';
                if (root.style.maxHeight && root.style.maxHeight !== 'none') root.style.maxHeight = 'none';
              }
              const wrap = document.querySelector('.main-store-page-wrap');
              if (wrap && wrap.style.overflowY === 'hidden') {
                wrap.style.overflowY = 'visible';
              }
            }
            ensureNaturalScrolling();
            setInterval(ensureNaturalScrolling, 120);
            window.addEventListener('scroll', ensureNaturalScrolling, { passive: true });

            let isProgrammaticScrolling = false;

            function smoothScrollTo(targetPos) {
              const start = window.scrollY || document.documentElement.scrollTop;
              const change = targetPos - start;
              if (Math.abs(change) < 2) return;

              isProgrammaticScrolling = true;
              const duration = Math.min(480, Math.max(260, Math.sqrt(Math.abs(change)) * 8.5));
              const startTime = performance.now();

              function easeOutQuart(t) {
                return 1 - Math.pow(1 - t, 4);
              }

              function step(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                window.scrollTo(0, start + change * easeOutQuart(progress));

                if (progress < 1) {
                  requestAnimationFrame(step);
                } else {
                  window.scrollTo(0, targetPos);
                  setTimeout(() => { isProgrammaticScrolling = false; }, 40);
                }
              }
              requestAnimationFrame(step);
            }

            function initCategoryNavigation() {
              return; // Hide category bar to preserve clean native layout
              function buildNav() {
                const categorySections = [];
                const rec = document.querySelector('.store-best-sell-items-wrap');
                if (rec) {
                  if (!rec.id) rec.id = 'recommended-item-1';
                  categorySections.push({ id: rec.id, title: 'Recommended' });
                }

                document.querySelectorAll('.subcategory-items-wrap').forEach(el => {
                  const titleEl = el.querySelector('.category-title, .sub-cat-heading');
                  const title = titleEl ? titleEl.innerText.trim() : null;
                  if (title && el.id) {
                    categorySections.push({ id: el.id, title });
                  }
                });

                if (categorySections.length === 0) return;

                const header = document.querySelector('.store-header-main-wrapper');
                if (!header) return;

                let navBar = document.getElementById('subway-category-nav-bar');
                if (!navBar || navBar.parentElement !== header.parentNode) {
                  if (navBar) navBar.remove();
                  navBar = document.createElement('div');
                  navBar.id = 'subway-category-nav-bar';
                  if (header.nextSibling) {
                    header.parentNode.insertBefore(navBar, header.nextSibling);
                  } else {
                    header.parentNode.appendChild(navBar);
                  }
                }

                // If buttons already built and count matches, skip rebuilding
                const existingBtns = navBar.querySelectorAll('.subway-cat-btn');
                if (existingBtns.length === categorySections.length) {
                  return;
                }

                navBar.innerHTML = '';
                categorySections.forEach((cat, idx) => {
                  const btn = document.createElement('button');
                  btn.className = 'subway-cat-btn' + (idx === 0 ? ' active' : '');
                  btn.innerText = cat.title;
                  btn.dataset.target = cat.id;

                  btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetEl = document.getElementById(cat.id);
                    if (targetEl) {
                      const navH = navBar.offsetHeight || 52;
                      const targetPos = targetEl.getBoundingClientRect().top + window.scrollY - navH - 8;
                      
                      navBar.querySelectorAll('.subway-cat-btn').forEach(b => b.classList.remove('active'));
                      btn.classList.add('active');

                      const centerOffset = btn.offsetLeft - (navBar.offsetWidth / 2) + (btn.offsetWidth / 2);
                      navBar.scrollTo({ left: Math.max(0, centerOffset), behavior: 'smooth' });

                      smoothScrollTo(targetPos);
                    }
                  });

                  navBar.appendChild(btn);
                });

                // Scrollspy
                if (!navBar.dataset.scrollSpyBound) {
                  navBar.dataset.scrollSpyBound = 'true';
                  let ticking = false;
                  let activeCatId = categorySections[0] ? categorySections[0].id : null;

                  window.addEventListener('scroll', () => {
                    if (isProgrammaticScrolling) return;

                    if (!ticking) {
                      requestAnimationFrame(() => {
                        const navH = navBar.offsetHeight || 52;
                        let currentId = null;

                        for (const cat of categorySections) {
                          const el = document.getElementById(cat.id);
                          if (el) {
                            const rect = el.getBoundingClientRect();
                            if (rect.top <= navH + 80 && rect.bottom > navH) {
                              currentId = cat.id;
                              break;
                            }
                          }
                        }

                        if (currentId && currentId !== activeCatId) {
                          activeCatId = currentId;
                          navBar.querySelectorAll('.subway-cat-btn').forEach(b => {
                            const isAct = b.dataset.target === currentId;
                            if (isAct) {
                              b.classList.add('active');
                              const centerOffset = b.offsetLeft - (navBar.offsetWidth / 2) + (b.offsetWidth / 2);
                              navBar.scrollTo({ left: Math.max(0, centerOffset), behavior: 'smooth' });
                            } else {
                              b.classList.remove('active');
                            }
                          });
                        }
                        ticking = false;
                      });
                      ticking = true;
                    }
                  }, { passive: true });
                }
              }

              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', buildNav);
              } else {
                buildNav();
              }
            }
            initCategoryNavigation();

            // Catalog Image Hydration & Item Classification
            let menuCatalogMap = null;
            let menuCatalogByName = {};
            async function initCatalogImages() {
              try {
                const res = await fetch('/api/catalog/store/521/menu');
                const catJson = await res.json();
                menuCatalogMap = catJson.menuItems || {};
                menuCatalogByName = {};
                for (const [id, item] of Object.entries(menuCatalogMap)) {
                  if (item && item.itemName) {
                    menuCatalogByName[item.itemName.trim().toLowerCase()] = item;
                  }
                }
                window.menuCatalogMap = menuCatalogMap;
                window.menuCatalogById = menuCatalogMap;
                window.menuCatalogByName = menuCatalogByName;
                hydrateCategoryImages();
              } catch(e) {}
            }

            function hydrateCategoryImages() {
              if (!menuCatalogMap) return;
              try {
                if (!localStorage.getItem('diningType')) localStorage.setItem('diningType', 'DINE_IN');
                if (document.body) {
                  document.body.classList.remove('ReactModal__Body--open');
                  document.body.style.overflowY = 'auto';
                }
                if (document.documentElement) {
                  document.documentElement.style.overflowY = 'auto';
                }
              } catch(e) {}

              document.querySelectorAll('.item-layout-panel, .best-sell-items-inner-container').forEach(panel => {
                let itemData = null;
                const desc = panel.querySelector('[id$="-item-description"]');
                if (desc) {
                  const itemId = desc.id.replace('-item-description', '');
                  itemData = menuCatalogMap[itemId];
                }
                if (!itemData) {
                  const titleEl = panel.querySelector('.title, .item-title');
                  if (titleEl) {
                    const normTitle = titleEl.textContent.trim().toLowerCase();
                    itemData = menuCatalogByName[normTitle];
                  }
                }

                const imgWrap = panel.querySelector('.product-img-wrap');
                if (!imgWrap) {
                  panel.classList.add('item-without-image');
                } else {
                  panel.classList.remove('item-without-image');
                }

                if (itemData && itemData.image && itemData.image[0] && imgWrap) {
                  const imgUrl = itemData.image[0];
                  if (!imgWrap.style.backgroundImage || imgWrap.style.backgroundImage === 'none') {
                    imgWrap.style.backgroundImage = 'url("' + imgUrl + '")';
                    imgWrap.style.backgroundSize = 'cover';
                    imgWrap.style.backgroundPosition = 'center';
                  }
                  const ph = imgWrap.querySelector('div');
                  if (ph) ph.style.display = 'none';
                  const imgTag = imgWrap.querySelector('img');
                  if (imgTag && !imgTag.getAttribute('src')) {
                    imgTag.src = imgUrl;
                    imgTag.style.display = 'block';
                  }
                }
              });
            }

            initCatalogImages();
            let hydrateTimer = null;
            function scheduleHydration() {
              if (hydrateTimer) return;
              hydrateTimer = setTimeout(() => {
                hydrateTimer = null;
                hydrateCategoryImages();
              }, 80);
            }
            if (window.MutationObserver) {
              const obs = new MutationObserver(scheduleHydration);
              obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
            }

          })();
        </script>
        <style>
          #subway-admin-link {
            position: fixed;
            bottom: 24px;
            left: 16px;
            z-index: 99999;
            background: rgba(30,30,40,0.85);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 20px;
            text-decoration: none;
            letter-spacing: 0.3px;
            border: 1px solid rgba(255,255,255,0.18);
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            transition: background 0.2s, transform 0.15s;
            display: flex;
            align-items: center;
            gap: 5px;
            font-family: -apple-system, sans-serif;
          }
          #subway-admin-link:hover {
            background: rgba(0,137,56,0.9);
            transform: translateY(-1px);
          }
        </style>
        `;

        const mobileBodyScripts = `
        <script src="/subway_slider_client.js?v=20261024_7"></script>
        <script src="/subway_cart_client.js?v=20261024_7"></script>
        <a id="subway-admin-link" href="/admin" target="_blank" title="Open Admin Panel">
          ⚙ Admin
        </a>
        `;

        if (htmlContent.includes('</head>')) {
          htmlContent = htmlContent.replace('</head>', `${mobileInnerStyle}</head>`);
        }
        if (htmlContent.includes('</body>')) {
          htmlContent = htmlContent.replace('</body>', `${mobileBodyScripts}</body>`);
        } else {
          htmlContent += mobileBodyScripts;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlContent);
        return;
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(storeHtml).pipe(res);
        return;
      }
    }
  }

  // Fallback to proxy
  proxyRequest(req, res, 'eversub.dotpe.in');
}

module.exports = handleRequest;

if (require.main === module) {
  const server = http.createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`Subway Menu local server running at http://localhost:${PORT}/store/521/1/999`);
  });
}
