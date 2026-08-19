const DATA_FILES = {
  mac: 'products.json',
  ipad: 'Ipad.json',
  iphone: 'iphone.json',
  watch: 'watch.json',
  airpods: 'airpods.json',
  tv: 'tv.json'
};

const CATEGORY_META = {
  mac: { title: 'Mac', fallbackImages: ['hero.png', 'store-card-13-mac-nav-202503 1.png'] },
  ipad: { title: 'iPad', fallbackImages: ['store-card-40-ipad-air-202503 1 (2).png'] },
  iphone: { title: 'iPhone', fallbackImages: ['MA6A4 1.png', 'store-card-13-iphone-nav-202502 1.png'] },
  watch: { title: 'Apple Watch', fallbackImages: ['store-card-13-watch-nav-202409 1.png'] },
  airpods: { title: 'AirPods', fallbackImages: ['airpods-pro-2-hero-select-202409 1.png', 'airpods-4-anc-select-202409 1.png'] },
  tv: { title: 'Apple TV', fallbackImages: ['store-card-13-appletv-nav-202210 1.png'] }
};

const CART_KEY = 'apple_store_cart_v2';
const ORDERS_KEY = 'apple_store_orders';
let products = [];
let cart = [];
let ui = {};
let activeModelFilter = 'all';

