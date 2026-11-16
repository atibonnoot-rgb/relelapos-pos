const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const supabaseClient = require('./supabase_client');

const PRINT_JOBS_FILE = fs.existsSync(path.join(process.cwd(), 'print_jobs.json'))
  ? path.join(process.cwd(), 'print_jobs.json')
  : path.join(__dirname, 'print_jobs.json');

const DEFAULT_STORE_INFO = {
  name: "RELELAPOS",
  subtitle: "• T I F F I N S •",
  tagline: "Pure Taste - Freshly Made Always",
  outlet: "Main Road Outlet",
  phone: "+91 98765 43210"
};

// Standard ESC/POS Thermal Printer Commands (Standard Bytes)
const ESC_POS = {
  INIT: Buffer.from([0x1B, 0x40]),                      // ESC @ (Initialize)
  ALIGN_LEFT: Buffer.from([0x1B, 0x61, 0x00]),          // ESC a 0
  ALIGN_CENTER: Buffer.from([0x1B, 0x61, 0x01]),        // ESC a 1
  ALIGN_RIGHT: Buffer.from([0x1B, 0x61, 0x02]),         // ESC a 2
  BOLD_ON: Buffer.from([0x1B, 0x45, 0x01]),             // ESC E 1 (Bold On)
  BOLD_OFF: Buffer.from([0x1B, 0x45, 0x00]),            // ESC E 0 (Bold Off)
  NORMAL_SIZE: Buffer.from([0x1D, 0x21, 0x00]),         // GS ! 0
  DOUBLE_HEIGHT: Buffer.from([0x1D, 0x21, 0x01]),       // GS ! 0x01
  DOUBLE_WIDTH: Buffer.from([0x1D, 0x21, 0x10]),        // GS ! 0x10
  DOUBLE_WIDTH_HEIGHT: Buffer.from([0x1D, 0x21, 0x11]), // GS ! 0x11
  FEED_AND_CUT: Buffer.from([
    0x0A, 0x0A, 0x0A, 0x0A, // 4 line feeds to move paper beyond the print head past the cutter blade
    0x1D, 0x56, 0x41, 0x00  // GS V 65 0 (Standard single ESC/POS paper cut)
  ])
};

