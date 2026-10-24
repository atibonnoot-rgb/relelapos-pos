const fs = require('fs');
const path = require('path');

const MENU_FILE = path.join(__dirname, 'custom_menu.json');
const ORIG_SAMPLE_FILE = path.join(__dirname, 'scratch', 'original_menu_sample.json');

const DEFAULT_MENU = {
  categories: [
    {
      catID: 8001,
      categoryName: "Chef's Signature Subs",
      description: "Handcrafted gourmet subs on fresh baked artisan bread",
      group: "food",
      itemsIDs: [80011, 80012, 80013],
      itemCount: 3,
      Position: 0
    },
    {
      catID: 8002,
      categoryName: "Fresh Gourmet Bowls",
      description: "Wholesome protein bowls loaded with nutritious greens and warm rice",
      group: "food",
      itemsIDs: [80021, 80022],
      itemCount: 2,
      Position: 1
    },
    {
      catID: 8003,
      categoryName: "Sides & Refreshers",
      description: "Crispy toasties, delicious dips, and ice-cold beverages",
      group: "food",
      itemsIDs: [80031, 80032],
      itemCount: 2,
      Position: 2
    }
  ],
  items: {
    80011: {
      itemID: 80011,
      siRefID: 80011,
      itemName: "Ultimate Cheesy Paneer Sub",
      description: "Crispy grilled paneer cubes loaded with double mozzarella cheese, fresh greens, and secret garlic mayo on freshly baked Italian bread.",
      isVegetarian: "Y",
      isCustomizable: "Y",
      price: 249,
      originalPrice: 249,
      categoryID: 8001,
      parentCategoryID: 0,
      type: "Simple",
      serviceSubType: "qsr",
      image: [
        "//cdn.dotpe.in/catalog/sku-images/2026-10-07/37C09ABH8UJIQZ965OV.jpg"
      ],
      itemStatus: "A",
      Position: 0
    },
    80012: {
      itemID: 80012,
      siRefID: 80012,
      itemName: "Smoky BBQ Chicken Sub",
      description: "Tender chicken breast tossed in hickory BBQ sauce with melted cheddar cheese, crisp lettuce, jalapeños, and red onions.",
      isVegetarian: "N",
      isCustomizable: "Y",
      price: 289,
      originalPrice: 289,
      categoryID: 8001,
      parentCategoryID: 0,
      type: "Simple",
      serviceSubType: "qsr",
      image: [
        "//cdn.dotpe.in/catalog/sku-images/2026-10-07/37C09ABH8UJIQZ965QE.jpg"
      ],
      itemStatus: "A",
      Position: 1
    },
    80013: {
      itemID: 80013,
      siRefID: 80013,
      itemName: "Double Cheese Veggie Club",
      description: "Layers of golden cheddar, mozzarella, fresh crunchy cucumbers, capsicum, olives, and pickled gherkins with spicy marinara.",
      isVegetarian: "Y",
      isCustomizable: "Y",
      price: 219,
      originalPrice: 219,
      categoryID: 8001,
      parentCategoryID: 0,
      type: "Simple",
      serviceSubType: "qsr",
      image: [
        "//cdn.dotpe.in/catalog/sku-images/2026-10-07/37C09ABH8UJIQZ965RR.jpg"
      ],
      itemStatus: "A",
      Position: 2
    },
    80021: {
      itemID: 80021,
      siRefID: 80021,
      itemName: "Fiesta Paneer Protein Bowl",
      description: "Warm fragrant brown rice topped with herb-tossed paneer cubes, sweet corn, black beans, salsa, and creamy chipotle drizzle.",
      isVegetarian: "Y",
      isCustomizable: "Y",
      price: 229,
      originalPrice: 229,
      categoryID: 8002,
      parentCategoryID: 0,
      type: "Simple",
      serviceSubType: "qsr",
      image: [
        "//cdn.dotpe.in/catalog/sku-images/2026-10-07/37C09ABH8UJIQZ965QF.jpg"
      ],
      itemStatus: "A",
      Position: 0
    },
    80022: {
      itemID: 80022,
      siRefID: 80022,
      itemName: "Grilled Chicken Tikka Bowl",
      description: "Succulent tandoori spiced chicken breast served over warm seasoned rice, crisp greens, mint mayo, and toasted sesame.",
      isVegetarian: "N",
      isCustomizable: "Y",
      price: 269,
      originalPrice: 269,
      categoryID: 8002,
      parentCategoryID: 0,
      type: "Simple",
      serviceSubType: "qsr",
      image: [
        "//cdn.dotpe.in/catalog/sku-images/2026-10-07/37C09ABH8UJIQZ965QH.jpg"
      ],
      itemStatus: "A",
      Position: 1
    },
    80031: {
      itemID: 80031,
      siRefID: 80031,
      itemName: "Cheesy Garlic Toasties",
      description: "Toasted French loaf smothered in roasted garlic butter and molten herb cheese.",
      isVegetarian: "Y",
      isCustomizable: "N",
      price: 129,
      originalPrice: 129,
      categoryID: 8003,
      parentCategoryID: 0,
      type: "Simple",
      serviceSubType: "qsr",
      image: [
        "//cdn.dotpe.in/catalog/sku-images/2026-10-07/37C09ABH8UJIQZ965RS.jpg"
      ],
      itemStatus: "A",
      Position: 0
    },
    80032: {
      itemID: 80032,
      siRefID: 80032,
      itemName: "Cold Brew Iced Coffee",
      description: "Slow-steeped Arabica blend served chilled over ice with a splash of sweet vanilla cream.",
      isVegetarian: "Y",
      isCustomizable: "N",
      price: 149,
      originalPrice: 149,
      categoryID: 8003,
      parentCategoryID: 0,
      type: "Simple",
      serviceSubType: "qsr",
      image: [
        "//cdn.dotpe.in/catalog/sku-images/2026-10-07/37C09ABH8UJIQZ965RV.jpg"
      ],
      itemStatus: "A",
      Position: 1
    }
  }
};