const MODEL_FILTERS = {
  mac: [
    { id: 'air', label: 'MacBook Air', test: name => /macbook air/i.test(name) },
    { id: 'pro', label: 'MacBook Pro', test: name => /macbook pro/i.test(name) }
  ],
  iphone: [
    { id: 'x', label: 'iPhone X', test: name => /^iphone x(s|r)?(\s|$)/i.test(name) },
    { id: '11', label: 'iPhone 11', test: name => /iphone 11/i.test(name) },
    { id: '12', label: 'iPhone 12', test: name => /iphone 12/i.test(name) },
    { id: '13', label: 'iPhone 13', test: name => /iphone 13/i.test(name) },
    { id: '14', label: 'iPhone 14', test: name => /iphone 14/i.test(name) },
    { id: '15', label: 'iPhone 15', test: name => /iphone 15/i.test(name) },
    { id: '16', label: 'iPhone 16', test: name => /iphone 16/i.test(name) }
  ],
  ipad: [
    { id: 'ipad', label: 'iPad', test: name => /^ipad \(/i.test(name) },
    { id: 'air', label: 'iPad Air', test: name => /ipad air/i.test(name) },
    { id: 'pro', label: 'iPad Pro', test: name => /ipad pro/i.test(name) },
    { id: 'mini', label: 'iPad mini', test: name => /ipad mini/i.test(name) }
  ],
  watch: [
    { id: 'series', label: 'Watch Series', test: name => /watch series/i.test(name) },
    { id: 'se', label: 'Watch SE', test: name => /watch se/i.test(name) },
    { id: 'ultra', label: 'Watch Ultra', test: name => /watch ultra/i.test(name) }
  ],
  airpods: [
    { id: 'airpods', label: 'AirPods', test: name => /^airpods(?! pro| max)/i.test(name) },
    { id: 'pro', label: 'AirPods Pro', test: name => /airpods pro/i.test(name) },
    { id: 'max', label: 'AirPods Max', test: name => /airpods max/i.test(name) }
  ],
  tv: [
    { id: '2022', label: '2022', test: name => /2022/i.test(name) },
    { id: '2023', label: '2023', test: name => /2023/i.test(name) },
    { id: '2024', label: '2024', test: name => /2024/i.test(name) }
  ]
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getPageCategory() {
  const filename = location.pathname.split('/').pop().toLowerCase();
  if (!filename || filename === 'index.html') return 'home';
  return filename.replace('.html', '');
}

function getFallbackImage(category, index = 0) {
  const images = CATEGORY_META[category]?.fallbackImages || CATEGORY_META.mac.fallbackImages;
  return images[index % images.length];
}

function normalizeProducts(items, category) {
  return items.map((item, index) => {
    // Беремо посилання або шлях до картинки з JSON (підтримуємо поля image або img)
    const jsonImage = typeof item.image === 'string' ? item.image.trim() : (typeof item.img === 'string' ? item.img.trim() : '');
    return {
      ...item,
      id: `${category}-${item.id}`,
      sourceId: item.id,
      category,
      categoryTitle: CATEGORY_META[category]?.title || category,
      // Якщо вказана картинка в JSON — використовуємо її, інакше показуємо запасне фото
      image: jsonImage || getFallbackImage(category, index)
    };
  });
}

async function fetchProducts(category) {
  const response = await fetch(DATA_FILES[category]);
  if (!response.ok) throw new Error(`Cannot load ${DATA_FILES[category]}`);
  return normalizeProducts(await response.json(), category);
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    cart = Array.isArray(saved)
      ? saved.filter(item => item && item.id && Number.isFinite(Number(item.price)) && Number(item.quantity) > 0)
      : [];
  } catch {
    cart = [];
  }
}

function cartModalContent() {
  return `
    <section class="modal-content" role="document">
      <div class="modal-header">
        <div>
          <p class="eyebrow">Apple Store</p>
          <h2 id="cart-title">Ваш кошик</h2>
        </div>
        <button id="close-modal-btn" class="icon-button" type="button" aria-label="Закрити кошик">×</button>
      </div>
      <div id="cart-items" class="cart-items"></div>
      <div class="cart-summary"><span>Усього</span><strong id="total-price">0 грн</strong></div>
      <div class="cart-actions">
        <button id="clear-cart-btn" class="button button-secondary" type="button">Очистити</button>
        <button id="checkout-btn" class="button button-primary" type="button">Оформити замовлення</button>
      </div>
      <form id="checkout-form" class="checkout-form">
        <div class="checkout-heading">
          <h3>Оформлення замовлення</h3>
          <p>Вкажіть дані для доставки — ми зв’яжемося з вами для підтвердження.</p>
        </div>
        <div id="checkout-order-summary" class="checkout-order-summary"></div>
        <div class="checkout-fields">
          <label>Ім’я та прізвище
            <input name="name" minlength="2" required autocomplete="name" placeholder="Іван Петренко">
          </label>
          <label>Телефон
            <input name="phone" type="tel" required inputmode="tel" autocomplete="tel" pattern="[0-9+()\-\s]{10,}" placeholder="+380 00 000 00 00">
          </label>
          <label>Місто
            <input name="city" minlength="2" required autocomplete="address-level2" placeholder="Київ">
          </label>
          <label>Спосіб доставки
            <select name="delivery" required>
              <option value="Нова пошта">Нова пошта</option>
              <option value="Укрпошта">Укрпошта</option>
              <option value="Самовивіз">Самовивіз</option>
            </select>
          </label>
          <label class="checkout-field-wide">Коментар до замовлення <span>(необов’язково)</span>
            <textarea name="comment" rows="3" placeholder="Наприклад, номер відділення Нової пошти"></textarea>
          </label>
        </div>
        <div class="cart-actions">
          <button class="button button-primary" type="submit">Підтвердити замовлення</button>
          <button id="cancel-checkout" class="button button-secondary" type="button">Назад до кошика</button>
        </div>
      </form>
      <section id="checkout-success" class="checkout-success" hidden tabindex="-1"></section>
    </section>`;
}

function mountCartIfNeeded() {
  let modal = document.querySelector('#cart-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cart-modal';
    document.body.append(modal);
  }
  modal.className = 'overlay';
  modal.removeAttribute('style');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'cart-title');
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = cartModalContent();

  if (!document.querySelector('#toast-container')) {
    document.body.insertAdjacentHTML('beforeend', '<div id="toast-container" class="toast-container" aria-live="polite" aria-atomic="true"></div>');
  }
}

