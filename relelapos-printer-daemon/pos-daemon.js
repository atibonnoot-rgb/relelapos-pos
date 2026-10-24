/**
 * pos-daemon.js – Releela High-Performance Instant Thermal Print Daemon
 *
 * Exact port of the Sattva POS zero-delay architecture, renamed to Releela.
 *
 * HOW IT WORKS:
 * 1. Exposes a local REST API on http://127.0.0.1:5001/api/print
 *    The subway menu server.js POSTs every new order to this endpoint.
 * 2. On receiving an order via API, it instantly feeds it to the persistent
 *    PowerShell worker-printer.ps1 process (zero startup delay).
 * 3. The PowerShell worker prints TWO slips with hardware paper cuts:
 *    - Slip 1: 80mm Customer Bill (48-col, itemized, total, footer)
 *    - Slip 2: 32-col Kitchen Order Ticket (TOKEN huge, items UPPERCASE)
 *
 * START: node pos-daemon.js
 * API:   POST http://localhost:5001/api/print  { order JSON }
 * API:   GET  http://localhost:5001/api/status
 */

process.on('uncaughtException', (err) => {
  console.error('[POS Daemon Uncaught Exception]:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[POS Daemon Unhandled Rejection]:', reason);
});

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT         = 5001;
const PRINTER_NAME = 'POS-80';

const CACHE_FILE    = path.join(__dirname, '.printed_orders.json');
const printedOrders = new Set();
const printTimestamps = new Map();

// Load previously printed orders from disk (survives restarts)
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw    = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach(id => {
        if (id) {
          const base = String(id).replace(/-P\d{4,}$/, '').trim();
          printedOrders.add(base);
          printedOrders.add(String(id).trim());
        }
      });
      console.log(`[Cache] Loaded ${printedOrders.size} previously printed order records from disk.`);
    }
  }
} catch (e) {}

function persistPrintedOrders() {
  try {
    const arr = Array.from(printedOrders).slice(-500);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(arr), 'utf8');
  } catch (e) {}
}

let printCount = 0;

// ── Zero-Delay Persistent Print Worker ──────────────────────────────────────
// The PowerShell worker stays running permanently. Printing is INSTANT because
// there is no per-order PowerShell startup cost (PS takes ~1-2s to cold start).
let printerWorker = null;
let isWorkerReady = false;
const printQueue    = [];  // orders queued before worker is ready
const pendingPrints = [];  // promise callbacks waiting for PRINT_SUCCESS

function initWorker() {
  if (printerWorker) {
    try { printerWorker.kill(); } catch (e) {}
  }
  isWorkerReady = false;
  const scriptPath = path.join(__dirname, 'worker-printer.ps1');

  printerWorker = spawn('powershell.exe', [
    '-ExecutionPolicy', 'Bypass',
    '-NoProfile',
    '-File', scriptPath,
    '-PrinterName', PRINTER_NAME
  ], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let buffer = '';
  printerWorker.stdout.on('data', data => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('WORKER_READY')) {
        isWorkerReady = true;
        const targetP = line.split(':')[1] || PRINTER_NAME;
        console.log(`[Printer] ⚡ Zero-Delay Instant Engine Ready on "${targetP}" (0ms latency)`);
        flushQueue();
      } else if (line.startsWith('PRINT_SUCCESS')) {
        const oid = line.split(':')[1];
        console.log(`[Printer] ✅ Instant Print Completed: #${oid}`);
        if (pendingPrints.length > 0) {
          const item = pendingPrints.shift();
          if (item && item.resolve) item.resolve({ success: true, orderId: oid });
        }
      } else if (line.startsWith('PRINT_FAIL') || line.startsWith('PRINT_ERROR')) {
        console.error(`[Printer] ❌ ${line}`);
        if (pendingPrints.length > 0) {
          const item = pendingPrints.shift();
          if (item && item.reject) item.reject(new Error(line));
        }
      }
    }
  });

  printerWorker.stderr.on('data', data => {
    const errText = data.toString().trim();
    if (errText) console.warn('[Printer Worker Stderr]:', errText);
  });

  printerWorker.on('exit', code => {
    console.warn(`[Printer Worker] Process closed (code ${code}). Re-initializing in 1s...`);
    isWorkerReady = false;
    setTimeout(initWorker, 1000);
  });
}

function flushQueue() {
  while (isWorkerReady && printQueue.length > 0) {
    const next = printQueue.shift();
    sendOrderToWorker(next);
  }
}

function sendOrderToWorker(item) {
  pendingPrints.push(item);
  try {
    const line = JSON.stringify(item.order).replace(/[\r\n]+/g, ' ') + '\n';
    printerWorker.stdin.write(line);
  } catch (err) {
    console.error('[Printer Write Error]:', err);
    if (item.reject) item.reject(err);
  }
}

// Start persistent worker immediately on daemon boot
initWorker();

// Auto-heal Windows print spooler on startup (clears stuck/error jobs)
try {
  const cleanCmd = `Get-PrintJob -PrinterName "${PRINTER_NAME}" -ErrorAction SilentlyContinue | Where-Object { $_.JobStatus -match "Error|Retained|UserIntervention" -or ($_.SubmittedTime -and ((Get-Date) - $_.SubmittedTime).TotalHours -gt 1) } | Remove-PrintJob -ErrorAction SilentlyContinue`;
  spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command', cleanCmd], { windowsHide: true });
} catch (e) {}

