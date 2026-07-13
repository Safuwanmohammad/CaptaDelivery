// ============================================================
// API BASE – dynamically uses the current domain
// ============================================================
const API_BASE = window.location.origin + '/api';

// ============================================================
// GLOBAL STATE
// ============================================================
let categories = [];
let restaurants = [];
let products = [];
let offers = [];
let deliveryAreas = {};
let orders = [];
let users = [];
let user = JSON.parse(localStorage.getItem('swingy_user')) || null;
let otpCode = null;
let nextOrderNumber = 1;
let cart = JSON.parse(localStorage.getItem('swingy_cart') || '[]');

let settings = {
  rain_fare: 20,
  delivery_hours: '9:00 AM - 10:00 PM',
  unavailable_days: [],
  service_unavailable: false
};

let state = {
  selectedCategory: '',
  selectedRestaurant: null,
  searchTerm: '',
  showCart: false,
  showOrders: false,
  showCategoryModal: false,
  showAccountDrawer: false,
  showOrderSummary: false,
  showPayment: false,
  toastMsg: null,
  loading: false,
  orderSummary: {
    items: [],
    selectedMainArea: '',
    selectedSubArea: '',
    deliveryCharge: 0,
    rainFare: 0,
    grandTotal: 0,
    subtotal: 0,
    categoryTotals: {}
  }
};

// ============================================================
// DOM REFS
// ============================================================
const app = document.getElementById('app');
const searchInput = document.getElementById('searchInput');
const searchInputMobile = document.getElementById('searchInputMobile');
const searchToggleBtn = document.getElementById('searchToggleBtn');
const navCart = document.getElementById('navCart');
const navOrders = document.getElementById('navOrders');
const navUser = document.getElementById('navUser');
const navLogo = document.getElementById('navLogo');
const cartBadge = document.getElementById('cartBadge');