function refreshUi() {
  ui = {
    grid: document.querySelector('#products-grid'),
    button: document.querySelector('#cart-btn'),
    count: document.querySelector('#cart-count'),
    modal: document.querySelector('#cart-modal'),
    close: document.querySelector('#close-modal-btn'),
    items: document.querySelector('#cart-items'),
    total: document.querySelector('#total-price'),
    checkout: document.querySelector('#checkout-btn'),
    clear: document.querySelector('#clear-cart-btn'),
    form: document.querySelector('#checkout-form'),
    cancelCheckout: document.querySelector('#cancel-checkout'),
    checkoutSummary: document.querySelector('#checkout-order-summary'),
    success: document.querySelector('#checkout-success'),
    toast: document.querySelector('#toast-container'),
    search: document.querySelector('#search-input'),
    filterBar: document.querySelector('#model-filters')
  };
  ui.items?.classList.add('cart-items');
  if (ui.close) ui.close.textContent = '×';
}

function formatPrice(price) {
  return `${Number(price).toLocaleString('uk-UA')} грн`;
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + Number(item.quantity), 0);
  const total = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  if (ui.count) {
    ui.count.textContent = count;
    ui.count.hidden = count === 0;
  }
  if (ui.total) ui.total.textContent = formatPrice(total);
  renderCheckoutSummary(count, total);
  if (!ui.items) return;

  if (!cart.length) {
    ui.items.innerHTML = '<p class="empty-cart-msg">Кошик порожній. Додайте товар, який вам сподобався.</p>';
    if (ui.checkout) ui.checkout.hidden = true;
    if (ui.clear) ui.clear.hidden = true;
    return;
  }

  if (ui.checkout) ui.checkout.hidden = false;
  if (ui.clear) ui.clear.hidden = false;
  ui.items.innerHTML = cart.map(item => `
    <article class="cart-item">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="cart-item-img">
      <div class="cart-item-details">
        <h3 class="cart-item-title">${escapeHtml(item.name)}</h3>
        <p class="cart-item-price">${formatPrice(item.price)}</p>
      </div>
      <div class="cart-item-controls" aria-label="Кількість товару">
        <button class="qty-button" type="button" data-action="decrease" data-id="${escapeHtml(item.id)}" aria-label="Зменшити кількість">−</button>
        <span aria-label="Кількість">${item.quantity}</span>
        <button class="qty-button" type="button" data-action="increase" data-id="${escapeHtml(item.id)}" aria-label="Збільшити кількість">+</button>
        <button class="remove-button" type="button" data-action="remove" data-id="${escapeHtml(item.id)}" aria-label="Видалити товар">×</button>
      </div>
    </article>
  `).join('');
}

function renderCheckoutSummary(count, total) {
  if (!ui.checkoutSummary) return;
  ui.checkoutSummary.innerHTML = `<span>${count} ${count === 1 ? 'товар' : count < 5 ? 'товари' : 'товарів'}</span><strong>${formatPrice(total)}</strong>`;
}

function addToCart(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;

  const existingItem = cart.find(item => item.id === id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name || 'Товар Apple',
      price: Number(product.price) || 0,
      image: product.image,
      quantity: 1
    });
  }

  saveCart();
  renderCart();
  showToast('Товар додано до кошика');
}

function updateQuantity(id, change) {
  const item = cart.find(entry => entry.id === id);
  if (!item) return;

  item.quantity += change;
  if (item.quantity < 1) cart = cart.filter(entry => entry.id !== id);
  saveCart();
  renderCart();
}

function showToast(message) {
  if (!ui.toast) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  ui.toast.append(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

function saveOrder(customer) {
  const total = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const order = {
    id: `AS-${String(Date.now()).slice(-6)}`,
    createdAt: new Date().toISOString(),
    customer,
    items: cart,
    total
  };
  try {
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...(Array.isArray(orders) ? orders : [])]));
  } catch {
    localStorage.setItem(ORDERS_KEY, JSON.stringify([order]));
  }
  return order;
}

