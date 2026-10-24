const fs = require('fs');
const path = require('path');
const supabaseClient = require('./supabase_client');

const FINANCE_FILE = path.join(__dirname, 'restaurant_finances.json');

const INITIAL_FINANCES = {
  storeInfo: {
    name: "RELELAPOS",
    subtitle: "• T I F F I N S •",
    tagline: "Pure Taste - Freshly Made Always",
    outlet: "Main Road Outlet",
    storeId: "521",
    address: "Main Road Outlet, Topsia Kolkata, West Bengal 700046",
    gstin: "19AAACS2026M1Z4",
    phone: "+91 98765 43210",
    fssai: "12821013000521"
  },
  currentShift: {
    shiftId: "SH-20261023-01",
    date: new Date().toISOString().split('T')[0],
    isOpen: true,
    openedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    openingFloat: 2500,
    cashSales: 3450,
    cashExpenses: 450,
    expectedCash: 5500, // 2500 + 3450 - 450
    actualCountedCash: null,
    discrepancy: 0,
    isSettled: false,
    settledAt: null
  },
  orders: [
    {
      id: "ORD-2041",
      orderNumber: 101,
      orderType: "Dine-In",
      table: "Table 4",
      items: [
        { itemID: 80011, itemName: "Ultimate Cheesy Paneer Sub", quantity: 2, price: 249, costPrice: 95, isVegetarian: "Y" },
        { itemID: 80012, itemName: "Smoky BBQ Chicken Sub", quantity: 1, price: 299, costPrice: 120, isVegetarian: "N" }
      ],
      itemCount: 3,
      subtotal: 797,
      discount: 0,
      cgst: 19.93,
      sgst: 19.93,
      tax: 39.85,
      total: 837,
      paymentMethod: "UPI / QR",
      paymentStatus: "Paid",
      orderStatus: "Completed",
      createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      customer: { name: "Rohit Sen", phone: "9830112233" }
    },
    {
      id: "ORD-2042",
      orderNumber: 102,
      orderType: "Takeaway",
      table: null,
      items: [
        { itemID: 80012, itemName: "Smoky BBQ Chicken Sub", quantity: 2, price: 299, costPrice: 120, isVegetarian: "N" }
      ],
      itemCount: 2,
      subtotal: 598,
      discount: 50,
      cgst: 13.70,
      sgst: 13.70,
      tax: 27.40,
      total: 575,
      paymentMethod: "Cash",
      paymentStatus: "Paid",
      orderStatus: "Completed",
      createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      customer: { name: "Ananya Ghosh", phone: "9874556677" }
    },
    {
      id: "ORD-2043",
      orderNumber: 103,
      orderType: "Dine-In",
      table: "Table 2",
      items: [
        { itemID: 80011, itemName: "Ultimate Cheesy Paneer Sub", quantity: 1, price: 249, costPrice: 95, isVegetarian: "Y" }
      ],
      itemCount: 1,
      subtotal: 249,
      discount: 0,
      cgst: 6.23,
      sgst: 6.23,
      tax: 12.45,
      total: 261,
      paymentMethod: "Card",
      paymentStatus: "Paid",
      orderStatus: "Completed",
      createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      customer: { name: "Vikram Malhotra", phone: "9123456780" }
    },
    {
      id: "ORD-2044",
      orderNumber: 104,
      orderType: "Takeaway",
      table: null,
      items: [
        { itemID: 80011, itemName: "Ultimate Cheesy Paneer Sub", quantity: 3, price: 249, costPrice: 95, isVegetarian: "Y" },
        { itemID: 80012, itemName: "Smoky BBQ Chicken Sub", quantity: 2, price: 299, costPrice: 120, isVegetarian: "N" }
      ],
      itemCount: 5,
      subtotal: 1345,
      discount: 100,
      cgst: 31.13,
      sgst: 31.13,
      tax: 62.25,
      total: 1307,
      paymentMethod: "Cash",
      paymentStatus: "Paid",
      orderStatus: "Completed",
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      customer: { name: "Kunal Roy", phone: "9748001122" }
    },
    {
      id: "ORD-2045",
      orderNumber: 105,
      orderType: "Dine-In",
      table: "Table 6",
      items: [
        { itemID: 80012, itemName: "Smoky BBQ Chicken Sub", quantity: 1, price: 299, costPrice: 120, isVegetarian: "N" }
      ],
      itemCount: 1,
      subtotal: 299,
      discount: 0,
      cgst: 7.48,
      sgst: 7.48,
      tax: 14.95,
      total: 314,
      paymentMethod: "UPI / QR",
      paymentStatus: "Paid",
      orderStatus: "In Kitchen",
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      customer: { name: "Siddharth Jain", phone: "9831998877" }
    }
  ],
  expenses: [
    {
      id: "EXP-101",
      category: "Vegetables & Produce",
      description: "Fresh Iceberg Lettuce, Cucumbers & Tomatoes from Wholesale Market",
      amount: 650,
      paymentMode: "Cash Drawer",
      recordedBy: "Manager",
      createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString()
    },
    {
      id: "EXP-102",
      category: "Packaging & Disposables",
      description: "Subway Sub Wrap Paper & Carry Bags batch refill",
      amount: 450,
      paymentMode: "Cash Drawer",
      recordedBy: "Manager",
      createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
    },
    {
      id: "EXP-103",
      category: "Dairy & Cheese",
      description: "Mozzarella & Cheddar cheese slices delivery (Mother Dairy)",
      amount: 1200,
      paymentMode: "Bank / UPI",
      recordedBy: "Accountant",
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    }
  ],
  inventory: [
    { id: "INV-1", name: "Italian Artisan 6-inch Loaf", category: "Bakery", currentStock: 48, minStock: 25, unit: "loaves", costPerUnit: 18, status: "OK" },
    { id: "INV-2", name: "Parmesan Oregano Loaf", category: "Bakery", currentStock: 14, minStock: 20, unit: "loaves", costPerUnit: 22, status: "LOW" },
    { id: "INV-3", name: "Mozzarella Cheese Slices", category: "Dairy", currentStock: 110, minStock: 40, unit: "slices", costPerUnit: 12, status: "OK" },
    { id: "INV-4", name: "Paneer Cubes (Fresh)", category: "Produce", currentStock: 8.5, minStock: 4, unit: "kg", costPerUnit: 240, status: "OK" },
    { id: "INV-5", name: "Grilled Chicken Breast Fillets", category: "Poultry", currentStock: 4.2, minStock: 5, unit: "kg", costPerUnit: 320, status: "LOW" },
    { id: "INV-6", name: "Chipotle Southwest Sauce", category: "Sauces", currentStock: 6, minStock: 3, unit: "bottles", costPerUnit: 180, status: "OK" },
    { id: "INV-7", name: "Sub Wrapping Sheets (Pack)", category: "Packaging", currentStock: 3, minStock: 5, unit: "packs", costPerUnit: 150, status: "LOW" }
  ]
};