// ── Core Print Function ──────────────────────────────────────────────────────
function printOrder(order, options = {}) {
  if (!order) {
    console.warn('[Printer] Invalid order payload: empty');
    return Promise.reject(new Error('Invalid order payload'));
  }

  const rawId  = String(order.id || '').trim();
  const baseId = String(order.originalId || rawId).replace(/-P\d{4,}$/, '').trim();

  if (!baseId) {
    console.warn('[Printer] Invalid order payload: missing order ID');
    return Promise.reject(new Error('Invalid order payload: missing order ID'));
  }

  const isManualReprint = Boolean(options.manualReprint || order.manualReprint);
  const now             = Date.now();
  const lastPrinted     = printTimestamps.get(baseId) || 0;

  // Duplicate prints allowed: every order or reprint will print immediately
  printedOrders.add(baseId);
  printedOrders.add(rawId);
  printTimestamps.set(baseId, now);
  persistPrintedOrders();
  printCount++;

  const tok    = order.tokenId || order.tokenNumber || order.orderNumber || order.id;
  const tokStr = /^\d+$/.test(String(tok)) ? String(tok).padStart(2, '0') : tok;

  console.log(`\n========================================`);
  console.log(`⚡ RELEELA – PRINTING INSTANTLY: TOKEN #${tokStr}`);
  console.log(`🪑 Table   : ${order.tableNumber || order.table || '—'} (${(order.serviceMode || order.orderType || 'dine-in').toUpperCase()})`);
  console.log(`💳 Payment : ${(order.paymentMethod || 'cash').toUpperCase()}`);
  console.log(`💰 Total   : ₹${order.total}`);
  console.log(`========================================\n`);

  if (!isHardwareConnected) {
    console.warn(`[Printer Notice] ⚠️  WARNING: POS-80 thermal printer is currently OFFLINE or UNPLUGGED!`);
    console.warn(`[Printer Notice] Order #${tokStr} is dispatched to Windows Spooler. It will print automatically once the printer is powered ON and USB cable is plugged in.\n`);
  }

  return new Promise((resolve, reject) => {
    const item = { order, resolve, reject };
    if (isWorkerReady) {
      sendOrderToWorker(item);
    } else {
      printQueue.push(item);
    }
  });
}

let isHardwareConnected = false;
let lastReportedHardwareState = null;
let isCheckingHardware = false;

function checkHardwarePresence() {
  if (isCheckingHardware) return;
  isCheckingHardware = true;
  try {
    const chk = spawn('powershell.exe', [
      '-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command',
      "$dev = Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { ($_.InstanceId -like '*0483*' -or $_.InstanceId -like '*USBPRINT\\PRINTERPOS*' -or ($_.FriendlyName -match 'POS-?80' -and $_.Class -ne 'PrintQueue' -and $_.FriendlyName -notmatch 'Composite')) -and $_.Present -eq $true }; if ($dev) { 'TRUE' } else { 'FALSE' }"
    ], { windowsHide: true });

    let out = '';
    chk.stdout.on('data', d => out += d.toString());
    chk.on('error', () => { isCheckingHardware = false; });
    chk.on('close', () => {
      isCheckingHardware = false;
      const connected = out.trim() === 'TRUE';
      isHardwareConnected = connected;
      if (lastReportedHardwareState !== connected) {
        lastReportedHardwareState = connected;
        if (connected) {
          console.log(`\n[Printer] 🟢 Thermal Printer POS-80 Connected & Powered On (Ready to print)`);
        } else {
          console.warn(`\n************************************************************`);
          console.warn(`[Printer Notice] ⚠️  THERMAL PRINTER POS-80 NOT DETECTED ON USB!`);
          console.warn(`[Printer Notice] 1. Turn ON the power switch on the thermal printer.`);
          console.warn(`[Printer Notice] 2. Ensure the USB cable is firmly plugged into laptop.`);
          console.warn(`************************************************************\n`);
        }
      }
    });
  } catch (e) {
    isCheckingHardware = false;
  }
}

// ── HTTP API Server ──────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];

  // POST /api/print  – main endpoint called by server.js on every new order
  if (req.method === 'POST' && url === '/api/print') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const order = JSON.parse(body);
        const manualReprint = Boolean(order.manualReprint);
        const result = await printOrder(order, { manualReprint });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', result, hardwareConnected: isHardwareConnected }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: err.message }));
      }
    });
    return;
  }

  // GET /api/status  – health check for server.js to confirm daemon is alive
  if (req.method === 'GET' && url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      brand: 'Releela',
      printer: PRINTER_NAME,
      hardwareConnected: isHardwareConnected,
      workerReady: isWorkerReady,
      printedOrdersCount: printCount,
      uptimeSec: Math.floor(process.uptime())
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Releela POS Daemon] Port ${PORT} already in use – another instance is running.`);
  } else {
    console.error(`[Server Error]:`, err.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=======================================`);
  console.log(` RELEELA POS DAEMON – STARTED`);
  console.log(` API : http://0.0.0.0:${PORT}/api/print`);
  console.log(` Printer: "${PRINTER_NAME}"`);
  console.log(`=======================================\n`);

  // Initial check & continuous monitoring every 6s
  checkHardwarePresence();
  setInterval(checkHardwarePresence, 6000);
});