// ============================================================
// API HELPERS
// ============================================================
async function fetchData(endpoint) {
  const res = await fetch(`${API_BASE}/${endpoint}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
async function postData(endpoint, data) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
async function putData(endpoint, data) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// ============================================================
// LOAD ALL DATA (including settings)
// ============================================================
async function loadAllData() {
  try {
    state.loading = true;
    const [catsRes, restsRes, prodsRes, offsRes, placesRes, ordersRes, usersRes, settingsRes] = await Promise.all([
      fetchData('categories'),
      fetchData('restaurants'),
      fetchData('products'),
      fetchData('offers'),
      fetchData('places'),
      fetchData('orders'),
      fetchData('customers'),
      fetchData('settings')
    ]);
    categories = catsRes;
    restaurants = restsRes;
    products = prodsRes;
    offers = offsRes;
    orders = ordersRes;
    users = usersRes;

    // Parse settings
    settings.rain_fare = parseFloat(settingsRes.rain_fare) || 20;
    settings.delivery_hours = settingsRes.delivery_hours || '9:00 AM - 10:00 PM';
    settings.unavailable_days = settingsRes.unavailable_days ? JSON.parse(settingsRes.unavailable_days) : [];
    settings.service_unavailable = settingsRes.service_unavailable === 'true';

    const areas = {};
    placesRes.forEach(p => {
      if (!areas[p.area]) areas[p.area] = { subAreas: {} };
      areas[p.area].subAreas[p.sub_area] = p.charge;
    });
    deliveryAreas = areas;

    if (orders.length > 0) {
      const nums = orders.map(o => parseInt(o.order_id.replace('ORD-', '')));
      const max = Math.max(...nums);
      nextOrderNumber = max + 1;
    }

    if (user) {
      const freshUser = users.find(u => u.id === user.id);
      if (freshUser) user = freshUser;
      localStorage.setItem('swingy_user', JSON.stringify(user));
    }

    state.loading = false;
    renderContent();
    updateNavUser();
    updateBadges();
  } catch (err) {
    console.error('Failed to load data:', err);
    state.loading = false;
    showToast('Error connecting to server. Check your backend.');
    renderContent();
  }
}

// ============================================================
// TOAST
// ============================================================
let toastTimeout;

function showToast(message) {
  state.toastMsg = message;
  renderContent();
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    state.toastMsg = null;
    renderContent();
  }, 2500);
}

// ============================================================
// CART
// ============================================================
function saveCart() {
  localStorage.setItem('swingy_cart', JSON.stringify(cart));
}

function updateBadges() {
  const count = cart.length;
  if (cartBadge) {
    if (count > 0) {
      cartBadge.style.display = 'flex';
      cartBadge.textContent = count;
    } else {
      cartBadge.style.display = 'none';
    }
  }
}

function addToCart(product, qty, selectedVariant) {
  const cartItem = {
    ...product,
    quantity: qty,
    selectedVariant: selectedVariant || null
  };
  if (selectedVariant && product.variants && product.variants.length > 0) {
    const variant = product.variants.find(v => v.label === selectedVariant);
    if (variant) {
      cartItem.price = variant.price;
      cartItem.displayName = product.name + ' (' + variant.label + ')';
      cartItem.variantLabel = variant.label;
    }
  } else {
    cartItem.displayName = product.name;
    cartItem.variantLabel = null;
  }

  const existing = cart.find(i => i.id === product.id && i.variantLabel === cartItem.variantLabel);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push(cartItem);
  }
  saveCart();
  updateBadges();
  showToast(`Added ${qty} ${cartItem.displayName}`);
  renderContent();
}

function updateQuantity(id, newQty, variantLabel) {
  if (newQty <= 0) {
    cart = cart.filter(i => !(i.id === id && i.variantLabel === (variantLabel || null)));
  } else {
    const item = cart.find(i => i.id === id && i.variantLabel === (variantLabel || null));
    if (item) item.quantity = newQty;
  }
  saveCart();
  updateBadges();
  renderContent();
}

function removeItem(id, variantLabel) {
  cart = cart.filter(i => !(i.id === id && i.variantLabel === (variantLabel || null)));
  saveCart();
  updateBadges();
  renderContent();
}

// ============================================================
// ORDER SUMMARY (GRAND TOTAL FIXED)
// ============================================================
function proceedToCheckout() {
  if (cart.length === 0) {
    showToast('Your cart is empty!');
    return;
  }

  const grouped = {};
  cart.forEach(item => {
    const cat = item.category || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const categoryTotals = {};
  let subtotal = 0;
  Object.keys(grouped).forEach(cat => {
    const total = grouped[cat].reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    categoryTotals[cat] = total;
    subtotal += total;
  });

  state.orderSummary = {
    items: cart.map(item => ({ ...item })),
    selectedMainArea: '',
    selectedSubArea: '',
    deliveryCharge: 0,
    rainFare: settings.rain_fare || 0,
    grandTotal: subtotal + (settings.rain_fare || 0),
    subtotal: subtotal,
    categoryTotals: categoryTotals
  };

  updateDeliveryCharge();

  state.showOrderSummary = true;
  state.showCart = false;
  state.showPayment = false;

  renderContent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// UPDATE DELIVERY CHARGE (NO renderContent call!)
// ============================================================
function updateDeliveryCharge() {
  const mainArea = state.orderSummary.selectedMainArea;
  const subArea = state.orderSummary.selectedSubArea;
  let delivery = 0;
  if (mainArea && subArea && deliveryAreas[mainArea] && deliveryAreas[mainArea].subAreas[subArea]) {
    delivery = deliveryAreas[mainArea].subAreas[subArea];
  }
  state.orderSummary.deliveryCharge = delivery;
  const rain = settings.rain_fare || 0;
  state.orderSummary.rainFare = rain;
  // GRAND TOTAL = subtotal + delivery + rain
  state.orderSummary.grandTotal = state.orderSummary.subtotal + delivery + rain;
}

function closeOrderSummary() {
  state.showOrderSummary = false;
  renderContent();
}

// ============================================================
// PROCEED TO PAYMENT
// ============================================================
function proceedToPayment() {
  if (!state.orderSummary.selectedMainArea || !state.orderSummary.selectedSubArea) {
    showToast('Please select your delivery area');
    return;
  }
  if (!user) {
    showToast('Please login to place order');
    openLogin();
    return;
  }
  state.showPayment = true;
  state.showOrderSummary = false;
  renderContent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// RENDER PAYMENT PAGE (COD + UPI placeholder)
// ============================================================
function renderPaymentPage() {
  if (!state.showPayment) return null;

  updateDeliveryCharge();

  const container = document.createElement('div');
  container.className = 'fixed inset-0 z-50 overflow-y-auto bg-gray-50 p-4 md:p-6';

  const content = document.createElement('div');
  content.className = 'max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-6';

  const header = document.createElement('div');
  header.className = 'flex justify-between items-center border-b pb-4 mb-4';
  header.innerHTML = `
    <h2 class="text-2xl font-bold">💳 Payment</h2>
    <button onclick="closePayment()" class="text-gray-500 hover:text-gray-700 text-2xl">
      <i class="fas fa-times"></i>
    </button>
  `;
  content.appendChild(header);

  const summaryDiv = document.createElement('div');
  summaryDiv.className = 'mb-6';
  const grouped = state.orderSummary.categoryTotals;
  const items = state.orderSummary.items;
  let itemsHtml = '';
  Object.keys(grouped).forEach(cat => {
    const catItems = items.filter(item => (item.category || 'Uncategorized') === cat);
    const catTotal = grouped[cat];
    itemsHtml += `<div class="font-semibold text-primary text-sm mt-2">${cat}</div>`;
    catItems.forEach(item => {
      const displayName = item.displayName || item.name;
      itemsHtml += `<div class="flex justify-between text-sm py-1"><span>${displayName} × ${item.quantity}</span><span>₹${(item.price || 0) * item.quantity}</span></div>`;
    });
    itemsHtml += `<div class="flex justify-between text-sm font-semibold border-b border-gray-100 py-1"><span>Subtotal</span><span>₹${catTotal}</span></div>`;
  });
  summaryDiv.innerHTML = `
    <h3 class="font-semibold text-lg mb-2">Order Summary</h3>
    ${itemsHtml}
    <div class="flex justify-between mt-2 pt-2 border-t">
      <span>Subtotal</span>
      <span>₹${state.orderSummary.subtotal}</span>
    </div>
    <div class="flex justify-between">
      <span>Delivery</span>
      <span>₹${state.orderSummary.deliveryCharge}</span>
    </div>
    <div class="flex justify-between">
      <span>Rain Fare</span>
      <span>₹${state.orderSummary.rainFare}</span>
    </div>
    <div class="flex justify-between font-bold text-lg text-primary mt-2 pt-2 border-t">
      <span>Grand Total</span>
      <span>₹${state.orderSummary.grandTotal}</span>
    </div>
  `;
  content.appendChild(summaryDiv);

  const paymentDiv = document.createElement('div');
  paymentDiv.className = 'mb-4';
  paymentDiv.innerHTML = `
    <h3 class="font-semibold text-lg mb-2">Choose Payment Method</h3>
    <div class="flex flex-col gap-3">
      <button onclick="confirmPayment('cod')" class="gradient-btn text-white py-3 rounded-xl font-semibold w-full">
        <i class="fas fa-hand-holding-usd mr-2"></i> Cash on Delivery
      </button>
      <button onclick="confirmPayment('upi')" class="btn btn-outline py-3 rounded-xl font-semibold w-full border-2 border-primary text-primary hover:bg-primary hover:text-white transition">
        <i class="fas fa-credit-card mr-2"></i> UPI / Bank (Coming Soon)
      </button>
    </div>
  `;
  content.appendChild(paymentDiv);

  const backBtn = document.createElement('button');
  backBtn.className = 'text-gray-600 hover:text-gray-800 font-medium mt-4';
  backBtn.textContent = '← Back to Order Summary';
  backBtn.addEventListener('click', () => {
    state.showPayment = false;
    state.showOrderSummary = true;
    renderContent();
  });
  content.appendChild(backBtn);

  container.appendChild(content);
  return container;
}

// ============================================================
// CONFIRM PAYMENT
// ============================================================
async function confirmPayment(method) {
  if (method === 'upi') {
    showToast('UPI/Razorpay integration coming soon!');
    return;
  }
  // COD – place order immediately
  await placeOrder();
  state.showPayment = false;
  state.showOrderSummary = false;
  renderContent();
}

function closePayment() {
  state.showPayment = false;
  renderContent();
}

// ============================================================
// PLACE ORDER
// ============================================================
async function placeOrder() {
  const orderNumber = 'ORD-' + String(nextOrderNumber).padStart(4, '0');
  nextOrderNumber++;

  const itemsWithCommission = cart.map(item => ({
    ...item,
    commission: item.commission || 0
  }));
  const productTotal = state.orderSummary.subtotal;
  const deliveryCharge = state.orderSummary.deliveryCharge;
  const rainFare = state.orderSummary.rainFare;
  const commissionAmount = itemsWithCommission.reduce(
    (sum, item) => sum + (item.price * item.quantity * (item.commission || 0) / 100),
    0
  );
  const adminProfit = commissionAmount + deliveryCharge + rainFare;
  const grandTotal = productTotal + deliveryCharge + rainFare;

  const newOrder = {
    orderId: orderNumber,
    customerId: user ? user.id : 1,
    items: itemsWithCommission.map(item => ({
      name: item.displayName || item.name,
      price: item.price,
      quantity: item.quantity,
      commission: item.commission || 0,
      category: item.category || 'Uncategorized',
      variantLabel: item.variantLabel || null
    })),
    productTotal,
    deliveryCharge,
    rainFare,
    commissionAmount,
    adminProfit,
    grandTotal,
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    status: 'Pending',
    deliveryAddress: `${state.orderSummary.selectedSubArea}, ${state.orderSummary.selectedMainArea}`
  };

  try {
    const created = await postData('orders', newOrder);
    orders.unshift(created);

    if (user) {
      const cust = users.find(u => u.id === user.id);
      if (cust) {
        cust.total_orders = (cust.total_orders || 0) + 1;
        cust.total_spent = (cust.total_spent || 0) + grandTotal;
        cust.last_order = new Date().toISOString();
        try {
          await putData(`customers/${user.id}`, {
            total_orders: cust.total_orders,
            total_spent: cust.total_spent,
            last_order: cust.last_order
          });
        } catch (e) { /* ignore */ }
        user = cust;
        localStorage.setItem('swingy_user', JSON.stringify(user));
      }
    }
    cart = [];
    saveCart();
    updateBadges();
    state.showOrderSummary = false;
    state.showPayment = false;
    showToast('✅ Order placed! #' + orderNumber);
    renderContent();
  } catch (err) {
    showToast('❌ Failed to place order: ' + err.message);
  }
}

// ============================================================
// USER AUTHENTICATION
// ============================================================
// --- DESKTOP ACCOUNT DROPDOWN ---
let accountDropdownOpen = false;

function toggleAccountDropdown(e) {
  e.stopPropagation();
  const menu = document.getElementById('accountDropdownMenu');
  if (!menu) return;
  accountDropdownOpen = !accountDropdownOpen;
  menu.classList.toggle('open', accountDropdownOpen);
}

function closeAccountDropdown() {
  const menu = document.getElementById('accountDropdownMenu');
  if (menu) {
    menu.classList.remove('open');
    accountDropdownOpen = false;
  }
}

document.addEventListener('click', function(e) {
  const container = document.getElementById('navUser');
  if (container && !container.contains(e.target)) {
    closeAccountDropdown();
  }
});

function showContactSupport() {
  closeAccountDropdown();
  openModal(`
    <h2 class="text-xl font-bold mb-4">📞 Contact Support</h2>
    <div class="space-y-3 text-gray-700">
      <p><i class="fas fa-envelope text-primary w-6"></i> musthaqmohammad10@gmail.com</p>
      <p><i class="fas fa-phone text-primary w-6"></i> +91 9019825189</p>
      <p><i class="fas fa-phone text-primary w-6"></i> +91 8277079552</p>
      <p class="text-sm text-gray-500 mt-2">We're here to help! Reach out anytime.</p>
    </div>
  `);
}

function updateNavUser() {
  const navUser = document.getElementById('navUser');
  if (!navUser) return;

  if (user) {
    navUser.innerHTML = `
      <div class="account-dropdown">
        <div class="avatar" onclick="toggleAccountDropdown(event)" title="Account">
          <i class="fas fa-user-circle"></i>
        </div>
        <div id="accountDropdownMenu" class="dropdown-menu">
          <div class="user-info">👋 ${user.first_name}</div>
          <div class="divider"></div>
          <button onclick="showContactSupport()">
            <i class="fas fa-headset"></i> Contact Support
          </button>
          <button onclick="logout()">
            <i class="fas fa-sign-out-alt text-red-500"></i> Logout
          </button>
        </div>
      </div>
    `;
  } else {
    navUser.innerHTML = `
      <div class="account-dropdown">
        <div class="avatar" onclick="toggleAccountDropdown(event)" title="Account">
          <i class="fas fa-user-circle"></i>
        </div>
        <div id="accountDropdownMenu" class="dropdown-menu">
          <button onclick="openLogin(); closeAccountDropdown();">
            <i class="fas fa-sign-in-alt"></i> Login / Sign Up
          </button>
          <div class="divider"></div>
          <button onclick="showContactSupport()">
            <i class="fas fa-headset"></i> Contact Support
          </button>
        </div>
      </div>
    `;
  }
}

function openLogin() {
  closeAccountDropdown();
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('signupForm').classList.add('hidden');
  document.getElementById('loginOtpSection').classList.add('hidden');
  document.getElementById('signupOtpSection').classList.add('hidden');
  document.getElementById('loginTabBtn').className = 'flex-1 py-2 text-center font-semibold text-primary border-b-2 border-primary';
  document.getElementById('signupTabBtn').className = 'flex-1 py-2 text-center font-semibold text-gray-400 border-b-2 border-transparent';
}

function closeLogin() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.classList.add('hidden');
}

function switchTab(tab) {
  if (tab === 'login') {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('loginTabBtn').className = 'flex-1 py-2 text-center font-semibold text-primary border-b-2 border-primary';
    document.getElementById('signupTabBtn').className = 'flex-1 py-2 text-center font-semibold text-gray-400 border-b-2 border-transparent';
    document.getElementById('loginOtpSection').classList.add('hidden');
  } else {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.remove('hidden');
    document.getElementById('signupTabBtn').className = 'flex-1 py-2 text-center font-semibold text-primary border-b-2 border-primary';
    document.getElementById('loginTabBtn').className = 'flex-1 py-2 text-center font-semibold text-gray-400 border-b-2 border-transparent';
    document.getElementById('signupOtpSection').classList.add('hidden');
  }
}

async function sendLoginOtp() {
  const phone = document.getElementById('loginPhone').value.trim();
  if (!phone || phone.length < 10) {
    showToast('Please enter a valid phone number');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
    otpCode = data.otp;
    showToast(`OTP sent: ${otpCode} (demo)`);
    document.getElementById('loginOtpSection').classList.remove('hidden');
    document.getElementById('loginSendOtpBtn').textContent = 'Resend OTP';
  } catch (err) {
    showToast(err.message);
  }
}

async function verifyLoginOtp() {
  const phone = document.getElementById('loginPhone').value.trim();
  const otp = document.getElementById('loginOtp').value.trim();
  if (!otp) { showToast('Enter OTP'); return; }
  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');
    user = data.user;
    localStorage.setItem('swingy_user', JSON.stringify(user));
    closeLogin();
    showToast(`Welcome ${user.first_name}!`);
    users = await fetchData('customers');
    orders = await fetchData('orders');
    updateNavUser();
    renderContent();
  } catch (err) {
    showToast(err.message);
  }
}

async function sendSignupOtp() {
  const phone = document.getElementById('signupPhone').value.trim();
  const firstName = document.getElementById('signupFirstName').value.trim();
  const lastName = document.getElementById('signupLastName').value.trim();
  const address = document.getElementById('signupAddress').value.trim();
  const pincode = document.getElementById('signupPincode').value.trim();
  if (!firstName || !lastName || !address || !pincode || !phone || phone.length < 10) {
    showToast('Please fill all mandatory fields and valid phone');
    return;
  }
  window.signupData = { firstName, lastName, address, pincode, phone };
  try {
    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
    otpCode = data.otp;
    showToast(`OTP sent: ${otpCode} (demo)`);
    document.getElementById('signupOtpSection').classList.remove('hidden');
    document.getElementById('signupSendOtpBtn').textContent = 'Resend OTP';
  } catch (err) {
    showToast(err.message);
  }
}

async function verifySignupOtp() {
  const otp = document.getElementById('signupOtp').value.trim();
  if (!otp) { showToast('Enter OTP'); return; }
  const data = window.signupData;
  if (!data) { showToast('Please fill details first'); return; }
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, otp })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Registration failed');
    user = result.user;
    localStorage.setItem('swingy_user', JSON.stringify(user));
    closeLogin();
    showToast(`Welcome ${user.first_name}!`);
    users = await fetchData('customers');
    updateNavUser();
    renderContent();
  } catch (err) {
    showToast(err.message);
  }
}

function logout() {
  user = null;
  localStorage.removeItem('swingy_user');
  updateNavUser();
  renderContent();
  showToast('Logged out');
}

// ============================================================
// CLOSE MODALS
// ============================================================
function closeAllModals(except) {
  if (except !== 'cart') state.showCart = false;
  if (except !== 'orders') state.showOrders = false;
  if (except !== 'category') state.showCategoryModal = false;
  if (except !== 'account') state.showAccountDrawer = false;
  if (except !== 'summary') state.showOrderSummary = false;
  if (except !== 'payment') state.showPayment = false;
}

// ============================================================
// NAVIGATION
// ============================================================
function onCategoryClick(catName) {
  state.selectedCategory = catName;
  state.selectedRestaurant = null;
  state.searchTerm = '';
  if (searchInput) searchInput.value = '';
  if (searchInputMobile) searchInputMobile.value = '';
  state.showCategoryModal = false;
  renderContent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
  state.selectedCategory = '';
  state.selectedRestaurant = null;
  state.searchTerm = '';
  if (searchInput) searchInput.value = '';
  if (searchInputMobile) searchInputMobile.value = '';
  state.showOrderSummary = false;
  state.showPayment = false;
  renderContent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectRestaurant(restaurant) {
  state.selectedRestaurant = restaurant;
  renderContent();
}

function backToRestaurants() {
  state.selectedRestaurant = null;
  renderContent();
}

function toggleCart() {
  closeAllModals('cart');
  state.showCart = !state.showCart;
  renderContent();
}

function toggleOrders() {
  closeAllModals('orders');
  state.showOrders = !state.showOrders;
  renderContent();
}

function toggleCategoryModal() {
  closeAllModals('category');
  state.showCategoryModal = !state.showCategoryModal;
  renderContent();
}

function toggleAccountDrawer() {
  closeAllModals('account');
  state.showAccountDrawer = !state.showAccountDrawer;
  renderContent();
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================
function renderProductCard(product, onAdd) {
  const container = document.createElement('div');
  container.className = 'product-card bg-white rounded-xl shadow-md overflow-hidden';
  let qty = 1;
  let selectedVariant = null;

  const image = document.createElement('img');
  image.src = product.images && product.images.length > 0 ? product.images[0] : 'https://placehold.co/400x400';
  image.alt = product.name;
  image.className = 'w-full h-36 object-cover';
  container.appendChild(image);

  const body = document.createElement('div');
  body.className = 'p-3';

  const name = document.createElement('h3');
  name.className = 'font-semibold text-gray-800 text-sm';
  name.textContent = product.name;
  body.appendChild(name);

  // Check if product has variants
  let hasVariants = product.variants && product.variants.length > 0;

  if (hasVariants) {
    // Variant dropdown
    const variantSelect = document.createElement('select');
    variantSelect.className = 'w-full text-sm border rounded px-2 py-1 mt-1 bg-white';
    variantSelect.id = `variant-${product.id}`;
    product.variants.forEach((v, idx) => {
      const opt = document.createElement('option');
      opt.value = v.label;
      opt.textContent = `${v.label} - ₹${v.price}`;
      if (idx === 0) opt.selected = true;
      variantSelect.appendChild(opt);
    });
    variantSelect.addEventListener('change', function() {
      selectedVariant = this.value;
      const variant = product.variants.find(v => v.label === selectedVariant);
      if (variant) {
        priceSpan.textContent = `₹${variant.price}`;
      }
    });
    body.appendChild(variantSelect);
    // Set initial selected variant
    selectedVariant = product.variants[0].label;
  }

  const ratingDiv = document.createElement('div');
  ratingDiv.className = 'flex items-center gap-1 mb-1 mt-1';
  ratingDiv.innerHTML = `<i class="fas fa-star text-yellow-400 text-xs"></i><span class="text-xs">4.5</span>`;
  body.appendChild(ratingDiv);

  const weight = document.createElement('p');
  weight.className = 'text-gray-400 text-xs';
  weight.textContent = '1 pc';
  body.appendChild(weight);

  const bottom = document.createElement('div');
  bottom.className = 'flex items-center justify-between mt-2';

  const priceDiv = document.createElement('div');
  const priceSpan = document.createElement('span');
  priceSpan.className = 'text-primary font-bold';
  if (hasVariants) {
    priceSpan.textContent = `₹${product.variants[0].price}`;
  } else {
    priceSpan.textContent = `₹${product.price}`;
  }
  priceDiv.appendChild(priceSpan);
  bottom.appendChild(priceDiv);

  const controls = document.createElement('div');
  controls.className = 'flex items-center gap-1';
  const minusBtn = document.createElement('button');
  minusBtn.className = 'w-7 h-7 rounded-full bg-gray-100';
  minusBtn.textContent = '-';
  minusBtn.addEventListener('click', () => {
    qty = Math.max(1, qty - 1);
    qtyDisplay.textContent = qty;
  });
  controls.appendChild(minusBtn);

  const qtyDisplay = document.createElement('span');
  qtyDisplay.className = 'w-6 text-center text-sm';
  qtyDisplay.textContent = qty;
  controls.appendChild(qtyDisplay);

  const plusBtn = document.createElement('button');
  plusBtn.className = 'w-7 h-7 rounded-full bg-gray-100';
  plusBtn.textContent = '+';
  plusBtn.addEventListener('click', () => {
    qty += 1;
    qtyDisplay.textContent = qty;
  });
  controls.appendChild(plusBtn);

  const addBtn = document.createElement('button');
  addBtn.className = 'gradient-btn text-white px-3 py-1 rounded-full text-xs';
  addBtn.textContent = 'Add';
  addBtn.addEventListener('click', () => {
    if (hasVariants) {
      selectedVariant = document.getElementById(`variant-${product.id}`).value;
    }
    onAdd(product, qty, selectedVariant);
    qty = 1;
    qtyDisplay.textContent = qty;
  });
  controls.appendChild(addBtn);

  bottom.appendChild(controls);
  body.appendChild(bottom);
  container.appendChild(body);

  return container;
}

function renderRestaurantCard(restaurant) {
  const container = document.createElement('div');
  container.className = 'restaurant-card bg-white rounded-xl shadow-md overflow-hidden cursor-pointer';
  container.addEventListener('click', () => selectRestaurant(restaurant));
  const img = document.createElement('img');
  img.src = restaurant.logo || 'https://placehold.co/400x300';
  img.alt = restaurant.name;
  img.className = 'w-full h-40 object-cover';
  container.appendChild(img);
  const body = document.createElement('div');
  body.className = 'p-4';
  const header = document.createElement('div');
  header.className = 'flex justify-between items-start mb-2';
  const name = document.createElement('h3');
  name.className = 'font-bold text-lg';
  name.textContent = restaurant.name;
  header.appendChild(name);
  const type = document.createElement('span');
  type.className = 'bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full';
  type.textContent = 'Restaurant';
  header.appendChild(type);
  body.appendChild(header);
  const info = document.createElement('div');
  info.className = 'flex items-center gap-2 mb-2';
  info.innerHTML = `<i class="fas fa-star text-yellow-400"></i><span>4.5</span><span class="text-gray-400">•</span><span>20-30 min</span>`;
  body.appendChild(info);
  const cuisine = document.createElement('p');
  cuisine.className = 'text-gray-500 text-sm';
  cuisine.textContent = restaurant.category || 'Multi-cuisine';
  body.appendChild(cuisine);
  const btn = document.createElement('button');
  btn.className = 'gradient-btn text-white px-4 py-2 rounded-full text-sm w-full mt-3';
  btn.textContent = 'View Menu →';
  body.appendChild(btn);
  container.appendChild(body);
  return container;
}

function renderCategoryPage() {
  const container = document.createElement('div');
  container.className = 'px-4 my-8';
  const backBtn = document.createElement('button');
  backBtn.className = 'text-2xl text-gray-600 hover:text-primary transition-colors hidden md:inline-flex items-center gap-2 mb-4';
  backBtn.innerHTML = '<i class="fas fa-arrow-left"></i>';
  backBtn.title = 'Back to Home';
  backBtn.addEventListener('click', goHome);
  container.appendChild(backBtn);
  if (state.selectedRestaurant) {
    const header = document.createElement('div');
    header.className = 'flex items-center gap-4 mb-6';
    const backToRestaurantsBtn = document.createElement('button');
    backToRestaurantsBtn.className = 'text-primary font-semibold';
    backToRestaurantsBtn.innerHTML = '<i class="fas fa-arrow-left mr-2"></i>Back to Restaurants';
    backToRestaurantsBtn.addEventListener('click', backToRestaurants);
    header.appendChild(backToRestaurantsBtn);
    const title = document.createElement('h2');
    title.className = 'text-2xl font-bold';
    title.textContent = state.selectedRestaurant.name;
    header.appendChild(title);
    container.appendChild(header);
    const menuItems = products.filter(p => p.restaurant_id === state.selectedRestaurant.id && p.status === 'Active');
    if (menuItems.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'text-gray-500 text-center py-8';
      msg.textContent = 'No items available in this restaurant.';
      container.appendChild(msg);
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
      menuItems.forEach(item => {
        const card = renderProductCard(item, addToCart);
        grid.appendChild(card);
      });
      container.appendChild(grid);
    }
    return container;
  }
  const heading = document.createElement('h2');
  heading.className = 'text-2xl font-bold mb-4';
  heading.textContent = state.selectedCategory;
  container.appendChild(heading);
  if (state.selectedCategory === 'Food') {
    const foodRestaurants = restaurants.filter(r => r.category === 'Food' && r.status === 'Active');
    if (foodRestaurants.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'text-gray-500 text-center py-8';
      msg.textContent = 'No restaurants available in this category.';
      container.appendChild(msg);
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
      foodRestaurants.forEach(rest => {
        const card = renderRestaurantCard(rest);
        grid.appendChild(card);
      });
      container.appendChild(grid);
    }
  } else {
    const catProducts = products.filter(p => p.category === state.selectedCategory && p.status === 'Active');
    if (catProducts.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'text-gray-500 text-center py-8';
      msg.textContent = 'No products found in this category.';
      container.appendChild(msg);
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
      catProducts.forEach(p => {
        const card = renderProductCard(p, addToCart);
        grid.appendChild(card);
      });
      container.appendChild(grid);
    }
  }
  return container;
}

function renderAccountDrawer() {
  if (!state.showAccountDrawer) return null;
  const container = document.createElement('div');
  container.className = 'fixed inset-0 z-50';
  const backdrop = document.createElement('div');
  backdrop.className = 'absolute inset-0 bg-black bg-opacity-50';
  backdrop.addEventListener('click', toggleAccountDrawer);
  container.appendChild(backdrop);
  const drawer = document.createElement('div');
  drawer.className = 'absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl overflow-y-auto p-6';
  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6';
  const title = document.createElement('h2');
  title.className = 'text-2xl font-bold';
  title.textContent = 'Account';
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<i class="fas fa-times text-2xl"></i>';
  closeBtn.addEventListener('click', toggleAccountDrawer);
  header.appendChild(closeBtn);
  drawer.appendChild(header);
  if (user) {
    const details = document.createElement('div');
    details.className = 'space-y-3 text-gray-700';
    details.innerHTML = `
      <p><span class="font-semibold">Name:</span> ${user.first_name} ${user.last_name}</p>
      <p><span class="font-semibold">Phone:</span> ${user.phone}</p>
      <p><span class="font-semibold">Address:</span> ${user.address}</p>
      <p><span class="font-semibold">Pincode:</span> ${user.pincode}</p>
    `;
    drawer.appendChild(details);
    const care = document.createElement('div');
    care.className = 'mt-6 p-4 bg-gray-50 rounded-xl';
    care.innerHTML = `
      <h3 class="font-bold text-primary">Customer Care</h3>
      <p class="text-sm mt-1">📞 +91 9019825189 & +91 8277079552</p>
      <p class="text-sm">✉️ musthaqmohammad10@gmail.com</p>
    `;
    drawer.appendChild(care);
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'gradient-btn w-full text-white py-3 rounded-full mt-6';
    logoutBtn.textContent = 'Logout';
    logoutBtn.addEventListener('click', () => {
      logout();
      toggleAccountDrawer();
    });
    drawer.appendChild(logoutBtn);
  } else {
    const msg = document.createElement('p');
    msg.className = 'text-gray-500 text-center py-4';
    msg.textContent = 'You are not logged in.';
    drawer.appendChild(msg);
    const loginBtn = document.createElement('button');
    loginBtn.className = 'gradient-btn w-full text-white py-3 rounded-full mt-4';
    loginBtn.textContent = 'Login';
    loginBtn.addEventListener('click', () => {
      toggleAccountDrawer();
      openLogin();
    });
    drawer.appendChild(loginBtn);
    const care = document.createElement('div');
    care.className = 'mt-6 p-4 bg-gray-50 rounded-xl';
    care.innerHTML = `
      <h3 class="font-bold text-primary">Customer Care</h3>
      <p class="text-sm mt-1">📞 +91 9019825189 & +91 8277079552</p>
      <p class="text-sm">✉️ musthaqmohammad10@gmail.com</p>
    `;
    drawer.appendChild(care);
  }
  container.appendChild(drawer);
  return container;
}

// ============================================================
// RENDER ORDER SUMMARY (FIXED – no infinite loop)
// ============================================================
function renderOrderSummary() {
  if (!state.showOrderSummary) return null;

  // Calculate delivery charge (will not trigger re-render)
  updateDeliveryCharge();

  const container = document.createElement('div');
  container.className = 'fixed inset-0 z-50 overflow-y-auto bg-gray-50';
  const backdrop = document.createElement('div');
  backdrop.className = 'fixed inset-0 bg-black/50 z-40';
  backdrop.addEventListener('click', closeOrderSummary);
  container.appendChild(backdrop);
  const content = document.createElement('div');
  content.className = 'relative z-50 max-w-4xl mx-auto p-4 md:p-6 min-h-screen';
  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-6 bg-white rounded-xl p-4 shadow-md';
  header.innerHTML = `
    <h2 class="text-2xl font-bold text-gray-800">📋 Order Summary</h2>
    <button onclick="closeOrderSummary()" class="text-gray-500 hover:text-gray-700 text-2xl">
      <i class="fas fa-times"></i>
    </button>
  `;
  content.appendChild(header);
  const itemsSection = document.createElement('div');
  itemsSection.className = 'bg-white rounded-xl p-4 shadow-md mb-4';
  const itemsTitle = document.createElement('h3');
  itemsTitle.className = 'font-semibold text-lg mb-3 text-gray-700';
  itemsTitle.textContent = '🛒 Your Items';
  itemsSection.appendChild(itemsTitle);
  const grouped = state.orderSummary.categoryTotals;
  const items = state.orderSummary.items;
  Object.keys(grouped).forEach(cat => {
    const catItems = items.filter(item => (item.category || 'Uncategorized') === cat);
    const catTotal = grouped[cat];
    const catDiv = document.createElement('div');
    catDiv.className = 'mb-3 border-b border-gray-100 pb-3';
    const catHeader = document.createElement('div');
    catHeader.className = 'flex justify-between items-center mb-2';
    catHeader.innerHTML = `
      <span class="font-semibold text-primary">${cat}</span>
      <span class="text-sm font-medium text-gray-600">₹${catTotal}</span>
    `;
    catDiv.appendChild(catHeader);
    catItems.forEach(item => {
      const displayName = item.displayName || item.name;
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center text-sm py-1 px-2 hover:bg-gray-50 rounded';
      row.innerHTML = `
        <span>${displayName} × ${item.quantity}</span>
        <span class="text-gray-600">₹${(item.price || 0) * item.quantity}</span>
      `;
      catDiv.appendChild(row);
    });
    itemsSection.appendChild(catDiv);
  });
  const subtotalDiv = document.createElement('div');
  subtotalDiv.className = 'flex justify-between items-center pt-2 font-semibold text-gray-700';
  subtotalDiv.innerHTML = `
    <span>Subtotal</span>
    <span>₹${state.orderSummary.subtotal}</span>
  `;
  itemsSection.appendChild(subtotalDiv);
  content.appendChild(itemsSection);
  const addressSection = document.createElement('div');
  addressSection.className = 'bg-white rounded-xl p-4 shadow-md mb-4';
  const addressTitle = document.createElement('h3');
  addressTitle.className = 'font-semibold text-lg mb-3 text-gray-700';
  addressTitle.textContent = '📍 Delivery Address';
  addressSection.appendChild(addressTitle);
  const mainAreaDiv = document.createElement('div');
  mainAreaDiv.className = 'mb-3';
  const mainLabel = document.createElement('label');
  mainLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
  mainLabel.textContent = 'Main Area';
  mainAreaDiv.appendChild(mainLabel);
  const mainSelect = document.createElement('select');
  mainSelect.className = 'w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none';
  mainSelect.id = 'mainAreaSelect';
  const defaultMain = document.createElement('option');
  defaultMain.value = '';
  defaultMain.textContent = 'Select Main Area';
  mainSelect.appendChild(defaultMain);
  Object.keys(deliveryAreas).forEach(area => {
    const opt = document.createElement('option');
    opt.value = area;
    opt.textContent = area;
    mainSelect.appendChild(opt);
  });
  if (state.orderSummary.selectedMainArea) {
    mainSelect.value = state.orderSummary.selectedMainArea;
  }
  mainSelect.addEventListener('change', function() {
    const mainArea = this.value;
    state.orderSummary.selectedMainArea = mainArea;
    state.orderSummary.selectedSubArea = '';
    const subSelect = document.getElementById('subAreaSelect');
    subSelect.innerHTML = '';
    const defaultSub = document.createElement('option');
    defaultSub.value = '';
    defaultSub.textContent = 'Select Sub-Area';
    subSelect.appendChild(defaultSub);
    if (mainArea && deliveryAreas[mainArea]) {
      const subAreas = deliveryAreas[mainArea].subAreas;
      Object.keys(subAreas).forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = `${sub} (₹${subAreas[sub]} delivery)`;
        subSelect.appendChild(opt);
      });
    }
    updateDeliveryCharge();
    renderContent();
  });
  mainAreaDiv.appendChild(mainSelect);
  addressSection.appendChild(mainAreaDiv);
  const subAreaDiv = document.createElement('div');
  subAreaDiv.className = 'mb-3';
  const subLabel = document.createElement('label');
  subLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
  subLabel.textContent = 'Sub-Area';
  subAreaDiv.appendChild(subLabel);
  const subSelect = document.createElement('select');
  subSelect.id = 'subAreaSelect';
  subSelect.className = 'w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none';
  const defaultSub = document.createElement('option');
  defaultSub.value = '';
  defaultSub.textContent = 'Select Sub-Area';
  subSelect.appendChild(defaultSub);
  if (state.orderSummary.selectedMainArea && deliveryAreas[state.orderSummary.selectedMainArea]) {
    const subAreas = deliveryAreas[state.orderSummary.selectedMainArea].subAreas;
    Object.keys(subAreas).forEach(sub => {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.textContent = `${sub} (₹${subAreas[sub]} delivery)`;
      subSelect.appendChild(opt);
    });
  }
  if (state.orderSummary.selectedSubArea) {
    subSelect.value = state.orderSummary.selectedSubArea;
  }
  subSelect.addEventListener('change', function() {
    state.orderSummary.selectedSubArea = this.value;
    updateDeliveryCharge();
    renderContent();
  });
  subAreaDiv.appendChild(subSelect);
  addressSection.appendChild(subAreaDiv);
  const rainFareDiv = document.createElement('div');
  rainFareDiv.className = 'flex justify-between items-center text-sm text-gray-600 border-t border-gray-100 pt-2 mt-2';
  rainFareDiv.innerHTML = `
    <span>Rain Fare</span>
    <span>₹${state.orderSummary.rainFare}</span>
  `;
  addressSection.appendChild(rainFareDiv);
  const deliveryChargeDiv = document.createElement('div');
  deliveryChargeDiv.className = 'flex justify-between items-center text-sm text-gray-600 border-t border-gray-100 pt-2';
  deliveryChargeDiv.innerHTML = `
    <span>Delivery Charge</span>
    <span>₹${state.orderSummary.deliveryCharge}</span>
  `;
  addressSection.appendChild(deliveryChargeDiv);
  content.appendChild(addressSection);
  const totalSection = document.createElement('div');
  totalSection.className = 'bg-white rounded-xl p-4 shadow-md mb-4';
  const totalRow = document.createElement('div');
  totalRow.className = 'flex justify-between items-center text-xl font-bold text-primary';
  totalRow.innerHTML = `
    <span>Grand Total</span>
    <span>₹${state.orderSummary.grandTotal}</span>
  `;
  totalSection.appendChild(totalRow);
  const proceedBtn = document.createElement('button');
  proceedBtn.className = 'gradient-btn w-full text-white py-3 rounded-xl font-semibold text-lg mt-4 hover:scale-[1.02] transition-transform';
  proceedBtn.textContent = 'Proceed to Payment →';
  proceedBtn.addEventListener('click', proceedToPayment);
  totalSection.appendChild(proceedBtn);
  const backBtn = document.createElement('button');
  backBtn.className = 'w-full mt-2 text-gray-600 hover:text-gray-800 font-medium py-2';
  backBtn.textContent = '← Back to Cart';
  backBtn.addEventListener('click', () => {
    state.showOrderSummary = false;
    state.showCart = true;
    renderContent();
  });
  totalSection.appendChild(backBtn);
  content.appendChild(totalSection);
  container.appendChild(content);
  return container;
}

function renderHero() {
  const container = document.createElement('div');
  container.className = 'bg-gradient-to-r from-blue-600 to-primary rounded-2xl mx-4 my-4 p-8 text-white';
  container.innerHTML = `
    <h1 class="text-3xl md:text-5xl font-bold mb-4">Groceries & Meat Delivered in Minutes</h1>
    <p class="text-lg mb-6">Fresh groceries, premium meat and more – delivered fast.</p>
    <button class="bg-white text-primary px-8 py-3 rounded-full font-bold">Shop Now →</button>
  `;
  const btn = container.querySelector('button');
  btn.addEventListener('click', () => {
    const productsSection = document.querySelector('.px-4.my-8');
    if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth' });
  });
  return container;
}

function renderTrustBanner() {
  const container = document.createElement('div');
  container.className = 'bg-white shadow-sm py-3 mb-6';
  container.innerHTML = `
    <div class="container mx-auto px-4">
      <div class="flex flex-wrap justify-around gap-4">
        <div class="flex items-center gap-2"><i class="fas fa-motorcycle text-primary"></i><span class="text-sm">Fastest Delivery</span></div>
        <div class="flex items-center gap-2"><i class="fas fa-leaf text-primary"></i><span class="text-sm">100% fresh</span></div>
        <div class="flex items-center gap-2"><i class="fas fa-tag text-primary"></i><span class="text-sm">Best price</span></div>
        <div class="flex items-center gap-2"><i class="fas fa-shield-alt text-primary"></i><span class="text-sm">Secure payments</span></div>
      </div>
    </div>
  `;
  return container;
}

function renderCategoriesSection() {
  const container = document.createElement('div');
  container.className = 'px-4 my-8 hidden md:block';
  const heading = document.createElement('h2');
  heading.className = 'text-2xl font-bold mb-4';
  heading.textContent = 'Shop by Category';
  container.appendChild(heading);
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4';
  const catList = categories.length > 0 ? categories : [];
  catList.forEach(cat => {
    const iconData = categoryIcons[cat.name] || { icon: 'fa-tag', color: 'bg-gray-100', iconColor: 'text-gray-600' };
    const card = document.createElement('div');
    card.className = 'category-card flex flex-col items-center gap-2 cursor-pointer p-3 rounded-xl bg-white hover:shadow-lg transition-all';
    card.addEventListener('click', () => onCategoryClick(cat.name));
    const iconDiv = document.createElement('div');
    iconDiv.className = `${iconData.color} w-16 h-16 rounded-full flex items-center justify-center shadow-md`;
    iconDiv.innerHTML = `<i class="fas ${iconData.icon} text-2xl ${iconData.iconColor}"></i>`;
    card.appendChild(iconDiv);
    const nameSpan = document.createElement('span');
    nameSpan.className = 'text-sm font-semibold text-gray-700';
    nameSpan.textContent = cat.name;
    card.appendChild(nameSpan);
    let count = 0;
    if (cat.name === 'Food') {
      count = restaurants.filter(r => r.category === 'Food' && r.status === 'Active').length;
    } else {
      count = products.filter(p => p.category === cat.name && p.status === 'Active').length;
    }
    const itemsSpan = document.createElement('span');
    itemsSpan.className = 'text-xs text-gray-400';
    itemsSpan.textContent = `${count} items`;
    card.appendChild(itemsSpan);
    grid.appendChild(card);
  });
  container.appendChild(grid);
  return container;
}

function renderOffersSection() {
  const container = document.createElement('div');
  container.className = 'px-4 my-8';
  const heading = document.createElement('h2');
  heading.className = 'text-2xl font-bold mb-4';
  heading.textContent = '🎁 Today\'s Best Offers';
  container.appendChild(heading);
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 md:grid-cols-3 gap-4';
  offers.forEach(offer => {
    const card = document.createElement('div');
    card.className = 'rounded-2xl p-5 text-white shadow-lg';
    card.style.background = offer.bg;
    card.innerHTML = `
      <i class="fas ${offer.icon} text-3xl mb-2"></i>
      <h3 class="text-xl font-bold">${offer.title}</h3>
      <p class="text-2xl font-bold mt-2">${offer.discount}</p>
      <code class="inline-block bg-white/20 px-2 py-1 rounded-lg text-sm mt-2">${offer.code}</code>
    `;
    grid.appendChild(card);
  });
  container.appendChild(grid);
  return container;
}

function renderProductsGrid() {
  const container = document.createElement('div');
  container.className = 'px-4 my-8';
  let filtered = products;
  if (state.searchTerm) {
    filtered = products.filter(p =>
      p.name.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(state.searchTerm.toLowerCase())
    );
    const heading = document.createElement('h2');
    heading.className = 'text-2xl font-bold mb-4';
    heading.textContent = `Search Results (${filtered.length})`;
    container.appendChild(heading);
  } else {
    const heading = document.createElement('h2');
    heading.className = 'text-2xl font-bold mb-4';
    heading.textContent = 'Popular Picks';
    container.appendChild(heading);
  }
  let displayProducts = filtered.filter(p => p.category !== 'Food' && p.status === 'Active');
  if (displayProducts.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'text-gray-500 text-center py-8';
    msg.textContent = 'No products found.';
    container.appendChild(msg);
    return container;
  }
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
  const shuffled = displayProducts.sort(() => 0.5 - Math.random()).slice(0, 8);
  shuffled.forEach(p => {
    const card = renderProductCard(p, addToCart);
    grid.appendChild(card);
  });
  container.appendChild(grid);
  return container;
}

function renderFooter() {
  const footer = document.createElement('footer');
  footer.className = 'bg-gray-900 text-white mt-12 py-8 px-4 text-center';
  footer.innerHTML = `
    <p>&copy; 2024 CaptaDelivery. All rights reserved.</p>
    <p class="text-gray-400 text-sm mt-2">Contact: musthaqmohammad10@gmail.com | +91 9019825189 / +91 8277079552</p>
  `;
  return footer;
}

function renderCategoryModal() {
  if (!state.showCategoryModal) return null;
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  const backdrop = document.createElement('div');
  backdrop.className = 'absolute inset-0 bg-black bg-opacity-50';
  backdrop.addEventListener('click', toggleCategoryModal);
  overlay.appendChild(backdrop);
  const modal = document.createElement('div');
  modal.className = 'relative bg-white rounded-2xl max-w-sm w-full max-h-[80vh] overflow-y-auto p-6';
  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-4';
  const title = document.createElement('h2');
  title.className = 'text-2xl font-bold';
  title.textContent = 'All Categories';
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'text-gray-500';
  closeBtn.innerHTML = '<i class="fas fa-times text-2xl"></i>';
  closeBtn.addEventListener('click', toggleCategoryModal);
  header.appendChild(closeBtn);
  modal.appendChild(header);
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 gap-3';
  categories.forEach(cat => {
    const iconData = categoryIcons[cat.name] || { icon: 'fa-tag', color: 'bg-gray-100', iconColor: 'text-gray-600' };
    const item = document.createElement('div');
    item.className = 'category-modal-item flex flex-col items-center gap-2 cursor-pointer p-4 rounded-xl bg-gray-50 hover:bg-primary/10 transition border border-transparent hover:border-primary';
    item.addEventListener('click', () => onCategoryClick(cat.name));
    item.innerHTML = `
      <div class="${iconData.color} w-16 h-16 rounded-full flex items-center justify-center shadow-md">
        <i class="fas ${iconData.icon} text-2xl ${iconData.iconColor}"></i>
      </div>
      <span class="text-sm font-semibold text-gray-700">${cat.name}</span>
    `;
    grid.appendChild(item);
  });
  modal.appendChild(grid);
  overlay.appendChild(modal);
  return overlay;
}

function renderCartSidebar() {
  if (!state.showCart) return null;
  const grouped = {};
  cart.forEach(item => {
    const cat = item.category || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  let subtotal = 0;
  const categoryTotals = {};
  Object.keys(grouped).forEach(cat => {
    const total = grouped[cat].reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    categoryTotals[cat] = total;
    subtotal += total;
  });
  const delivery = subtotal > 199 ? 0 : 40;
  const rain = settings.rain_fare || 0;
  const grandTotal = subtotal + delivery + rain;
  const container = document.createElement('div');
  container.className = 'fixed inset-0 z-50';
  const backdrop = document.createElement('div');
  backdrop.className = 'absolute inset-0 bg-black bg-opacity-50';
  backdrop.addEventListener('click', toggleCart);
  container.appendChild(backdrop);
  const sidebar = document.createElement('div');
  sidebar.className = 'absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto';
  const header = document.createElement('div');
  header.className = 'sticky top-0 bg-white p-4 border-b flex justify-between';
  const headerTitle = document.createElement('h2');
  headerTitle.className = 'text-2xl font-bold';
  headerTitle.textContent = `My Cart (${cart.length})`;
  header.appendChild(headerTitle);
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '<i class="fas fa-times text-2xl"></i>';
  closeBtn.addEventListener('click', toggleCart);
  header.appendChild(closeBtn);
  sidebar.appendChild(header);
  if (cart.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-center py-12';
    empty.innerHTML = `
      <i class="fas fa-shopping-cart text-6xl text-gray-300"></i>
      <p class="mt-2">Your cart is empty!</p>
      <button class="gradient-btn text-white px-6 py-2 rounded-full mt-4">Shop Now</button>
    `;
    empty.querySelector('button').addEventListener('click', toggleCart);
    sidebar.appendChild(empty);
  } else {
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'p-4 space-y-4';
    Object.keys(grouped).forEach(cat => {
      const catHeader = document.createElement('div');
      catHeader.className = 'font-bold text-primary text-sm uppercase tracking-wider mt-2 mb-1';
      catHeader.textContent = cat;
      itemsContainer.appendChild(catHeader);
      grouped[cat].forEach(item => {
        const row = document.createElement('div');
        row.className = 'flex gap-3 bg-gray-50 p-3 rounded-xl mb-2';
        const img = document.createElement('img');
        img.src = item.images && item.images.length > 0 ? item.images[0] : 'https://placehold.co/400x400';
        img.className = 'w-16 h-16 rounded-lg object-cover';
        row.appendChild(img);
        const info = document.createElement('div');
        info.className = 'flex-1';
        const name = document.createElement('h4');
        name.className = 'font-semibold text-sm';
        name.textContent = item.displayName || item.name;
        info.appendChild(name);
        const price = document.createElement('p');
        price.className = 'text-primary font-bold';
        price.textContent = `₹${item.price}`;
        info.appendChild(price);
        const controls = document.createElement('div');
        controls.className = 'flex items-center gap-2 mt-1';
        const minus = document.createElement('button');
        minus.className = 'w-7 h-7 rounded-full bg-white border';
        minus.textContent = '-';
        minus.addEventListener('click', () => updateQuantity(item.id, item.quantity - 1, item.variantLabel));
        controls.appendChild(minus);
        const qtySpan = document.createElement('span');
        qtySpan.textContent = item.quantity;
        controls.appendChild(qtySpan);
        const plus = document.createElement('button');
        plus.className = 'w-7 h-7 rounded-full bg-white border';
        plus.textContent = '+';
        plus.addEventListener('click', () => updateQuantity(item.id, item.quantity + 1, item.variantLabel));
        controls.appendChild(plus);
        const trash = document.createElement('button');
        trash.className = 'ml-auto text-red-500';
        trash.innerHTML = '<i class="fas fa-trash"></i>';
        trash.addEventListener('click', () => removeItem(item.id, item.variantLabel));
        controls.appendChild(trash);
        info.appendChild(controls);
        row.appendChild(info);
        itemsContainer.appendChild(row);
      });
      const catSubtotal = document.createElement('div');
      catSubtotal.className = 'text-right text-sm font-semibold text-gray-700 mb-3';
      catSubtotal.innerHTML = `<span class="text-gray-500">Subtotal:</span> ₹${categoryTotals[cat]}`;
      itemsContainer.appendChild(catSubtotal);
    });
    sidebar.appendChild(itemsContainer);
    const summary = document.createElement('div');
    summary.className = 'border-t p-4 bg-gray-50';
    const deliveryRow = document.createElement('div');
    deliveryRow.className = 'flex justify-between text-sm py-1';
    deliveryRow.innerHTML = `<span>Delivery</span><span>${delivery === 0 ? 'Free' : `₹${delivery}`}</span>`;
    summary.appendChild(deliveryRow);
    const rainRow = document.createElement('div');
    rainRow.className = 'flex justify-between text-sm py-1';
    rainRow.innerHTML = `<span>Rain Fare</span><span>₹${rain}</span>`;
    summary.appendChild(rainRow);
    const totalRow = document.createElement('div');
    totalRow.className = 'flex justify-between font-bold text-lg pt-2 border-t border-gray-300';
    totalRow.innerHTML = `<span>Grand Total</span><span>₹${grandTotal}</span>`;
    summary.appendChild(totalRow);
    const checkoutBtn = document.createElement('button');
    checkoutBtn.className = 'gradient-btn w-full text-white py-3 rounded-full mt-4';
    checkoutBtn.textContent = 'Proceed to Checkout →';
    checkoutBtn.addEventListener('click', () => {
      toggleCart();
      proceedToCheckout();
    });
    summary.appendChild(checkoutBtn);
    sidebar.appendChild(summary);
  }
  container.appendChild(sidebar);
  return container;
}

function renderOrdersModal() {
  if (!state.showOrders) return null;
  const container = document.createElement('div');
  container.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  const backdrop = document.createElement('div');
  backdrop.className = 'absolute inset-0 bg-black bg-opacity-50';
  backdrop.addEventListener('click', toggleOrders);
  container.appendChild(backdrop);
  const modal = document.createElement('div');
  modal.className = 'relative bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6';
  const header = document.createElement('div');
  header.className = 'flex justify-between items-center mb-4';
  const title = document.createElement('h2');
  title.className = 'text-2xl font-bold';
  title.textContent = '📦 My Orders (Reorder)';
  header.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'text-gray-500';
  closeBtn.innerHTML = '<i class="fas fa-times text-2xl"></i>';
  closeBtn.addEventListener('click', toggleOrders);
  header.appendChild(closeBtn);
  modal.appendChild(header);
  if (orders.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-gray-500 text-center py-8';
    empty.textContent = 'No past orders. Place an order to see it here.';
    modal.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'space-y-4';
    orders.forEach((order, idx) => {
      const card = document.createElement('div');
      card.className = 'border rounded-xl p-4 bg-gray-50';
      const top = document.createElement('div');
      top.className = 'flex justify-between items-start';
      const left = document.createElement('div');
      left.innerHTML = `
        <p class="text-sm text-gray-500">Order #${order.order_id} • ${new Date(order.date).toLocaleString()}</p>
        ${order.delivery_address ? `<p class="text-xs text-gray-400">📍 ${order.delivery_address}</p>` : ''}
        <p class="font-semibold mt-1">Total: ₹${order.grand_total}</p>
      `;
      top.appendChild(left);
      const reorderBtn = document.createElement('button');
      reorderBtn.className = 'gradient-btn text-white px-4 py-1 rounded-full text-sm';
      reorderBtn.textContent = 'Order Again';
      reorderBtn.addEventListener('click', () => handleOrderAgain(order.items));
      top.appendChild(reorderBtn);
      card.appendChild(top);
      const itemsDiv = document.createElement('div');
      itemsDiv.className = 'mt-2';
      const label = document.createElement('p');
      label.className = 'text-sm font-medium';
      label.textContent = 'Items:';
      itemsDiv.appendChild(label);
      const ul = document.createElement('ul');
      ul.className = 'text-sm text-gray-600';
      const items = order.items || [];
      items.slice(0, 3).forEach(item => {
        const li = document.createElement('li');
        li.textContent = `• ${item.name} x${item.quantity}`;
        ul.appendChild(li);
      });
      if (items.length > 3) {
        const li = document.createElement('li');
        li.textContent = `• +${items.length - 3} more`;
        ul.appendChild(li);
      }
      itemsDiv.appendChild(ul);
      card.appendChild(itemsDiv);
      list.appendChild(card);
    });
    modal.appendChild(list);
  }
  container.appendChild(modal);
  return container;
}

function handleOrderAgain(orderItems) {
  orderItems.forEach(item => {
    const originalProduct = products.find(p => p.name === item.name);
    const cartItem = {
      ...item,
      id: originalProduct ? originalProduct.id : Date.now(),
      displayName: item.name,
      variantLabel: item.variantLabel || null,
      price: item.price,
      images: originalProduct ? originalProduct.images : ['https://placehold.co/400x400'],
      category: item.category || 'Uncategorized',
      commission: item.commission || 0,
      variants: originalProduct ? originalProduct.variants : []
    };
    const existing = cart.find(i => i.id === cartItem.id && i.variantLabel === cartItem.variantLabel);
    if (existing) existing.quantity += item.quantity;
    else cart.push(cartItem);
  });
  saveCart();
  updateBadges();
  state.showOrders = false;
  showToast('Items added to cart');
  renderContent();
}

function renderToast() {
  if (!state.toastMsg) return null;
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-28 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-2 rounded-full shadow-lg z-50 text-sm';
  toast.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${state.toastMsg}`;
  return toast;
}

// ============================================================
// MAIN RENDER
// ============================================================
function renderContent() {
  app.innerHTML = '';
  app.className = 'min-h-screen bg-gray-50';
  if (state.loading) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-center py-12';
    loadingDiv.textContent = 'Loading...';
    app.appendChild(loadingDiv);
    return;
  }

  // Add service unavailable banner if applicable
  if (settings.service_unavailable) {
    const banner = document.createElement('div');
    banner.className = 'bg-red-600 text-white text-center py-2 text-sm font-semibold';
    banner.textContent = '⚠️ Service is currently unavailable. Please check back later.';
    app.appendChild(banner);
  } else {
    // Show delivery hours banner
    const hoursBanner = document.createElement('div');
    hoursBanner.className = 'bg-blue-50 text-gray-700 text-center py-1 text-xs border-b border-blue-200';
    hoursBanner.textContent = `🕒 Delivery Hours: ${settings.delivery_hours}`;
    app.appendChild(hoursBanner);
  }

  // Check if today is an unavailable day
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  if (settings.unavailable_days && settings.unavailable_days.includes(today)) {
    const closedBanner = document.createElement('div');
    closedBanner.className = 'bg-orange-500 text-white text-center py-2 text-sm font-semibold';
    closedBanner.textContent = `📢 Closed on ${today}. Orders will be processed on the next working day.`;
    app.appendChild(closedBanner);
  }

  if (state.showPayment) {
    const paymentPage = renderPaymentPage();
    if (paymentPage) app.appendChild(paymentPage);
    return;
  }
  if (state.showOrderSummary) {
    const summary = renderOrderSummary();
    if (summary) app.appendChild(summary);
    return;
  }
  if (state.selectedCategory) {
    const page = renderCategoryPage();
    if (page) app.appendChild(page);
  } else {
    const hero = renderHero();
    if (hero) app.appendChild(hero);
    const trust = renderTrustBanner();
    if (trust) app.appendChild(trust);
    const cats = renderCategoriesSection();
    if (cats) app.appendChild(cats);
    const offersSection = renderOffersSection();
    if (offersSection) app.appendChild(offersSection);
    const productsGrid = renderProductsGrid();
    if (productsGrid) app.appendChild(productsGrid);
  }
  const cartSidebar = renderCartSidebar();
  if (cartSidebar) app.appendChild(cartSidebar);
  const ordersModal = renderOrdersModal();
  if (ordersModal) app.appendChild(ordersModal);
  const categoryModal = renderCategoryModal();
  if (categoryModal) app.appendChild(categoryModal);
  const accountDrawer = renderAccountDrawer();
  if (accountDrawer) app.appendChild(accountDrawer);
  const toast = renderToast();
  if (toast) app.appendChild(toast);
  const footer = renderFooter();
  if (footer) app.appendChild(footer);
  updateBadges();
}