function getPrintData() {
  if (!fs.existsSync(PRINT_JOBS_FILE)) {
    const initial = {
      queue: [],
      printedOrderIds: []
    };
    savePrintData(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(PRINT_JOBS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading print_jobs.json:', err.message);
    return { queue: [], printedOrderIds: [] };
  }
}

function savePrintData(data) {
  try {
    fs.writeFileSync(PRINT_JOBS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving print_jobs.json:', err.message);
  }
}

/**
 * SLIP 1: CUSTOMER BILL (48 Columns, 80mm Invoice)
 * 4-column aligned table: [ITEM (32 cols) | QTY (3 cols) | RATE (5 cols) | AMOUNT (7 cols)] = 48 cols
 */
function generateCustomerReceiptText(order, storeInfo = DEFAULT_STORE_INFO) {
  const storeName = storeInfo.name || "RELELAPOS";
  const tagline = storeInfo.tagline || "Pure Taste - Freshly Made Always";
  const outlet = storeInfo.outlet || "Main Road Outlet";
  const phone = storeInfo.phone || "+91 98765 43210";
  const W = 48;

  function center(text, width = W) {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(pad) + text;
  }

  function divider(char = "-") {
    return char.repeat(W);
  }

  const rawToken = order.tokenNumber || order.orderNumber || 1;
  const tokenNo = /^\d+$/.test(String(rawToken)) ? String(rawToken).padStart(2, '0') : String(rawToken);

  const d = new Date(order.createdAt || Date.now());
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const mins = String(d.getMinutes()).padStart(2, '0');
  const dateTimeStr = `${day}-${month}-${year} ${hours}:${mins} ${ampm}`;

  const payment = (order.paymentMethod || "UPI").toUpperCase().replace(/\s*\/\s*QR/i, '');

  let out = [];

  // Brand Name in BIG FONT style
  out.push(center("================================"));
  out.push(center("R E L E L A P O S"));
  out.push(center("================================"));
  out.push(center(tagline));
  out.push(center(outlet));
  out.push(divider("-"));

  // Token Number in BIG FONT style
  out.push(center("================================"));
  out.push(center(`T O K E N   #${tokenNo}`));
  out.push(center("================================"));
  out.push(divider("-"));

  // Order Details (Customer name, phone number, and table number REMOVED)
  out.push(`DATE/TIME: ${dateTimeStr}`);
  out.push(`PAYMENT  : ${payment}`);
  out.push(divider("="));
  out.push("ITEM                            QTY  RATE AMOUNT");
  out.push(divider("-"));

  (order.items || []).forEach(it => {
    const name = String(it.itemName || it.name || "Item").toUpperCase();
    const qty = String(it.quantity || it.qty || 1);
    const rate = String(it.price || 0);
    const amt = String((it.price || 0) * (it.quantity || it.qty || 1));

    // 48-Column Item Alignment:
    // name (32 cols) + qty (pad left 3) + " " (1) + rate (pad left 5) + amt (pad left 7) = 48
    if (name.length <= 32) {
      out.push(name.padEnd(32) + qty.padStart(3) + " " + rate.padStart(5) + amt.padStart(7));
    } else {
      const line1 = name.slice(0, 32);
      const line2 = name.slice(32);
      out.push(line1.padEnd(32) + qty.padStart(3) + " " + rate.padStart(5) + amt.padStart(7));
      out.push(line2);
    }
  });

  const calcTotal = (order.items || []).reduce((s, it) => s + ((parseFloat(it.price) || 0) * (parseInt(it.quantity || it.qty, 10) || 1)), 0);
  const finalTotal = (order.total !== undefined && order.total !== null && !isNaN(parseFloat(order.total))) ? parseFloat(order.total) : calcTotal;
  out.push(divider("-"));
  out.push(`TOTAL AMOUNT : Rs ${finalTotal}`);
  out.push(divider("-"));

  const specialNote = order.notes || order.specialNote || order.instructions || (order.customer && order.customer.notes) || "";
  if (specialNote && specialNote.trim() !== '') {
    const rawNote = `SPECIAL NOTE: ${specialNote.trim()}`;
    if (rawNote.length <= W) {
      out.push(rawNote);
    } else {
      let words = rawNote.split(' ');
      let line = '';
      words.forEach(w => {
        if ((line + ' ' + w).trim().length <= W) {
          line = (line + ' ' + w).trim();
        } else {
          out.push(line);
          line = '  ' + w;
        }
      });
      if (line) out.push(line);
    }
    out.push(divider("-"));
  }

  out.push(center("Good Food Brings People Together"));
  out.push(center("*** THANK YOU! VISIT AGAIN ***"));
  out.push("[-- ESC/POS CUT PAPER --]");
  out.push("");
  return out.join("\n");
}

/**
 * SLIP 2: KITCHEN ORDER TICKET / KOT (32 Columns, Chef Preparation Slip)
 * Exact match to user reference slip:
 * Line 1: Centered Store Header
 * Line 2: ================================
 * Line 3: TOKEN #XX
 * Line 4: ================================
 * Line 5: Mode: DINE-IN
 * Line 6: Table: T-1           24-10 00:37
 * Line 7: Pay  : UPI
 * Line 8: --------------------------------
 * Line 9+: 1x ITEM NAME
 * Line:   ================================
 */
function generateKotReceiptText(order, storeInfo = DEFAULT_STORE_INFO) {
  const storeName = storeInfo.name || "RELELAPOS";
  const W = 32;

  function center(text, width = W) {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(pad) + text;
  }

  function divider(char = "=") {
    return char.repeat(W);
  }

  const rawToken = order.tokenNumber || order.orderNumber || 1;
  const tokenNo = String(rawToken);
  const mode = (order.orderType || "DINE-IN").toUpperCase();
  const table = order.table ? order.table.toUpperCase() : "T-1";
  const payment = (order.paymentMethod || "UPI").toUpperCase().replace(/\s*\/\s*QR/i, '');

  const d = new Date(order.createdAt || Date.now());
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const dateTimeShort = `${day}-${month} ${hours}:${mins}`;

  let out = [];
  out.push(center(storeName));
  out.push(divider("="));
  out.push(center(`TOKEN #${tokenNo}`));
  out.push(divider("="));
  out.push(`Mode: ${mode}`);

  // Table on left and Date/Time on right: "Table: T-1           24-10 00:37"
  const tablePrefix = `Table: ${table}`;
  const gap = Math.max(1, W - tablePrefix.length - dateTimeShort.length);
  out.push(tablePrefix + " ".repeat(gap) + dateTimeShort);

  out.push(`Pay  : ${payment}`);
  out.push(divider("-"));

  (order.items || []).forEach(it => {
    const name = String(it.itemName || it.name || "Item").toUpperCase();
    const qty = it.quantity || it.qty || 1;
    out.push(`${qty}x ${name}`);
  });

  const specialNote = order.notes || order.specialNote || order.instructions || (order.customer && order.customer.notes) || "";
  if (specialNote && specialNote.trim() !== '') {
    out.push(divider("-"));
    const rawNote = `Note: ${specialNote.trim()}`;
    if (rawNote.length <= W) {
      out.push(rawNote);
    } else {
      let words = rawNote.split(' ');
      let line = '';
      words.forEach(w => {
        if ((line + ' ' + w).trim().length <= W) {
          line = (line + ' ' + w).trim();
        } else {
          out.push(line);
          line = '  ' + w;
        }
      });
      if (line) out.push(line);
    }
  }

  out.push(divider("="));
  out.push("[-- ESC/POS CUT PAPER --]");
  out.push("");
  return out.join("\n");
}

/**
 * Generate binary ESC/POS Buffer for Slip 1 (Customer Bill)
 */
function generateCustomerBillEscPos(order, storeInfo = DEFAULT_STORE_INFO) {
  const storeName = storeInfo.name || "RELELAPOS";
  const tagline = storeInfo.tagline || "Pure Taste - Freshly Made Always";
  const outlet = storeInfo.outlet || "Main Road Outlet";
  const phone = storeInfo.phone || "+91 98765 43210";
  const W = 48;

  function center(text, width = W) {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(pad) + text;
  }

  function divider(char = "-") {
    return char.repeat(W) + "\n";
  }

  const rawToken = order.tokenNumber || order.orderNumber || 1;
  const tokenNo = /^\d+$/.test(String(rawToken)) ? String(rawToken).padStart(2, '0') : String(rawToken);

  const d = new Date(order.createdAt || Date.now());
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const mins = String(d.getMinutes()).padStart(2, '0');
  const dateTimeStr = `${day}-${month}-${year} ${hours}:${mins} ${ampm}`;
  const payment = (order.paymentMethod || "UPI").toUpperCase().replace(/\s*\/\s*QR/i, '');

  const chunks = [];
  chunks.push(ESC_POS.INIT);

  // Brand Name in BIG FONT (Double Width + Double Height + Bold)
  chunks.push(ESC_POS.ALIGN_CENTER);
  chunks.push(ESC_POS.BOLD_ON);
  chunks.push(ESC_POS.DOUBLE_WIDTH_HEIGHT);
  chunks.push(Buffer.from("RELELAPOS\n", 'utf8'));
  chunks.push(ESC_POS.NORMAL_SIZE);
  chunks.push(ESC_POS.BOLD_OFF);
  chunks.push(Buffer.from(`${tagline}\n`, 'utf8'));
  chunks.push(Buffer.from(`${outlet}\n`, 'utf8'));
  chunks.push(Buffer.from(divider("-"), 'utf8'));

  // Token Number in BIG FONT (Double Width + Double Height + Bold)
  chunks.push(ESC_POS.BOLD_ON);
  chunks.push(ESC_POS.DOUBLE_WIDTH_HEIGHT);
  chunks.push(Buffer.from(`TOKEN #${tokenNo}\n`, 'utf8'));
  chunks.push(ESC_POS.NORMAL_SIZE);
  chunks.push(ESC_POS.BOLD_OFF);
  chunks.push(Buffer.from(divider("-"), 'utf8'));

  // Order Details Left Aligned (Customer, Phone, Table REMOVED)
  chunks.push(ESC_POS.ALIGN_LEFT);
  chunks.push(Buffer.from(`DATE/TIME: ${dateTimeStr}\n`, 'utf8'));
  chunks.push(Buffer.from(`PAYMENT  : ${payment}\n`, 'utf8'));
  chunks.push(Buffer.from(divider("="), 'utf8'));
  chunks.push(Buffer.from("ITEM                            QTY  RATE AMOUNT\n", 'utf8'));
  chunks.push(Buffer.from(divider("-"), 'utf8'));

  // Items
  (order.items || []).forEach(it => {
    const name = String(it.itemName || it.name || "Item").toUpperCase();
    const qty = String(it.quantity || it.qty || 1);
    const rate = String(it.price || 0);
    const amt = String((it.price || 0) * (it.quantity || it.qty || 1));

    if (name.length <= 32) {
      chunks.push(Buffer.from(name.padEnd(32) + qty.padStart(3) + " " + rate.padStart(5) + amt.padStart(7) + "\n", 'utf8'));
    } else {
      const line1 = name.slice(0, 32);
      const line2 = name.slice(32);
      chunks.push(Buffer.from(line1.padEnd(32) + qty.padStart(3) + " " + rate.padStart(5) + amt.padStart(7) + "\n", 'utf8'));
      chunks.push(Buffer.from(line2 + "\n", 'utf8'));
    }
  });

  chunks.push(Buffer.from(divider("-"), 'utf8'));

  const calcEscTotal = (order.items || []).reduce((s, it) => s + ((parseFloat(it.price) || 0) * (parseInt(it.quantity || it.qty, 10) || 1)), 0);
  const finalEscTotal = (order.total !== undefined && order.total !== null && !isNaN(parseFloat(order.total))) ? parseFloat(order.total) : calcEscTotal;
  // Total in Bold Double Size
  chunks.push(ESC_POS.BOLD_ON);
  chunks.push(ESC_POS.DOUBLE_HEIGHT);
  chunks.push(Buffer.from(`TOTAL AMOUNT : Rs ${finalEscTotal}\n`, 'utf8'));
  chunks.push(ESC_POS.NORMAL_SIZE);
  chunks.push(ESC_POS.BOLD_OFF);

  chunks.push(Buffer.from(divider("-"), 'utf8'));

  const specialNote = order.notes || order.specialNote || order.instructions || (order.customer && order.customer.notes) || "";
  if (specialNote && specialNote.trim() !== '') {
    chunks.push(Buffer.from(`SPECIAL NOTE: ${specialNote.trim()}\n`, 'utf8'));
    chunks.push(Buffer.from(divider("-"), 'utf8'));
  }

  // Footer Centered
  chunks.push(ESC_POS.ALIGN_CENTER);
  chunks.push(Buffer.from("Good Food Brings People Together\n", 'utf8'));
  chunks.push(Buffer.from("*** THANK YOU! VISIT AGAIN ***\n", 'utf8'));

  // Automated Paper Feed and Hardware Cut
  chunks.push(ESC_POS.FEED_AND_CUT);

  return Buffer.concat(chunks);
}

/**
 * Generate binary ESC/POS Buffer for Slip 2 (Kitchen Order Ticket / KOT)
 */
function generateKotEscPos(order, storeInfo = DEFAULT_STORE_INFO) {
  const storeName = storeInfo.name || "RELELAPOS";
  const W = 32;

  function divider(char = "=") {
    return char.repeat(W) + "\n";
  }

  const rawToken = order.tokenNumber || order.orderNumber || 1;
  const tokenNo = String(rawToken);
  const mode = (order.orderType || "DINE-IN").toUpperCase();
  const table = order.table ? order.table.toUpperCase() : "T-1";
  const payment = (order.paymentMethod || "UPI").toUpperCase().replace(/\s*\/\s*QR/i, '');

  const d = new Date(order.createdAt || Date.now());
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const dateTimeShort = `${day}-${month} ${hours}:${mins}`;

  const chunks = [];
  chunks.push(ESC_POS.INIT);

  // Store Header
  chunks.push(ESC_POS.ALIGN_CENTER);
  chunks.push(ESC_POS.BOLD_ON);
  chunks.push(Buffer.from(`${storeName}\n`, 'utf8'));
  chunks.push(ESC_POS.BOLD_OFF);
  chunks.push(Buffer.from(divider("="), 'utf8'));

  // Giant Token (Double Width & Double Height)
  chunks.push(ESC_POS.DOUBLE_WIDTH_HEIGHT);
  chunks.push(ESC_POS.BOLD_ON);
  chunks.push(Buffer.from(`TOKEN #${tokenNo}\n`, 'utf8'));
  chunks.push(ESC_POS.NORMAL_SIZE);
  chunks.push(ESC_POS.BOLD_OFF);
  chunks.push(Buffer.from(divider("="), 'utf8'));

  // Mode and Table/Time
  chunks.push(ESC_POS.ALIGN_LEFT);
  chunks.push(Buffer.from(`Mode: ${mode}\n`, 'utf8'));

  const tablePrefix = `Table: ${table}`;
  const gap = Math.max(1, W - tablePrefix.length - dateTimeShort.length);
  chunks.push(Buffer.from(tablePrefix + " ".repeat(gap) + dateTimeShort + "\n", 'utf8'));

  chunks.push(Buffer.from(`Pay  : ${payment}\n`, 'utf8'));
  chunks.push(Buffer.from(divider("-"), 'utf8'));

  // Kitchen Items in ALL CAPS, BOLD, DOUBLE-HEIGHT
  chunks.push(ESC_POS.BOLD_ON);
  chunks.push(ESC_POS.DOUBLE_HEIGHT);
  (order.items || []).forEach(it => {
    const name = String(it.itemName || it.name || "Item").toUpperCase();
    const qty = it.quantity || it.qty || 1;
    chunks.push(Buffer.from(`${qty}x ${name}\n`, 'utf8'));
  });
  chunks.push(ESC_POS.NORMAL_SIZE);
  chunks.push(ESC_POS.BOLD_OFF);

  const specialNote = order.notes || order.specialNote || order.instructions || (order.customer && order.customer.notes) || "";
  if (specialNote && specialNote.trim() !== '') {
    chunks.push(Buffer.from(divider("-"), 'utf8'));
    chunks.push(Buffer.from(`Note: ${specialNote.trim()}\n`, 'utf8'));
  }

  chunks.push(Buffer.from(divider("="), 'utf8'));

  // Automated Paper Feed and Hardware Cut
  chunks.push(ESC_POS.FEED_AND_CUT);

  return Buffer.concat(chunks);
}

// Enqueue a print job for an order (Idempotent: prevents duplicate queueing)
async function enqueuePrintJob(order, storeInfo = DEFAULT_STORE_INFO) {
  if (!order || !order.id) return null;

  const data = getPrintData();
  data.printedOrderIds = data.printedOrderIds || [];
  data.queue = data.queue || [];

  // Allow duplicate prints: remove from printed list if present
  data.printedOrderIds = data.printedOrderIds.filter(id => id !== order.id);

  const jobId = `PJ-${order.id}`;
  const customerText = generateCustomerReceiptText(order, storeInfo);
  const kotText = generateKotReceiptText(order, storeInfo);
  const customerEscPosBase64 = generateCustomerBillEscPos(order, storeInfo).toString('base64');
  const kotEscPosBase64 = generateKotEscPos(order, storeInfo).toString('base64');

  // If a job already exists in queue, reset it to PENDING and refresh its print buffers
  const existing = data.queue.find(j => j.orderId === order.id);
  if (existing) {
    existing.status = "PENDING";
    existing.claimedBy = null;
    existing.claimExpiresAt = null;
    existing.printedAt = null;
    existing.printedBy = null;
    existing.attempts = 0;
    existing.rawOrder = order;
    existing.customerReceiptText = customerText;
    existing.kotText = kotText;
    existing.customerEscPosBase64 = customerEscPosBase64;
    existing.kotEscPosBase64 = kotEscPosBase64;
    savePrintData(data);
    try {
      await supabaseClient.savePrintJobToCloud(existing);
    } catch (e) {}
    console.log(`[PrintStore] Order ${order.id} re-enqueued as PENDING with fresh receipt formats.`);
    return existing;
  }

  const job = {
    jobId,
    orderId: order.id,
    tokenNumber: order.tokenNumber || order.orderNumber || 1,
    status: "PENDING", // PENDING -> CLAIMED -> PRINTED -> FAILED
    createdAt: new Date().toISOString(),
    claimedBy: null,
    claimedAt: null,
    claimExpiresAt: null,
    printedAt: null,
    printedBy: null,
    attempts: 0,
    rawOrder: order,
    customerReceiptText: customerText,
    kotText: kotText,
    customerEscPosBase64,
    kotEscPosBase64,
    orderSummary: {
      id: order.id,
      tokenNumber: order.tokenNumber || order.orderNumber,
      orderType: order.orderType,
      table: order.table,
      total: order.total,
      paymentMethod: order.paymentMethod,
      customerName: order.customer?.name || "Customer",
      customerPhone: order.customer?.phone || storeInfo.phone,
      specialNote: order.notes || order.specialNote || "",
      itemsCount: (order.items || []).length
    }
  };

  data.queue.push(job);
  savePrintData(data);
  try {
    await supabaseClient.savePrintJobToCloud(job);
  } catch (err) {
    console.error('[Supabase print job sync error]:', err.message);
  }
  console.log(`[PrintStore] Enqueued print job ${jobId} for order ${order.id} (Token #${job.tokenNumber})`);
  return job;
}

// Atomically claim pending jobs for a printer device (Checks Supabase first, then local queue)
async function claimPendingJobs(deviceId = "default-daemon", leaseSeconds = 60) {
  const now = Date.now();
  const claimedJobs = [];
  const seenJobIds = new Set();

  // 1. Primary: Claim pending jobs from Supabase Cloud Database (works across all Vercel instances)
  try {
    const cloudPending = await supabaseClient.fetchPendingPrintJobsFromCloud();
    if (Array.isArray(cloudPending) && cloudPending.length > 0) {
      for (const row of cloudPending) {
        const isPending = row.status === 'PENDING';
        const isClaimExpired = row.status === 'CLAIMED' && row.claim_expires_at && (new Date(row.claim_expires_at).getTime() < now);

        if (isPending || isClaimExpired) {
          const claimExpiresAt = new Date(now + leaseSeconds * 1000).toISOString();
          const attempts = (row.attempts || 0) + 1;

          await supabaseClient.updatePrintJobStatusInCloud(row.job_id, {
            status: 'CLAIMED',
            claimed_by: deviceId,
            claimed_at: new Date().toISOString(),
            claim_expires_at: claimExpiresAt,
            attempts
          });

          const jobObj = {
            jobId: row.job_id,
            orderId: row.order_id,
            tokenNumber: row.token_number || 1,
            status: 'CLAIMED',
            createdAt: row.created_at,
            claimedBy: deviceId,
            claimExpiresAt,
            attempts,
            customerReceiptText: row.customer_receipt_text,
            kotText: row.kot_text,
            customerEscPosBase64: row.customer_escpos_base64,
            kotEscPosBase64: row.kot_escpos_base64,
            rawOrder: row.raw_order || {},
            orderSummary: row.raw_order || {}
          };

          claimedJobs.push(jobObj);
          seenJobIds.add(row.job_id);
        }
      }
    }
  } catch (cloudErr) {
    console.error('[PrintStore] Cloud claim error:', cloudErr.message);
  }

  // 2. Secondary fallback: Local JSON file queue
  const data = getPrintData();
  data.queue = data.queue || [];
  data.printedOrderIds = data.printedOrderIds || [];

  const eligibleLocal = data.queue.filter(j => {
    if (seenJobIds.has(j.jobId)) return false;
    if (j.status === "PENDING") return true;
    if (j.status === "CLAIMED") {
      const exp = j.claimExpiresAt ? new Date(j.claimExpiresAt).getTime() : 0;
      return exp < now;
    }
    return false;
  });

  if (eligibleLocal.length > 0) {
    eligibleLocal.forEach(job => {
      job.status = "CLAIMED";
      job.claimedBy = deviceId;
      job.claimedAt = new Date().toISOString();
      job.claimExpiresAt = new Date(now + leaseSeconds * 1000).toISOString();
      job.attempts = (job.attempts || 0) + 1;
      claimedJobs.push(job);
      seenJobIds.add(job.jobId);
    });
    savePrintData(data);
  }

  return claimedJobs;
}

// Acknowledge successful printing of a job (updates both Supabase & local cache)
async function acknowledgePrintJob(jobId, deviceId = "default-daemon", status = "PRINTED") {
  const data = getPrintData();
  data.queue = data.queue || [];
  data.printedOrderIds = data.printedOrderIds || [];

  const job = data.queue.find(j => j.jobId === jobId);
  if (job) {
    job.status = status;
    if (status === "PRINTED") {
      job.printedAt = new Date().toISOString();
      job.printedBy = deviceId;
      if (!data.printedOrderIds.includes(job.orderId)) {
        data.printedOrderIds.push(job.orderId);
      }
    }
    savePrintData(data);
  }

  try {
    await supabaseClient.updatePrintJobStatusInCloud(jobId, {
      status,
      printed_at: new Date().toISOString(),
      printed_by: deviceId
    });
  } catch (e) {
    console.error('[PrintStore] Supabase ACK error:', e.message);
  }

  console.log(`[PrintStore] Job ${jobId} acknowledged as ${status} by ${deviceId}.`);
  return { success: true, jobId, orderId: job ? job.orderId : jobId, status };
}

// Force reprint an order (admin action)
function reprintOrder(orderId, storeInfo = DEFAULT_STORE_INFO) {
  const data = getPrintData();
  data.queue = data.queue || [];
  data.printedOrderIds = data.printedOrderIds || [];

  // Remove from printedOrderIds to allow printing again
  data.printedOrderIds = data.printedOrderIds.filter(id => id !== orderId);

  let job = data.queue.find(j => j.orderId === orderId);
  if (job) {
    job.status = "PENDING";
    job.claimedBy = null;
    job.claimExpiresAt = null;
    job.printedAt = null;
    job.printedBy = null;
    const orderObj = job.rawOrder || job.orderSummary || { id: orderId };
    job.customerReceiptText = generateCustomerReceiptText(orderObj, storeInfo);
    job.kotText = generateKotReceiptText(orderObj, storeInfo);
    job.customerEscPosBase64 = generateCustomerBillEscPos(orderObj, storeInfo).toString('base64');
    job.kotEscPosBase64 = generateKotEscPos(orderObj, storeInfo).toString('base64');
  }

  savePrintData(data);
  return job;
}

// Get queue status summary
function getQueueStatus() {
  const data = getPrintData();
  const queue = data.queue || [];
  return {
    totalJobs: queue.length,
    pending: queue.filter(j => j.status === "PENDING").length,
    claimed: queue.filter(j => j.status === "CLAIMED").length,
    printed: queue.filter(j => j.status === "PRINTED").length,
    printedOrderCount: (data.printedOrderIds || []).length,
    recentJobs: queue.slice(-15).reverse()
  };
}

// Direct Automated Print to POS-80 with Universal Dual-Slip Cut
function printOrderDirectly(order, storeInfo = DEFAULT_STORE_INFO, printerName = "POS-80") {
  if (!order || !order.id) return { success: false, error: "Invalid order" };

  try {
    const custBuf = generateCustomerBillEscPos(order, storeInfo);
    const kotBuf = generateKotEscPos(order, storeInfo);

    const daemonDir = path.join(__dirname, 'relelapos-printer-daemon');
    const psScript = path.join(daemonDir, 'raw_print.ps1');

    if (!fs.existsSync(psScript)) {
      console.warn(`[Direct Print] raw_print.ps1 not found at ${psScript}`);
      return { success: false, error: "raw_print.ps1 not found" };
    }

    const tempDir = path.join(daemonDir, 'temp_spool');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const pName = (printerName && printerName.trim() !== '') ? printerName : 'POS-80';

    // 1. Print Slip 1 (Customer Bill)
    const file1 = path.join(tempDir, `bill_${order.id}_${Date.now()}.bin`);
    fs.writeFileSync(file1, custBuf);
    try {
      const cmd1 = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psScript}" -PrinterName "${pName}" -InputFile "${file1}"`;
      execSync(cmd1, { timeout: 12000, stdio: 'pipe' });
      console.log(`[Direct Print] Slip 1 (Customer Bill) sent to ${pName} with hardware cut.`);
    } finally {
      try { fs.unlinkSync(file1); } catch(e) {}
    }

    // Short pause for paper feed and blade cycle
    const start = Date.now();
    while (Date.now() - start < 600) {}

    // 2. Print Slip 2 (KOT Slip)
    const file2 = path.join(tempDir, `kot_${order.id}_${Date.now()}.bin`);
    fs.writeFileSync(file2, kotBuf);
    try {
      const cmd2 = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${psScript}" -PrinterName "${pName}" -InputFile "${file2}"`;
      execSync(cmd2, { timeout: 12000, stdio: 'pipe' });
      console.log(`[Direct Print] Slip 2 (KOT Slip) sent to ${pName} with hardware cut.`);
    } finally {
      try { fs.unlinkSync(file2); } catch(e) {}
    }

    // Mark as printed
    acknowledgePrintJob(`PJ-${order.id}`, 'server-direct', 'PRINTED');

    return { success: true };
  } catch(err) {
    console.error(`[Direct Print Error] Failed to print order ${order.id}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getPrintData,
  enqueuePrintJob,
  claimPendingJobs,
  acknowledgePrintJob,
  reprintOrder,
  printOrderDirectly,
  getQueueStatus,
  generateCustomerReceiptText,
  generateKotReceiptText,
  generateCustomerBillEscPos,
  generateKotEscPos,
  ESC_POS,
  DEFAULT_STORE_INFO
};