function getFinances() {
  if (!fs.existsSync(FINANCE_FILE)) {
    saveFinances(INITIAL_FINANCES);
    return JSON.parse(JSON.stringify(INITIAL_FINANCES));
  }
  try {
    const raw = fs.readFileSync(FINANCE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading finances file:', err.message);
    return JSON.parse(JSON.stringify(INITIAL_FINANCES));
  }
}

function saveFinances(data) {
  try {
    fs.writeFileSync(FINANCE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving finances file:', err.message);
  }
}

function calculateSummary() {
  const data = getFinances();
  const orders = data.orders || [];
  const expenses = data.expenses || [];

  const completedOrders = orders.filter(o => o.orderStatus !== 'Cancelled');
  const grossSales = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalSubtotal = completedOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const totalTax = completedOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
  const totalDiscount = completedOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
  const orderCount = completedOrders.length;
  const aov = orderCount > 0 ? Math.round(grossSales / orderCount) : 0;

  // Payment breakdown
  let cashSales = 0;
  let upiSales = 0;
  let cardSales = 0;
  completedOrders.forEach(o => {
    const method = (o.paymentMethod || '').toLowerCase();
    if (method.includes('cash')) cashSales += (o.total || 0);
    else if (method.includes('upi') || method.includes('qr')) upiSales += (o.total || 0);
    else if (method.includes('card')) cardSales += (o.total || 0);
    else upiSales += (o.total || 0);
  });

  // Calculate COGS (Cost of goods sold)
  let totalCOGS = 0;
  completedOrders.forEach(o => {
    (o.items || []).forEach(it => {
      const cost = it.costPrice || (it.price * 0.38); // default 38% food cost if not set
      totalCOGS += cost * (it.quantity || 1);
    });
  });

  // Operating Expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const cashExpenses = expenses.filter(e => (e.paymentMode || '').toLowerCase().includes('cash')).reduce((sum, e) => sum + (e.amount || 0), 0);
  const onlineExpenses = totalExpenses - cashExpenses;

  // Net Profit
  // Net Revenue (Subtotal - Discount) - Food Cost - Operating Expenses
  const netRevenue = totalSubtotal - totalDiscount;
  const grossProfit = netRevenue - totalCOGS;
  const netOperatingProfit = grossProfit - totalExpenses;
  const grossMarginPct = netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 100) : 0;
  const netMarginPct = netRevenue > 0 ? Math.round((netOperatingProfit / netRevenue) * 100) : 0;

  // Cash Drawer calculation
  const openingFloat = data.currentShift.openingFloat || 2500;
  const expectedCash = openingFloat + cashSales - cashExpenses;

  return {
    grossSales,
    netRevenue,
    totalTax,
    totalDiscount,
    orderCount,
    aov,
    cashSales,
    upiSales,
    cardSales,
    totalCOGS,
    grossProfit,
    grossMarginPct,
    totalExpenses,
    cashExpenses,
    onlineExpenses,
    netOperatingProfit,
    netMarginPct,
    cashDrawer: {
      openingFloat,
      cashIn: cashSales,
      cashOut: cashExpenses,
      expectedCash,
      actualCountedCash: data.currentShift.actualCountedCash,
      discrepancy: (data.currentShift.actualCountedCash !== null) ? (data.currentShift.actualCountedCash - expectedCash) : 0,
      isSettled: data.currentShift.isSettled,
      settledAt: data.currentShift.settledAt
    }
  };
}

// Order management
async function createOrder(orderPayload) {
  const data = getFinances();
  const nextNum = (data.orders.length > 0 ? Math.max(...data.orders.map(o => o.orderNumber || 100)) + 1 : 101);
  const nextId = `ORD-${nextNum + 1940}`;

  // Unique sequential token number for each order
  const maxToken = (data.orders || []).reduce((max, o) => Math.max(max, parseInt(o.tokenNumber) || 0), 0);
  const tokenNumber = maxToken >= 1 ? maxToken + 1 : 1;

  const subtotal = (orderPayload.items || []).reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseInt(item.quantity || item.qty, 10) || 1)), 0);
  const discount = parseFloat(orderPayload.discount) || 0;
  const taxable = Math.max(0, subtotal - discount);
  // Non-GST billing: No GST/tax charged
  const cgst = 0;
  const sgst = 0;
  const tax = 0;
  const total = (orderPayload.total !== undefined && orderPayload.total !== null && !isNaN(parseFloat(orderPayload.total)))
    ? parseFloat(orderPayload.total)
    : Math.round(taxable);

  const paymentMethod = orderPayload.paymentMethod || "UPI / QR";
  const isCash = paymentMethod.toLowerCase().includes('cash');
  const paymentStatus = orderPayload.paymentStatus || (isCash ? "Pending (Cash)" : "Paid");

  const newOrder = {
    id: nextId,
    orderNumber: nextNum,
    tokenNumber: tokenNumber,
    orderType: orderPayload.orderType || "Dine-In",
    table: orderPayload.table || null,
    items: orderPayload.items || [],
    itemCount: (orderPayload.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0),
    subtotal,
    discount,
    cgst,
    sgst,
    tax,
    total,
    paymentMethod,
    paymentStatus,
    orderStatus: orderPayload.orderStatus || "New",
    createdAt: new Date().toISOString(),
    customer: orderPayload.customer || { name: "Guest Customer", phone: "" }
  };

  data.orders.unshift(newOrder);
  saveFinances(data);
  try {
    await supabaseClient.saveOrderToCloud(newOrder);
  } catch (err) {
    console.error('[Supabase order sync error]:', err.message);
  }
  return newOrder;
}

