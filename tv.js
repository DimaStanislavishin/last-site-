// Глобальний стан
let products = []; // завантажиться з products.json
let cart = [];     // елементи у кошику

// Cookie / localStorage ключі
const CART_COOKIE_NAME = 'techstore_cart';
const CART_LS_KEY = 'techstore_cart_ls';

// --- Допоміжні функції для cookie (залишив вашу логіку, додав try/catch) ---
function saveJsonCookie(cookieName, data, seconds = 86400) {
  try {
    const jsonString = JSON.stringify(data);
    const safeString = encodeURIComponent(jsonString);
    document.cookie = `${cookieName}=${safeString}; max-age=${seconds}; path=/`;
  } catch (err) {
    console.error('saveJsonCookie error', err);
  }
}

function getJsonCookie(cookieName) {
  try {
    const allCookies = document.cookie ? document.cookie.split('; ') : [];
    const targetCookie = allCookies.find(row => row.startsWith(cookieName + '='));
    if (targetCookie) {
      const encodedData = targetCookie.split('=')[1];
      return JSON.parse(decodeURIComponent(encodedData));
    }
  } catch (err) {
    console.error('getJsonCookie error', err);
  }
  return null;
}

// --- DOM-посилання (будуть ініціалізовані в init) ---
let productsGrid;
let cartBtn;
let cartCount;
let cartModal;
let closeModalBtn;
let cartItemsContainer;
let totalPriceEl;
let checkoutBtn;
let clearCartBtn;
let checkoutForm;
let searchInput;
let categoryFilter;
let toastContainer;

// --- Завантаження товарів ---
async function fetchProducts() {
  if (!productsGrid) return;
  try {
    const response = await fetch('tv.json');
    if (!response.ok) throw new Error(`Fetch products.json failed: ${response.status}`);
    const data = await response.json();
    // Гарантуємо наявність category (для фільтрації)
    products = data.map(p => ({ category: p.category || 'all', ...p }));
    displayProducts(products);
  } catch (err) {
    console.error('Помилка завантаження:', err);
    productsGrid.innerHTML = '<p class="error">⚠️ Не вдалося завантажити каталог товарів. Перевірте шлях до products.json або запустіть локальний сервер.</p>';
  }
}

// --- Ініціалізація кошика з cookie/localStorage ---
function initCart() {
  // Спроба з localStorage (переважна), якщо немає — з cookie
  try {
    const ls = localStorage.getItem(CART_LS_KEY);
    if (ls) {
      const parsed = JSON.parse(ls);
      if (Array.isArray(parsed)) cart = parsed;
    } else {
      const savedCookie = getJsonCookie(CART_COOKIE_NAME);
      if (savedCookie && Array.isArray(savedCookie)) cart = savedCookie;
    }
  } catch (err) {
    console.error('initCart parse error', err);
    cart = [];
  }
  updateCartUI();
}

// --- Збереження кошика (cookie + localStorage) ---
function saveCart() {
  try {
    saveJsonCookie(CART_COOKIE_NAME, cart, 7 * 86400);
    localStorage.setItem(CART_LS_KEY, JSON.stringify(cart));
  } catch (err) {
    console.error('saveCart error', err);
  }
}

// --- Створення HTML картки товару (НЕ міняємо ваш HTML-структуру) ---
function createProductCard(product) {
  // JSON.stringify(product.id) гарантує коректну вставку рядків чи чисел у onclick
  return `
    <div class="product-card">
      <img src="${product.image}" alt="${escapeHtml(product.name)}" class="product-image" loading="lazy">
      <div class="product-info">
        <h3 class="product-title">${escapeHtml(product.name)}</h3>
        <p class="product-desc">${escapeHtml(product.description)}</p>
        <div class="product-bottom">
          <span class="product-price">${escapeHtml(String(product.price))} грн</span>
          <button class="btn-add" onclick="addToCart(${JSON.stringify(product.id)})">купити</button>
        </div>
      </div>
    </div>
  `;
}

// Простий ескейп для безпечного вставлення тексту в шаблон
function escapeHtml(unsafe) {
  return unsafe
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// --- Відображення товарів у сітці ---
function displayProducts(itemsToDisplay) {
  if (!productsGrid) return;
  productsGrid.innerHTML = '';

  if (!itemsToDisplay || itemsToDisplay.length === 0) {
    productsGrid.innerHTML = '<p class="no-results">🔍 За вашим запитом товарів не знайдено.</p>';
    return;
  }

  // Використовуємо insertAdjacentHTML щоб не ламати існуючі слухачі
  itemsToDisplay.forEach(product => {
    productsGrid.insertAdjacentHTML('beforeend', createProductCard(product));
  });
}

// --- Кошик: додати, змінити, видалити ---
// Додаємо товар у кошик за id (працює з рядковими/числовими id)
function addToCart(productId) {
  const product = products.find(p => String(p.id) === String(productId));
  if (!product) {
    showToast('❗ Товар не знайдено');
    return;
  }

  const existing = cart.find(i => String(i.id) === String(productId));
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image: product.image,
      quantity: 1
    });
  }
  saveCart();
  updateCartUI();
  showToast(`✅ "${product.name}" додано у кошик!`);
}

// Видалити товар
function removeFromCart(productId) {
  cart = cart.filter(i => String(i.id) !== String(productId));
  saveCart();
  updateCartUI();
  showToast('❌ Товар видалено з кошика');
}

// Змінити кількість (+/-)
function changeQuantity(productId, delta) {
  const item = cart.find(i => String(i.id) === String(productId));
  if (!item) return;
  item.quantity = (item.quantity || 0) + delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    saveCart();
    updateCartUI();
  }
}