function renderSkeletons(count = 8) {
  if (!ui.grid) return;
  ui.grid.innerHTML = Array.from({ length: count }, (_, index) => `
    <article class="product-card skeleton-card" style="--reveal-delay:${index * 70}ms" aria-hidden="true">
      <div class="product-image-wrap skeleton-shimmer"></div>
      <div class="product-info">
        <span class="skeleton-line skeleton-shimmer" style="width:38%"></span>
        <span class="skeleton-line skeleton-shimmer" style="width:76%"></span>
        <span class="skeleton-line skeleton-shimmer" style="width:94%"></span>
        <span class="skeleton-line skeleton-shimmer" style="width:52%"></span>
      </div>
    </article>
  `).join('');
}

function revealProductImages(root = ui.grid) {
  root?.querySelectorAll('.product-image').forEach(img => {
    const wrap = img.closest('.product-image-wrap');
    const markReady = () => {
      img.classList.add('is-loaded');
      wrap?.classList.add('is-ready');
    };
    if (img.complete && img.naturalWidth > 0) {
      markReady();
      return;
    }
    img.addEventListener('load', markReady, { once: true });
    img.addEventListener('error', markReady, { once: true });
  });
}

function getVisibleProducts() {
  const query = ui.search?.value.toLowerCase().trim() || '';
  const category = getPageCategory();
  const selected = (MODEL_FILTERS[category] || []).find(filter => filter.id === activeModelFilter);

  return products.filter(product => {
    const matchesSearch = !query || (product.name || '').toLowerCase().includes(query);
    const matchesModel = !selected || selected.test(product.name || '');
    return matchesSearch && matchesModel;
  });
}

function applyCatalogFilters() {
  renderProducts(getVisibleProducts());
}

function mountModelFilters(category) {
  document.querySelector('#model-filters')?.remove();
  const filters = (MODEL_FILTERS[category] || []).filter(filter =>
    products.some(product => filter.test(product.name || ''))
  );
  if (!ui.grid || !filters.length) return;

  ui.grid.insertAdjacentHTML('beforebegin', `
    <div id="model-filters" class="model-filters" role="tablist" aria-label="Фільтр за моделлю">
      <button type="button" class="model-filter is-active" data-model="all" role="tab" aria-selected="true">Усі</button>
      ${filters.map(filter => `
        <button type="button" class="model-filter" data-model="${escapeHtml(filter.id)}" role="tab" aria-selected="false">${escapeHtml(filter.label)}</button>
      `).join('')}
    </div>
  `);

  ui.filterBar = document.querySelector('#model-filters');
  ui.filterBar.addEventListener('click', event => {
    const button = event.target.closest('[data-model]');
    if (!button) return;
    activeModelFilter = button.dataset.model;
    ui.filterBar.querySelectorAll('.model-filter').forEach(chip => {
      const selected = chip === button;
      chip.classList.toggle('is-active', selected);
      chip.setAttribute('aria-selected', String(selected));
    });
    applyCatalogFilters();
  });
}

function renderProducts(items) {
  if (!ui.grid) return;
  if (!items.length) {
    ui.grid.innerHTML = '<p class="no-results">За вашим запитом товарів не знайдено.</p>';
    return;
  }

  ui.grid.innerHTML = items.map((product, index) => {
    const fallback = getFallbackImage(product.category, index);
    return `
    <article class="product-card is-appearing" style="--reveal-delay:${index * 55}ms">
      <div class="product-image-wrap">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='${escapeHtml(fallback)}';">
      </div>
      <div class="product-info">
        <p class="product-category">${escapeHtml(product.categoryTitle)}</p>
        <h3 class="product-title">${escapeHtml(product.name || 'Товар Apple')}</h3>
        <p class="product-desc">${escapeHtml(product.description || 'Технології для роботи, навчання та творчості.')}</p>
        <div class="product-bottom">
          <span class="product-price">${formatPrice(product.price || 0)}</span>
          <button class="btn-add" type="button" data-product-id="${escapeHtml(product.id)}">Купити</button>
        </div>
      </div>
    </article>
  `;
  }).join('');

  revealProductImages();
}