function updateOrderStatus(orderId, status) {
  const data = getFinances();
  const order = data.orders.find(o => o.id === orderId);
  if (!order) throw new Error('Order not found');
  order.orderStatus = status;
  saveFinances(data);
  return order;
}

function deleteOrder(orderId) {
  const data = getFinances();
  const idx = data.orders.findIndex(o => o.id === orderId);
  if (idx === -1) throw new Error('Order not found');
  const removed = data.orders.splice(idx, 1)[0];

  // Recalculate cash sales for shift if applicable
  const cashTotal = (data.orders || [])
    .filter(o => o.orderStatus !== 'Cancelled' && (o.paymentMethod || '').toLowerCase().includes('cash'))
    .reduce((sum, o) => sum + (o.total || 0), 0);
  data.currentShift.cashSales = cashTotal;
  const cashExpenses = (data.expenses || [])
    .filter(e => (e.paymentMode || '').toLowerCase().includes('cash'))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  data.currentShift.expectedCash = (data.currentShift.openingFloat || 2500) + cashTotal - cashExpenses;

  saveFinances(data);
  try {
    supabaseClient.deleteOrderFromCloud(orderId).catch(err => {
      console.error('[Supabase async delete order error]:', err.message);
    });
  } catch (e) {}
  return removed;
}