// --- Оновлення UI кошика (лічильник, список, сума) ---
function updateCartUI() {
  if (cartCount) {
    const totalCount = cart.reduce((s, i) => s + (i.quantity || 0), 0);
    cartCount.textContent = totalCount;
  }

  if (totalPriceEl) {
    const total = cart.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 0)), 0);
    totalPriceEl.textContent = `${total} грн`;
  }

  if (cartItemsContainer) {
    if (!cart || cart.length === 0) {
      cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Ваш кошик порожній 😔</p>';
      if (checkoutBtn) checkoutBtn.style.display = 'none';
      if (clearCartBtn) clearCartBtn.style.display = 'none';
      return;
    }

    // Відображаємо кожен елемент — тут використовуємо insertAdjacentHTML в одному рядку
    cartItemsContainer.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${escapeHtml(item.name)}" class="cart-item-img">
        <div class="cart-item-details">
          <div class="cart-item-title">${escapeHtml(item.name)}</div>
          <div class="cart-item-price">${escapeHtml(String(item.price))} грн × ${escapeHtml(String(item.quantity))} = ${escapeHtml(String(item.price * item.quantity))} грн</div>
        </div>
        <div class="cart-item-controls">
          <button class="btn-qty" onclick="changeQuantity(${JSON.stringify(item.id)}, -1)">-</button>
          <span>${escapeHtml(String(item.quantity))}</span>
          <button class="btn-qty" onclick="changeQuantity(${JSON.stringify(item.id)}, 1)">+</button>
          <button class="btn-remove" onclick="removeFromCart(${JSON.stringify(item.id)})"><img src="trash.svg"></button>
        </div>
      </div>
    `).join('');

    if (checkoutBtn) checkoutBtn.style.display = 'block';
    if (clearCartBtn) clearCartBtn.style.display = 'inline-block';
  }
}

// --- Очистити весь кошик ---
function clearCart() {
  cart = [];
  saveCart();
  updateCartUI();
  showToast('🧹 Кошик очищено');
}

// --- Пошук / фільтрація ---
function filterProducts() {
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const selectedCategory = categoryFilter ? categoryFilter.value : 'all';

  const filtered = products.filter(product => {
    const matchesSearch = !searchTerm || (product.name && product.name.toLowerCase().includes(searchTerm));
    const matchesCategory = (selectedCategory === 'all') || (!product.category && selectedCategory === 'all') || (product.category === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  displayProducts(filtered);
}

// --- Toast повідомлення ---
function showToast(message) {
  if (!toastContainer) {
    console.log('TOAST:', message);
    return;
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// --- Модальне вікно кошика (відкриття/закриття) ---
function openCartModal() {
  if (!cartModal) return;
  cartModal.classList.remove('hidden');
  cartModal.style.display = 'flex';
  if (cartBtn) cartBtn.setAttribute('aria-expanded', 'true');
}

function closeCartModal() {
  if (!cartModal) return;
  cartModal.classList.add('hidden');
  cartModal.style.display = 'none';
  if (cartBtn) cartBtn.setAttribute('aria-expanded', 'false');
  if (checkoutForm) checkoutForm.classList.add('hidden');
}

// --- Безпечна ініціалізація: захоплюємо DOM елементи та підключаємо слухачі ---
document.addEventListener('DOMContentLoaded', () => {
  // Отримуємо елементи (ті, що є в DOM)
  productsGrid = document.getElementById('products-grid');
  cartBtn = document.getElementById('cart-btn');
  cartCount = document.getElementById('cart-count');
  cartModal = document.getElementById('cart-modal');
  closeModalBtn = document.getElementById('close-modal-btn');
  cartItemsContainer = document.getElementById('cart-items');
  totalPriceEl = document.getElementById('total-price');
  checkoutBtn = document.getElementById('checkout-btn');
  clearCartBtn = document.getElementById('clear-cart-btn');
  checkoutForm = document.getElementById('checkout-form');
  searchInput = document.getElementById('search-input');
  categoryFilter = document.getElementById('category-filter');
  toastContainer = document.getElementById('toast-container');

  // Підключаємо події лише якщо елементи існують
  if (cartBtn) cartBtn.addEventListener('click', openCartModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeCartModal);
  if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
  if (checkoutBtn) checkoutBtn.addEventListener('click', () => {
    if (!checkoutForm) return;
    checkoutForm.classList.toggle('hidden');
  });

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('user-name')?.value || 'Клієнт';
      const phone = document.getElementById('user-phone')?.value || '';
      const city = document.getElementById('user-city')?.value || '';
      alert(`🎉 Дякуємо за замовлення, ${name}!\nМи зателефонуємо вам на номер ${phone} для підтвердження доставки у ${city}.`);
      cart = [];
      saveCart();
      updateCartUI();
      checkoutForm.reset();
      checkoutForm.classList.add('hidden');
      closeCartModal();
      showToast('✨ Замовлення успішно оформлено!');
    });

    // Кнопка скасувати в шаблоні (якщо є)
    const cancelBtn = document.getElementById('cancel-checkout');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      checkoutForm.classList.add('hidden');
    });
  }

  if (searchInput) searchInput.addEventListener('input', filterProducts);
  if (categoryFilter) categoryFilter.addEventListener('change', filterProducts);

  // Ініціалізація стану та завантаження товарів
  initCart();
  fetchProducts();
});

// --- Експортуємо глобально деякі функції, щоб inline onclick працював в шаблоні ---
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.changeQuantity = changeQuantity;

// --- Кінець script.js ---