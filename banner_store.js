const fs = require('fs');
const path = require('path');

const BANNERS_FILE = fs.existsSync(path.join(process.cwd(), 'banners.json'))
  ? path.join(process.cwd(), 'banners.json')
  : path.join(__dirname, 'banners.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'banners');

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem in cloud serverless environment
}

const DEFAULT_BANNERS = [
  {
    id: "banner-1",
    imageID: 29137,
    title: "Signature Rice Bowls - Fresh & Filling",
    url: "https://cdn.dotpe.in/promoBanner/21751/1.png",
    linkCategory: "6111605",
    linkName: "SIGNATURE RICE BOWLS - NEW",
    active: true,
    position: 0
  },
  {
    id: "banner-2",
    imageID: 29138,
    title: "Sandwich Classics - Baked Fresh Daily",
    url: "https://cdn.dotpe.in/promoBanner/21751/2.png",
    linkCategory: "6110171",
    linkName: "Create Your Own Sandwiches",
    active: true,
    position: 1
  },
  {
    id: "banner-3",
    imageID: 29139,
    title: "Crispy Fresh Garden Salads",
    url: "https://cdn.dotpe.in/promoBanner/21751/3.png",
    linkCategory: "6104012",
    linkName: "Salads",
    active: true,
    position: 2
  },
  {
    id: "banner-4",
    imageID: 29140,
    title: "Sub Cravers - Handcrafted Melts",
    url: "https://cdn.dotpe.in/promoBanner/21751/4.png",
    linkCategory: "6104009",
    linkName: "Sub Cravers - Try New",
    active: true,
    position: 3
  },
  {
    id: "banner-5",
    imageID: 29141,
    title: "Chef's Signature Gourmet Subs",
    url: "https://cdn.dotpe.in/promoBanner/21751/5.png",
    linkCategory: "6104010",
    linkName: "Hot & Cheesy Signature Subs",
    active: true,
    position: 4
  },
  {
    id: "banner-6",
    imageID: 29142,
    title: "Subway Special Toasties & Sides",
    url: "https://cdn.dotpe.in/promoBanner/21751/6.png",
    linkCategory: "6114166",
    linkName: "Subway Special Toasties",
    active: true,
    position: 5
  }
];

class BannerStore {
  constructor() {
    this.banners = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(BANNERS_FILE)) {
        const raw = fs.readFileSync(BANNERS_FILE, 'utf8');
        this.banners = JSON.parse(raw);
        if (!Array.isArray(this.banners) || this.banners.length === 0) {
          this.banners = JSON.parse(JSON.stringify(DEFAULT_BANNERS));
          this.save();
        }
      } else {
        this.banners = JSON.parse(JSON.stringify(DEFAULT_BANNERS));
        this.save();
      }
    } catch (e) {
      console.error('Error loading banners.json:', e);
      this.banners = JSON.parse(JSON.stringify(DEFAULT_BANNERS));
    }
  }

  save() {
    try {
      fs.writeFileSync(BANNERS_FILE, JSON.stringify(this.banners, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving banners.json:', e);
    }
  }

  getBanners() {
    return [...this.banners].sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  getPromoBanners() {
    const activeBanners = this.banners
      .filter(b => b.active !== false)
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    // Map to dotpe React structure
    return activeBanners.map((b, idx) => ({
      imageID: b.imageID || (29100 + idx),
      url: b.url,
      bannerConfig: b.linkCategory ? {
        url: null,
        objectId: isNaN(Number(b.linkCategory)) ? b.linkCategory : Number(b.linkCategory),
        objectType: "category"
      } : null
    }));
  }

  addBanner({ title, url, linkCategory, linkName, active = true }) {
    if (!url || typeof url !== 'string' || !url.trim()) {
      throw new Error('Image URL is required');
    }
    const nextPos = this.banners.length > 0
      ? Math.max(...this.banners.map(b => b.position || 0)) + 1
      : 0;

    const newBanner = {
      id: 'banner-' + Date.now(),
      imageID: Math.floor(29000 + Math.random() * 9000),
      title: (title || 'Subway Special Promo').trim(),
      url: url.trim(),
      linkCategory: (linkCategory || '').toString().trim(),
      linkName: (linkName || '').trim(),
      active: active !== false,
      position: nextPos
    };

    this.banners.push(newBanner);
    this.save();
    return newBanner;
  }

  updateBanner(id, data) {
    const index = this.banners.findIndex(b => b.id === id);
    if (index === -1) {
      throw new Error('Banner not found: ' + id);
    }

    const current = this.banners[index];
    if (data.title !== undefined) current.title = data.title.trim();
    if (data.url !== undefined && data.url.trim()) current.url = data.url.trim();
    if (data.linkCategory !== undefined) current.linkCategory = data.linkCategory.toString().trim();
    if (data.linkName !== undefined) current.linkName = data.linkName.trim();
    if (data.active !== undefined) current.active = !!data.active;
    if (data.position !== undefined) current.position = Number(data.position);

    this.save();
    return current;
  }

  toggleBanner(id) {
    const banner = this.banners.find(b => b.id === id);
    if (!banner) throw new Error('Banner not found: ' + id);
    banner.active = !banner.active;
    this.save();
    return banner;
  }

  deleteBanner(id) {
    const index = this.banners.findIndex(b => b.id === id);
    if (index === -1) {
      throw new Error('Banner not found: ' + id);
    }
    const removed = this.banners.splice(index, 1)[0];
    // Re-index positions
    this.banners.forEach((b, idx) => { b.position = idx; });
    this.save();
    return removed;
  }

  reorderBanners(orderedIds) {
    if (!Array.isArray(orderedIds)) throw new Error('Invalid order array');
    const newOrder = [];
    orderedIds.forEach((id, idx) => {
      const banner = this.banners.find(b => b.id === id);
      if (banner) {
        banner.position = idx;
        newOrder.push(banner);
      }
    });
    // Add any remaining
    this.banners.forEach(b => {
      if (!newOrder.some(o => o.id === b.id)) {
        b.position = newOrder.length;
        newOrder.push(b);
      }
    });
    this.banners = newOrder;
    this.save();
    return this.getBanners();
  }

  resetBanners() {
    this.banners = JSON.parse(JSON.stringify(DEFAULT_BANNERS));
    this.save();
    return this.getBanners();
  }

  saveUploadedImage(base64Data, originalFileName) {
    // Strip header if data URL
    const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    let ext = 'png';
    let raw = base64Data;
    if (matches) {
      ext = matches[1].replace('jpeg', 'jpg');
      raw = matches[2];
    } else if (originalFileName) {
      const fileExt = path.extname(originalFileName).replace('.', '').toLowerCase();
      if (fileExt) ext = fileExt;
    }

    const filename = `banner_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    const buffer = Buffer.from(raw, 'base64');
    fs.writeFileSync(filePath, buffer);

    return `/uploads/banners/${filename}`;
  }
}

module.exports = new BannerStore();