// Expense management
function addExpense(expensePayload) {
  const data = getFinances();
  const nextId = `EXP-${Date.now().toString().slice(-4)}`;
  const newExp = {
    id: nextId,
    category: expensePayload.category || "General",
    description: expensePayload.description || "",
    amount: parseFloat(expensePayload.amount) || 0,
    paymentMode: expensePayload.paymentMode || "Cash Drawer",
    recordedBy: expensePayload.recordedBy || "Manager",
    createdAt: new Date().toISOString()
  };
  data.expenses.unshift(newExp);
  saveFinances(data);
  return newExp;
}

function deleteExpense(expId) {
  const data = getFinances();
  const idx = data.expenses.findIndex(e => e.id === expId);
  if (idx === -1) throw new Error('Expense not found');
  const removed = data.expenses.splice(idx, 1)[0];
  saveFinances(data);
  return removed;
}

// Cash drawer settlement
function settleCashDrawer(actualCountedCash) {
  const data = getFinances();
  const summary = calculateSummary();
  const counted = parseFloat(actualCountedCash) || 0;
  const expected = summary.cashDrawer.expectedCash;
  const discrepancy = counted - expected;

  data.currentShift.actualCountedCash = counted;
  data.currentShift.discrepancy = discrepancy;
  data.currentShift.isSettled = true;
  data.currentShift.settledAt = new Date().toISOString();

  saveFinances(data);
  return {
    isSettled: true,
    expectedCash: expected,
    actualCountedCash: counted,
    discrepancy,
    settledAt: data.currentShift.settledAt
  };
}

function resetDayShift(openingFloat) {
  const data = getFinances();
  const floatVal = parseFloat(openingFloat) || 2500;
  data.currentShift = {
    shiftId: `SH-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-2)}`,
    date: new Date().toISOString().split('T')[0],
    isOpen: true,
    openedAt: new Date().toISOString(),
    openingFloat: floatVal,
    cashSales: 0,
    cashExpenses: 0,
    expectedCash: floatVal,
    actualCountedCash: null,
    discrepancy: 0,
    isSettled: false,
    settledAt: null
  };
  saveFinances(data);
  return data.currentShift;
}

// Inventory management
function updateInventoryItem(itemId, fields) {
  const data = getFinances();
  const inv = data.inventory.find(i => i.id === itemId);
  if (!inv) throw new Error('Inventory item not found');
  if (fields.currentStock !== undefined) inv.currentStock = parseFloat(fields.currentStock);
  if (fields.minStock !== undefined) inv.minStock = parseFloat(fields.minStock);
  if (fields.costPerUnit !== undefined) inv.costPerUnit = parseFloat(fields.costPerUnit);
  inv.status = inv.currentStock <= inv.minStock ? 'LOW' : 'OK';
  saveFinances(data);
  return inv;
}

module.exports = {
  getFinances,
  saveFinances,
  calculateSummary,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  addExpense,
  deleteExpense,
  settleCashDrawer,
  resetDayShift,
  updateInventoryItem
};