function addCatalogHeading(category) {
  if (!ui.grid || category === 'home' || document.querySelector('.catalog-intro')) return;
  ui.grid.insertAdjacentHTML('beforebegin', `
    <div class="catalog-intro">
      <p class="eyebrow">Apple Store</p>
      <h1>${CATEGORY_META[category].title}</h1>
      <p>Оберіть пристрій, який створений для ваших щоденних справ.</p>
    </div>
  `);
}

async function loadProducts() {
  if (!ui.grid) return;
  const category = getPageCategory();
  if (!DATA_FILES[category] && category !== 'home') return;

  activeModelFilter = 'all';
  renderSkeletons(category === 'home' ? 6 : 8);

  try {
    if (category === 'home') {
      const sets = await Promise.all(Object.keys(DATA_FILES).map(fetchProducts));
      products = sets.map(items => items[0]).filter(Boolean);
    } else {
      products = await fetchProducts(category);
      addCatalogHeading(category);
      mountModelFilters(category);
    }
    applyCatalogFilters();
  } catch (error) {
    ui.grid.innerHTML = '<p class="error">Не вдалося завантажити каталог. Відкрийте сайт через локальний сервер.</p>';
    console.error(error);
  }
}

function openCart() {
  if (!ui.modal) return;
  ui.modal.classList.add('is-open');
  ui.modal.setAttribute('aria-hidden', 'false');
  ui.button?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('modal-open');
}

function closeCart() {
  if (!ui.modal) return;
  ui.modal.classList.remove('is-open');
  ui.modal.setAttribute('aria-hidden', 'true');
  ui.button?.setAttribute('aria-expanded', 'false');
  ui.form?.classList.remove('is-visible');
  document.body.classList.remove('modal-open');
}

function bindEvents() {
  ui.button?.addEventListener('click', openCart);
  ui.close?.addEventListener('click', closeCart);
  ui.modal?.addEventListener('click', event => {
    if (event.target === ui.modal) closeCart();
  });
  ui.clear?.addEventListener('click', () => {
    cart = [];
    saveCart();
    renderCart();
  });
  ui.checkout?.addEventListener('click', () => {
    if (!cart.length || !ui.form) return;
    ui.success?.setAttribute('hidden', '');
    ui.form.classList.add('is-visible');
    ui.form.querySelector('[name="name"]')?.focus();
  });
  ui.cancelCheckout?.addEventListener('click', () => ui.form?.classList.remove('is-visible'));
  ui.form?.addEventListener('submit', event => {
    event.preventDefault();
    if (!ui.form.reportValidity()) return;
    const customer = Object.fromEntries(new FormData(ui.form).entries());
    const order = saveOrder(customer);
    cart = [];
    saveCart();
    renderCart();
    ui.form.reset();
    ui.form.classList.remove('is-visible');
    if (ui.success) {
      ui.success.innerHTML = `<div class="success-icon">✓</div><h3>Дякуємо за замовлення!</h3><p>Замовлення <strong>№ ${order.id}</strong> прийнято. Ми зателефонуємо ${escapeHtml(customer.name)} за номером ${escapeHtml(customer.phone)} для підтвердження доставки.</p><button id="success-close-btn" class="button button-primary" type="button">Продовжити покупки</button>`;
      ui.success.removeAttribute('hidden');
      ui.success.focus();
      ui.success.querySelector('#success-close-btn')?.addEventListener('click', closeCart, { once: true });
    }
    showToast(`Замовлення ${order.id} оформлено.`);
  });
  ui.search?.addEventListener('input', applyCatalogFilters);
  ui.grid?.addEventListener('click', event => {
    const button = event.target.closest('[data-product-id]');
    if (button) addToCart(button.dataset.productId);
  });
  ui.items?.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const changes = { increase: 1, decrease: -1, remove: -Infinity };
    updateQuantity(button.dataset.id, changes[button.dataset.action]);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeCart();
  });
}

function init() {
  mountCartIfNeeded();
  refreshUi();
  loadCart();
  renderCart();
  bindEvents();
  loadProducts();
}

window.addEventListener('DOMContentLoaded', init);