function getMenu() {
  if (!fs.existsSync(MENU_FILE)) {
    saveMenu(DEFAULT_MENU);
    return JSON.parse(JSON.stringify(DEFAULT_MENU));
  }
  try {
    const raw = fs.readFileSync(MENU_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading custom_menu.json, restoring default:', e);
    saveMenu(DEFAULT_MENU);
    return JSON.parse(JSON.stringify(DEFAULT_MENU));
  }
}

function saveMenu(data) {
  fs.writeFileSync(MENU_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getStoreCatalog() {
  const customMenu = getMenu();
  let origSample = {};
  if (fs.existsSync(ORIG_SAMPLE_FILE)) {
    try {
      origSample = JSON.parse(fs.readFileSync(ORIG_SAMPLE_FILE, 'utf8'));
    } catch(e) {}
  }

  // Merge items so top Recommended Items / Bestsellers keep their items intact
  const mergedItems = { ...(origSample.menuItems || {}), ...(customMenu.items || {}) };

  // Ensure category itemCount matches itemsIDs
  const cleanCategories = (customMenu.categories || []).map((cat, idx) => {
    const ids = cat.itemsIDs || [];
    return {
      ...cat,
      itemsIDs: ids,
      itemCount: ids.length,
      Position: cat.Position !== undefined ? cat.Position : idx
    };
  });

  return {
    status: true,
    menuItems: mergedItems,
    combos: null,
    comboCategory: null,
    categories: cleanCategories,
    bestseller: origSample.bestseller || null,
    preorderFlags: origSample.preorderFlags || { normalOrder: true, preOrder: false }
  };
}

function addCategory({ categoryName, description }) {
  const menu = getMenu();
  const maxId = menu.categories.reduce((max, c) => Math.max(max, c.catID || 0), 8000);
  const newCat = {
    catID: maxId + 1,
    categoryName: (categoryName || 'New Category').trim(),
    description: (description || '').trim() || null,
    group: 'food',
    itemsIDs: [],
    itemCount: 0,
    Position: menu.categories.length
  };
  menu.categories.push(newCat);
  saveMenu(menu);
  return newCat;
}

function updateCategory(id, { categoryName, description }) {
  const catIdNum = parseInt(id, 10);
  const menu = getMenu();
  const cat = menu.categories.find(c => c.catID === catIdNum);
  if (!cat) throw new Error('Category not found');
  if (categoryName !== undefined) cat.categoryName = categoryName.trim();
  if (description !== undefined) cat.description = description ? description.trim() : null;
  saveMenu(menu);
  return cat;
}

function deleteCategory(id) {
  const catIdNum = parseInt(id, 10);
  const menu = getMenu();
  const catIdx = menu.categories.findIndex(c => c.catID === catIdNum);
  if (catIdx === -1) throw new Error('Category not found');
  const cat = menu.categories[catIdx];

  // Remove all items belonging to this category
  if (cat.itemsIDs) {
    cat.itemsIDs.forEach(itemId => {
      delete menu.items[itemId];
    });
  }

  menu.categories.splice(catIdx, 1);
  saveMenu(menu);
  return { success: true, deletedId: catIdNum };
}

function addItem(data) {
  const menu = getMenu();
  const maxItemId = Object.keys(menu.items).reduce((max, id) => Math.max(max, parseInt(id, 10) || 0), 80000);
  const newItemId = maxItemId + 1;
  const catIdNum = parseInt(data.categoryID, 10);

  const cat = menu.categories.find(c => c.catID === catIdNum);
  if (!cat) throw new Error('Target category not found');

  const newItem = {
    itemID: newItemId,
    siRefID: newItemId,
    itemName: (data.itemName || 'New Item').trim(),
    description: (data.description || '').trim(),
    isVegetarian: data.isVegetarian === 'Y' ? 'Y' : 'N',
    isCustomizable: data.isCustomizable === 'Y' ? 'Y' : 'N',
    price: parseFloat(data.price) || 0,
    originalPrice: parseFloat(data.price) || 0,
    costPrice: parseFloat(data.costPrice) || Math.round((parseFloat(data.price) || 0) * 0.38),
    categoryID: catIdNum,
    parentCategoryID: 0,
    type: 'Simple',
    serviceSubType: 'qsr',
    image: data.image && data.image.trim() ? [data.image.trim()] : [],
    itemStatus: data.itemStatus === 'I' ? 'I' : 'A',
    Position: cat.itemsIDs ? cat.itemsIDs.length : 0
  };

  menu.items[newItemId] = newItem;
  if (!cat.itemsIDs) cat.itemsIDs = [];
  cat.itemsIDs.push(newItemId);
  cat.itemCount = cat.itemsIDs.length;

  saveMenu(menu);
  return newItem;
}

function updateItem(id, data) {
  const itemIdNum = parseInt(id, 10);
  const menu = getMenu();
  const item = menu.items[itemIdNum];
  if (!item) throw new Error('Item not found');

  if (data.itemName !== undefined) item.itemName = data.itemName.trim();
  if (data.description !== undefined) item.description = data.description.trim();
  if (data.isVegetarian !== undefined) item.isVegetarian = data.isVegetarian === 'Y' ? 'Y' : 'N';
  if (data.isCustomizable !== undefined) item.isCustomizable = data.isCustomizable === 'Y' ? 'Y' : 'N';
  if (data.price !== undefined) {
    const p = parseFloat(data.price) || 0;
    item.price = p;
    item.originalPrice = p;
  }
  if (data.costPrice !== undefined) {
    item.costPrice = parseFloat(data.costPrice) || 0;
  }
  if (data.itemStatus !== undefined) {
    item.itemStatus = data.itemStatus === 'I' ? 'I' : 'A';
  }
  if (data.image !== undefined) {
    item.image = data.image && data.image.trim() ? [data.image.trim()] : [];
  }

  // If moved to a different category
  if (data.categoryID !== undefined && parseInt(data.categoryID, 10) !== item.categoryID) {
    const oldCat = menu.categories.find(c => c.catID === item.categoryID);
    if (oldCat && oldCat.itemsIDs) {
      oldCat.itemsIDs = oldCat.itemsIDs.filter(iid => iid !== itemIdNum);
      oldCat.itemCount = oldCat.itemsIDs.length;
    }
    const newCatId = parseInt(data.categoryID, 10);
    const newCat = menu.categories.find(c => c.catID === newCatId);
    if (newCat) {
      if (!newCat.itemsIDs) newCat.itemsIDs = [];
      newCat.itemsIDs.push(itemIdNum);
      newCat.itemCount = newCat.itemsIDs.length;
      item.categoryID = newCatId;
    }
  }

  saveMenu(menu);
  return item;
}

function toggleItemStatus(id) {
  const itemIdNum = parseInt(id, 10);
  const menu = getMenu();
  const item = menu.items[itemIdNum];
  if (!item) throw new Error('Item not found');
  item.itemStatus = item.itemStatus === 'I' ? 'A' : 'I';
  saveMenu(menu);
  return item;
}

function deleteItem(id) {
  const itemIdNum = parseInt(id, 10);
  const menu = getMenu();
  const item = menu.items[itemIdNum];
  if (!item) throw new Error('Item not found');

  const cat = menu.categories.find(c => c.catID === item.categoryID);
  if (cat && cat.itemsIDs) {
    cat.itemsIDs = cat.itemsIDs.filter(iid => iid !== itemIdNum);
    cat.itemCount = cat.itemsIDs.length;
  }

  delete menu.items[itemIdNum];
  saveMenu(menu);
  return { success: true, deletedId: itemIdNum };
}

function resetMenu() {
  saveMenu(DEFAULT_MENU);
  return JSON.parse(JSON.stringify(DEFAULT_MENU));
}

module.exports = {
  getMenu,
  saveMenu,
  getStoreCatalog,
  addCategory,
  updateCategory,
  deleteCategory,
  addItem,
  updateItem,
  deleteItem,
  toggleItemStatus,
  resetMenu
};
