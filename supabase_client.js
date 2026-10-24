/**
 * Supabase Client & Cloud Sync Helper for RELELAPOS
 * Connects Vercel Serverless & Local POS to Supabase PostgreSQL Database.
 */

let supabase = null;
let isConfigured = false;

function initSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key && url.startsWith('http')) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      supabase = createClient(url, key, {
        auth: { persistSession: false }
      });
      isConfigured = true;
      console.log(`[Supabase] Successfully connected to cloud database at ${new URL(url).hostname}`);
    } catch (err) {
      console.error('[Supabase Init Error]:', err.message);
      isConfigured = false;
    }
  } else {
    isConfigured = false;
  }
  return supabase;
}

// Initial attempt
initSupabase();

function getClient() {
  if (!supabase && (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    initSupabase();
  }
  return supabase;
}

// ── Orders API ─────────────────────────────────────────────────────────────
async function saveOrderToCloud(order) {
  const client = getClient();
  if (!client || !order || !order.id) return null;

  try {
    const rawToken = order.tokenNumber || order.orderNumber || 1;
    const tokenNo = parseInt(String(rawToken).replace(/\D/g, ''), 10) || 1;

    const row = {
      id: order.id,
      token_number: tokenNo,
      order_type: order.orderType || 'Dine-In',
      table_number: order.table || null,
      items: order.items || [],
      item_count: (order.items || []).reduce((s, it) => s + (parseInt(it.quantity || it.qty, 10) || 1), 0),
      subtotal: parseFloat(order.subtotal || order.total || 0),
      discount: parseFloat(order.discount || 0),
      cgst: parseFloat(order.cgst || 0),
      sgst: parseFloat(order.sgst || 0),
      tax: parseFloat(order.tax || 0),
      total: parseFloat(order.total || 0),
      payment_method: order.paymentMethod || 'UPI',
      payment_status: order.paymentStatus || 'Paid',
      order_status: order.orderStatus || 'New',
      customer: order.customer || {},
      special_note: order.notes || order.specialNote || order.instructions || '',
      created_at: order.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await client
      .from('orders')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('[Supabase saveOrder Error]:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase saveOrder Exception]:', err.message);
    return null;
  }
}

async function fetchOrdersFromCloud() {
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase fetchOrders Error]:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase fetchOrders Exception]:', err.message);
    return null;
  }
}

async function deleteOrderFromCloud(orderId) {
  const client = getClient();
  if (!client || !orderId) return false;

  try {
    const { error } = await client
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      console.error('[Supabase deleteOrder Error]:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase deleteOrder Exception]:', err.message);
    return false;
  }
}

// ── Print Jobs API ─────────────────────────────────────────────────────────
async function savePrintJobToCloud(job) {
  const client = getClient();
  if (!client || !job || !job.jobId) return null;

  try {
    const row = {
      job_id: job.jobId,
      order_id: job.orderId,
      token_number: String(job.tokenNumber || ''),
      status: job.status || 'PENDING',
      claimed_by: job.claimedBy || null,
      claimed_at: job.claimedAt || null,
      claim_expires_at: job.claimExpiresAt || null,
      printed_at: job.printedAt || null,
      printed_by: job.printedBy || null,
      attempts: job.attempts || 0,
      raw_order: job.rawOrder || {},
      customer_receipt_text: job.customerReceiptText || '',
      kot_text: job.kotText || '',
      customer_escpos_base64: job.customerEscPosBase64 || '',
      kot_escpos_base64: job.kotEscPosBase64 || '',
      created_at: job.createdAt || new Date().toISOString()
    };

    const { data, error } = await client
      .from('print_jobs')
      .upsert(row, { onConflict: 'job_id' })
      .select()
      .single();

    if (error) {
      console.error('[Supabase savePrintJob Error]:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase savePrintJob Exception]:', err.message);
    return null;
  }
}

async function fetchPendingPrintJobsFromCloud() {
  const client = getClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('print_jobs')
      .select('*')
      .in('status', ['PENDING', 'CLAIMED'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Supabase fetchPendingPrintJobs Error]:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase fetchPendingPrintJobs Exception]:', err.message);
    return null;
  }
}

async function updatePrintJobStatusInCloud(jobId, updates) {
  const client = getClient();
  if (!client || !jobId) return null;

  try {
    const { data, error } = await client
      .from('print_jobs')
      .update(updates)
      .eq('job_id', jobId)
      .select()
      .single();

    if (error) {
      console.error('[Supabase updatePrintJobStatus Error]:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Supabase updatePrintJobStatus Exception]:', err.message);
    return null;
  }
}

// ── App Config API (Menu, Banners, Store Info) ──────────────────────────────
async function getCloudConfig(key) {
  const client = getClient();
  if (!client || !key) return null;

  try {
    const { data, error } = await client
      .from('app_config')
      .select('value')
      .eq('key', key)
      .single();

    if (error || !data) return null;
    return data.value;
  } catch (err) {
    return null;
  }
}

async function saveCloudConfig(key, value) {
  const client = getClient();
  if (!client || !key) return false;

  try {
    const { error } = await client
      .from('app_config')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) {
      console.error(`[Supabase saveConfig '${key}' Error]:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  isConfigured: () => isConfigured,
  getClient,
  saveOrderToCloud,
  fetchOrdersFromCloud,
  deleteOrderFromCloud,
  savePrintJobToCloud,
  fetchPendingPrintJobsFromCloud,
  updatePrintJobStatusInCloud,
  getCloudConfig,
  saveCloudConfig
};