// ============================================================
// SEARCH
// ============================================================
let searchTimeout = null;

function handleSearchInput(e) {
  const val = e.target.value;
  state.searchTerm = val;
  if (searchInput && searchInput !== e.target) searchInput.value = val;
  if (searchInputMobile && searchInputMobile !== e.target) searchInputMobile.value = val;
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    renderContent();
  }, 300);
}

// ============================================================
// ICON MAPPING
// ============================================================
const categoryIcons = {
  'Food': { icon: 'fa-utensils', color: 'bg-orange-100', iconColor: 'text-orange-600' },
  'Vegetables': { icon: 'fa-carrot', color: 'bg-green-100', iconColor: 'text-green-600' },
  'Meat': { icon: 'fa-drumstick-bite', color: 'bg-rose-100', iconColor: 'text-rose-600' },
  'Dairy': { icon: 'fa-cheese', color: 'bg-yellow-100', iconColor: 'text-yellow-600' },
  'Snacks': { icon: 'fa-cookie-bite', color: 'bg-amber-100', iconColor: 'text-amber-600' },
  'Drinks': { icon: 'fa-mug-hot', color: 'bg-blue-100', iconColor: 'text-blue-600' },
  'Fruits': { icon: 'fa-apple', color: 'bg-red-100', iconColor: 'text-red-600' },
  'Grocery': { icon: 'fa-shopping-basket', color: 'bg-purple-100', iconColor: 'text-purple-600' },
  'Cool Drinks': { icon: 'fa-cocktail', color: 'bg-cyan-100', iconColor: 'text-cyan-600' }
};

