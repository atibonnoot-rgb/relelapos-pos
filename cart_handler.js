const menuStore = require('./menu_store');

let currentActiveCart = null;

function calculateCart(cartPayload) {
  const catalog = menuStore.getStoreCatalog();
  const menuItems = catalog.menuItems || {};

  const inputCart = (cartPayload && cartPayload.cart) ? cartPayload.cart : (cartPayload || {});
  const rawItems = Array.isArray(inputCart.items) ? inputCart.items : [];

  let totalQty = 0;
  let subtotal = 0;

  const calculatedItems = rawItems.filter(Boolean).map((it, idx) => {
    const itId = String(it.itemID || it.id || '');
    const catalogItem = menuItems[itId] || {};

    const qty = Math.max(1, parseInt(it.itemQty || it.quantity || 1, 10));
    
    let price = typeof it.price === 'number' && it.price > 0 
      ? it.price 
      : (catalogItem.price || catalogItem.originalPrice || 0);

    const name = it.itemName || it.name || catalogItem.itemName || catalogItem.name || ('Item ' + itId);
    const itemTotal = price * qty;

    totalQty += qty;
    subtotal += itemTotal;

    return {
      originalPrice: catalogItem.originalPrice || price,
      price: price,
      basePrice: price,
      basePriceExcl: price,
      variantPrice: 0,
      priceExcl: price,
      cartDiscount: 0,
      loyaltyPointsDiscount: 0,
      cessAmount: 0,
      cartLineID: it.cartLineID || (idx + 100),
      itemID: parseInt(itId, 10) || it.itemID || 80011,
      categoryID: it.categoryID || catalogItem.categoryID || 8001,
      parentCategoryID: it.parentCategoryID || 0,
      itemName: name,
      itemQty: qty,
      isVegetarian: it.isVegetarian || catalogItem.isVegetarian || 'Y',
      isCustomizable: it.isCustomizable || catalogItem.isCustomizable || 'N',
      type: it.type || catalogItem.type || 'Simple',
      isPromoApplicable: true,
      description: it.description || catalogItem.description || '',
      totalQuantity: qty,
      serviceSubType: it.serviceSubType || 'qsr',
      comboType: null,
      counter: null,
      groupIndex: 0,
      totalWeight: 0,
      lineID: idx + 1,
      image: it.image || catalogItem.image || (catalogItem.image && catalogItem.image[0] ? [catalogItem.image[0]] : [])
    };
  });

  const cgst = Math.round(subtotal * 0.025 * 100) / 100;
  const sgst = Math.round(subtotal * 0.025 * 100) / 100;
  const tax = Math.round((cgst + sgst) * 100) / 100;

  const cartObj = {
    storeID: inputCart.storeID || 521,
    orderID: null,
    parentOrderID: null,
    oHash: null,
    isLoyaltyApplicable: false,
    paymentPromo: { applied: false, isRemoved: false, amount: 0 },
    cartPromo: { applied: false, isRemoved: false, amount: 0, isOtpRequired: false },
    cartQuantity: totalQty,
    priceExcl: subtotal,
    cartPromoPriceExcl: 0,
    cgstAmount: cgst,
    sgstAmount: sgst,
    vatAmount: 0,
    tax: tax,
    priceIncl: subtotal,
    paymentDiscount: 0,
    itemDiscount: 0,
    minimumCartValue: 0,
    maximumCartWeight: 0,
    cartWeight: 0,
    cartPromoDiscount: 0,
    autoPromoDiscount: 0,
    loyaltyPointsDiscount: 0,
    totalDiscount: 0,
    deliveryCharge: 0,
    packagingCharge: 0,
    cessAmount: 0,
    extraCharges: null,
    serviceCharge: 0,
    payAmount: subtotal,
    collectableAmount: subtotal,
    finalAppliedDiscount: 0,
    merchantID: inputCart.merchantID || 21751,
    tableID: inputCart.tableID || "999",
    clientIP: "127.0.0.1",
    sessionID: inputCart.sessionID || ("cart-local-" + Date.now()),
    isCheckedOut: false,
    userName: inputCart.userName || "",
    dnd: false,
    dineOut: false,
    merchantType: "store",
    itemSaleType: inputCart.itemSaleType || "",
    serviceType: "instore",
    serviceSubType: "qsr",
    appSource: "dotpe",
    reorderURL: inputCart.reorderURL || "localhost:3000/store/521/1/999",
    addedAt: inputCart.addedAt || Date.now(),
    userInfo: inputCart.userInfo || { phone: "", email: "", userName: "" },
    utmInfo: inputCart.utmInfo || {},
    expiryAt: 0,
    saleType: inputCart.saleType || "instore",
    leafOID: null,
    preferredOnePlusOneCombos: inputCart.preferredOnePlusOneCombos || {},
    items: calculatedItems,
    PIN: "",
    itemsChanged: false,
    waiterName: ""
  };

  currentActiveCart = cartObj;

  return {
    status: true,
    message: totalQty > 0 ? "Added To Cart" : "Cart is empty",
    cart: cartObj,
    data: {
      status: true,
      cart: cartObj,
      isCartValid: true,
      modifiedItems: {},
      removedItems: []
    },
    removedItems: []
  };
}

function getActiveCart() {
  if (!currentActiveCart) {
    return calculateCart({ cart: { items: [] } });
  }
  return {
    status: true,
    message: "Cart details fetched successfully",
    cart: currentActiveCart,
    data: {
      status: true,
      cart: currentActiveCart,
      isCartValid: true,
      modifiedItems: {},
      removedItems: []
    },
    removedItems: []
  };
}

module.exports = {
  calculateCart,
  getActiveCart
};