// ============================================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ============================================================
window.goHome = goHome;
window.toggleCategoryModal = toggleCategoryModal;
window.toggleOrders = toggleOrders;
window.toggleAccountDrawer = toggleAccountDrawer;
window.toggleCart = toggleCart;
window.openLogin = openLogin;
window.closeLogin = closeLogin;
window.switchTab = switchTab;
window.sendLoginOtp = sendLoginOtp;
window.verifyLoginOtp = verifyLoginOtp;
window.sendSignupOtp = sendSignupOtp;
window.verifySignupOtp = verifySignupOtp;
window.onCategoryClick = onCategoryClick;
window.proceedToCheckout = proceedToCheckout;
window.closeOrderSummary = closeOrderSummary;
window.proceedToPayment = proceedToPayment;
window.confirmPayment = confirmPayment;
window.closePayment = closePayment;
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeItem = removeItem;
window.toggleAccountDropdown = toggleAccountDropdown;
window.showContactSupport = showContactSupport;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
  if (navLogo) navLogo.addEventListener('click', goHome);
  if (navCart) navCart.addEventListener('click', toggleCart);
  if (navOrders) navOrders.addEventListener('click', toggleOrders);
  if (searchInput) searchInput.addEventListener('input', handleSearchInput);
  if (searchInputMobile) searchInputMobile.addEventListener('input', handleSearchInput);
  if (searchToggleBtn) {
    searchToggleBtn.addEventListener('click', function() {
      const mobileInput = searchInputMobile;
      if (mobileInput) {
        if (mobileInput.style.display === 'block' || mobileInput.classList.contains('block')) {
          mobileInput.style.display = 'none';
          mobileInput.classList.remove('block');
          mobileInput.classList.add('hidden');
        } else {
          mobileInput.style.display = 'block';
          mobileInput.classList.remove('hidden');
          mobileInput.classList.add('block');
          mobileInput.focus();
        }
      }
    });
  }
  const storedUser = localStorage.getItem('swingy_user');
  if (storedUser) {
    try { user = JSON.parse(storedUser); } catch (e) { user = null; }
  }
  await loadAllData();
  updateNavUser();
  renderContent();
});