// ========================================
// checkout.js – ULTIMATE FINAL VERSION
// Addon Qty Working | Gift Fixed | Razorpay Working | All Original Flow Intact
// ========================================

// console.log('%c checkout.js LOADED – FINAL BANGER VERSION', 'color: #ff1493; font-size: 20px; font-weight: bold;');

const API_BASE = 'http://localhost:8082';
let userSession = null;
let user = null;
let addresses = [];
let cartItems = [];
let selectedAddress = null;
let selectedCoupon = null;
let discount = 0;
let orderType = 'own';
let giftDetails = null;
let fp;

const RAZORPAY_KEY = 'rzp_live_RVdM6AniDvOBOH';

// ==================== SHOP LOCATION & PINCODE DATABASE ====================
const SHOP_COORDS = { lat: 18.5872, lng: 73.7534 };
const PINCODE_COORDS = {
    "411045": { lat: 18.5872, lng: 73.7534 },
    "411061": { lat: 18.5550, lng: 73.7900 },
    "411021": { lat: 18.5472, lng: 73.8988 },
    "411008": { lat: 18.5583, lng: 73.8077 },
    "411057": { lat: 18.6022, lng: 73.7644 },
    "411027": { lat: 18.5658, lng: 73.7789 },
    "411033": { lat: 18.6222, lng: 73.8527 },
    "411044": { lat: 18.5990, lng: 73.7550 },
    "411007": { lat: 18.5314, lng: 73.8905 },
    "411016": { lat: 18.5991, lng: 73.7953 },
    "411001": { lat: 18.5204, lng: 73.8567 },
    "411002": { lat: 18.5289, lng: 73.8744 },
    "411004": { lat: 18.5308, lng: 73.8477 },
    "411005": { lat: 18.5068, lng: 73.8332 },
    "411006": { lat: 18.5531, lng: 73.7939 },
    "411014": { lat: 18.5364, lng: 73.8307 },
    "411017": { lat: 18.6222, lng: 73.8194 }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function getDeliveryInfo(pincode) {
    if (!pincode || pincode.length !== 6 || isNaN(pincode)) return { charge: null, label: "Invalid PIN Code", distance: 0 };
    const coords = PINCODE_COORDS[pincode];
    if (!coords) return { charge: null, label: "Delivery not available", distance: 0 };
    const distance = calculateDistance(SHOP_COORDS.lat, SHOP_COORDS.lng, coords.lat, coords.lng);
    if (distance <= 3)  return { charge: 0,   label: `Free Delivery`, distance: Math.round(distance) };
    if (distance <= 5)  return { charge: 99,  label: `₹99`, distance: Math.round(distance) };
    if (distance <= 7)  return { charge: 199, label: `₹199`, distance: Math.round(distance) };
    return { charge: null, label: "Not deliverable (>7km)", distance: Math.round(distance) };
}

// ==================== MODAL CONTROL ====================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeModal(e.target.id);
    if (e.target.classList.contains('close')) {
        const modal = e.target.closest('.modal');
        if (modal) closeModal(modal.id);
    }
});

// ==================== LOGGING ====================
function log(message, data = '') {
    console.log(`%c[CHECKOUT] ${message}`, 'color: #0066cc; font-weight: bold;', data);
}

// ==================== LOAD RAZORPAY ====================
function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
        if (window.Razorpay) return resolve();
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

// ==================== VALIDATE USER ====================
function validateAndSetUser() {
    const raw = localStorage.getItem('userSession');
    if (!raw) return null;
    try { userSession = JSON.parse(raw); } catch (e) { return null; }
    if (!userSession.user || !userSession.expiry || Date.now() > userSession.expiry) {
        localStorage.removeItem('userSession');
        window.location.href = '/login.html';
        return null;
    }
    user = {
        userId: userSession.user.userId,
        name: userSession.user.customerName,
        email: userSession.user.email,
        phone: userSession.user.mobile
    };
    return user;
}

function updateAuthUI() {
    const addBtn = document.getElementById('addNewAddress');
    const placeBtn = document.getElementById('placeOrder');
    if (!user) {
        addBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Login / Sign Up';
        addBtn.onclick = () => window.location.href = '/login.html';
        placeBtn.disabled = true;
        placeBtn.innerHTML = 'Login to Place Order';
    } else {
        addBtn.innerHTML = '<i class="fas fa-plus mr-2"></i>Add New Address';
        addBtn.onclick = () => openModal('addressModal');
        placeBtn.disabled = false;
        placeBtn.innerHTML = '<i class="fas fa-shopping-cart mr-2"></i>PLACE ORDER';
    }
}

// ==================== DATE PICKER ====================
function initDatePicker() {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    fp = flatpickr("#flatpickrInput", {
        enableTime: true,
        dateFormat: "d M Y, h:i K",
        minDate: tomorrow,
        defaultHour: 10,
        defaultMinute: 0,
        time_24hr: false,
        onChange: (selectedDates, dateStr) => {
            document.getElementById("selectedDateDisplay").textContent = dateStr;
        }
    });

    const today = new Date();
    const todayStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
                     ', ' + today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    document.getElementById("selectedDateDisplay").textContent = todayStr;
}

document.getElementById("todayBtn")?.addEventListener("click", () => {
    document.getElementById("customDatePicker").classList.add("hidden");
    document.getElementById("dateTimeDisplay").classList.remove("hidden");
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
                     ', ' + today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    document.getElementById("selectedDateDisplay").textContent = todayStr;
});

document.getElementById("customDateBtn")?.addEventListener("click", () => {
    document.getElementById("customDatePicker").classList.remove("hidden");
    document.getElementById("dateTimeDisplay").classList.add("hidden");
    fp.open();
});

// ==================== PRESERVE ORDER + NORMALIZE ====================
function normalizeWithPreservedOrder(rawData) {
    if (!Array.isArray(rawData)) return [];

    return rawData.map(item => {
        const existingItem = cartItems.find(i => i.cartItemId === String(item.cartItemId));
        const preservedAddons = existingItem?.addons || [];

        const serverAddonsMap = (item.addons || []).reduce((acc, a) => {
            acc[String(a.id)] = a;
            return acc;
        }, {});

        const finalAddons = preservedAddons.length > 0
            ? preservedAddons.map(old => {
                const serverAddon = serverAddonsMap[old.id];
                if (serverAddon) {
                    return {
                        id: old.id,
                        name: serverAddon.name || old.name,
                        price: Number(serverAddon.price) || old.price,
                        quantity: Number(serverAddon.quantity) || old.quantity,
                        imageUrl: serverAddon.imageUrl?.startsWith("http") ? serverAddon.imageUrl : (serverAddon.imageUrl ? API_BASE + serverAddon.imageUrl : old.imageUrl)
                    };
                }
                return old;
            })
            : (item.addons || []).map(a => ({
                id: String(a.id),
                name: a.name || "Addon",
                price: Number(a.price) || 0,
                quantity: Number(a.quantity || 1),
                imageUrl: a.imageUrl?.startsWith("http") ? a.imageUrl : (a.imageUrl ? API_BASE + a.imageUrl : "/IMG/addon-placeholder.png")
            }));

        return {
            cartItemId: String(item.cartItemId),
            productId: item.productId || null,        // ← YEH ADD KIYA
            snackId: item.snackId || null,            // ← YE BHI ADD KIYA
            title: item.title || "Product",
            price: Number(item.price) || 0,
            imageUrl: item.imageUrl?.startsWith("http") ? item.imageUrl : (item.imageUrl ? API_BASE + item.imageUrl : "/IMG/placeholder.png"),
            quantity: Number(item.quantity) || 1,
            size: item.size || "Standard",
            addons: finalAddons.filter(a => a.quantity > 0)
        };
    });
}
// ==================== CART FUNCTIONS ====================
async function fetchCartItems() {
    if (!user) return;
    try {
        const res = await fetch(`${API_BASE}/api/cart/get-cart-items?userId=${user.userId}&t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const raw = await res.json();
        cartItems = normalizeWithPreservedOrder(raw);
        renderCartItems();
        updateSummary();
    } catch (err) {
        log('Cart fetch failed', err);
    }
}

async function syncItem(cartItemId) {
    const item = cartItems.find(i => i.cartItemId === cartItemId);
    if (!item) return;
    await fetch(`${API_BASE}/api/cart/update-cart-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId: user.userId,
            cartItemId: Number(cartItemId),
            quantity: item.quantity,
            addons: item.addons.map(a => ({ id: Number(a.id), quantity: a.quantity }))
        })
    });
    await fetchCartItems();
}

function renderCartItems() {
    const container = document.getElementById('cartItems');
    if (!container) return;
    container.innerHTML = cartItems.length === 0 ? '<p class="text-center text-gray-500 p-8">Cart is empty</p>' : '';

    cartItems.forEach((item, i) => {
        const img = item.imageUrl.startsWith('http') ? item.imageUrl : API_BASE + item.imageUrl;
        const addonTotal = item.addons.reduce((s, a) => s + a.price * a.quantity, 0);
        const itemTotal = item.price * item.quantity + addonTotal;

        let addonsHTML = '';
        if (item.addons.length > 0) {
            addonsHTML = `
                <div class="mt-3 pt-3 border-t border-gray-200">
                    <p class="font-medium text-sm mb-2">Add-ons:</p>
                    <div class="space-y-2">
                        ${item.addons.map((a, idx) => `
                            <div class="flex items-center justify-between bg-white p-3 rounded-lg border">
                                <div class="flex items-center gap-3">
                                    <img src="${a.imageUrl}" class="w-10 h-10 object-cover rounded" onerror="this.src='/IMG/addon-placeholder.png'">
                                    <div>
                                        <p class="text-sm font-medium">${a.name}</p>
                                        <p class="text-xs text-green-600">₹${a.price} × ${a.quantity}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button class="w-7 h-7 rounded-full bg-gray-200 text-sm addon-minus" data-item="${i}" data-addon="${idx}">-</button>
                                    <span class="w-8 text-center font-bold text-sm">${a.quantity}</span>
                                    <button class="w-7 h-7 rounded-full bg-red-600 text-white text-sm addon-plus" data-item="${i}" data-addon="${idx}">+</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const div = document.createElement('div');
        div.className = 'flex flex-col gap-4 p-4 bg-gray-50 rounded-xl mb-3';
        div.innerHTML = `
            <div class="flex gap-4">
                <img src="${img}" class="w-20 h-20 object-cover rounded-lg" onerror="this.src='/IMG/placeholder.png'">
                <div class="flex-1">
                    <h3 class="font-semibold">${item.title}</h3>
                    <p class="text-sm text-gray-600">${item.size}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold">₹${itemTotal.toLocaleString('en-IN')}</p>
                    <div class="flex items-center gap-2 mt-2">
                        <button class="w-8 h-8 rounded-full bg-gray-200 qty-minus" data-index="${i}">-</button>
                        <span class="w-10 text-center font-bold">${item.quantity}</span>
                        <button class="w-8 h-8 rounded-full bg-red-600 text-white qty-plus" data-index="${i}">+</button>
                    </div>
                </div>
            </div>
            ${addonsHTML}
        `;
        container.appendChild(div);
    });
}

document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('qty-plus')) {
        const i = e.target.dataset.index;
        cartItems[i].quantity++;
        renderCartItems();
        updateSummary();
        await syncItem(cartItems[i].cartItemId);
    }
    if (e.target.classList.contains('qty-minus')) {
        const i = e.target.dataset.index;
        if (cartItems[i].quantity > 1) cartItems[i].quantity--;
        else cartItems.splice(i, 1);
        renderCartItems();
        updateSummary();
        if (cartItems[i]) await syncItem(cartItems[i].cartItemId);
    }
    if (e.target.classList.contains('addon-plus')) {
        const itemIdx = e.target.dataset.item;
        const addonIdx = e.target.dataset.addon;
        cartItems[itemIdx].addons[addonIdx].quantity++;
        renderCartItems();
        updateSummary();
        await syncItem(cartItems[itemIdx].cartItemId);
    }
    if (e.target.classList.contains('addon-minus')) {
        const itemIdx = e.target.dataset.item;
        const addonIdx = e.target.dataset.addon;
        if (cartItems[itemIdx].addons[addonIdx].quantity > 1) cartItems[itemIdx].addons[addonIdx].quantity--;
        else cartItems[itemIdx].addons.splice(addonIdx, 1);
        renderCartItems();
        updateSummary();
        await syncItem(cartItems[itemIdx].cartItemId);
    }
});

// ==================== ADDRESS FUNCTIONS (FULLY ORIGINAL) ====================
async function fetchAddresses() {
    if (!user) return;
    try {
        const res = await fetch(`${API_BASE}/api/addresses/get-address-by-userId/${user.userId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        addresses = await res.json();
        renderAddresses();
    } catch (err) { log('Address fetch failed', err); }
}

function renderAddresses() {
    const container = document.getElementById('addressOptions');
    if (!container) return;
    container.innerHTML = addresses.length === 0 ? '<p class="text-center text-gray-500 p-4">No addresses. Add one!</p>' : '';

    addresses.forEach((addr, i) => {
        const full = `${addr.houseNo}, ${addr.streetArea}${addr.landmark ? ', ' + addr.landmark : ''}, ${addr.shippingCity}, ${addr.shippingState} ${addr.shippingPincode}`;
        const card = document.createElement('div');
        card.className = 'address-card p-4 bg-white rounded-lg border mb-3';
        card.innerHTML = `
            <label class="flex justify-between items-start cursor-pointer">
                <div class="flex items-start gap-3">
                    <input type="radio" name="address" value="${addr.shippingId}" class="mt-1" ${i === 0 ? 'checked' : ''}>
                    <div>
                        <div class="font-semibold">${addr.addressType}</div>
                        <div class="text-sm text-gray-600">${full}</div>
                    </div>
                </div>
                <button type="button" class="edit-address text-xs text-blue-600" data-index="${i}">Edit</button>
            </label>
        `;
        container.appendChild(card);
    });

    const checkedRadio = document.querySelector('input[name="address"]:checked');
    selectedAddress = checkedRadio ? addresses.find(a => a.shippingId == checkedRadio.value) : addresses[0] || null;

    document.querySelectorAll('input[name="address"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedAddress = addresses.find(a => a.shippingId == e.target.value);
            updateSummary();
        });
    });

    document.querySelectorAll('.edit-address').forEach(btn => {
        btn.onclick = () => {
            const i = parseInt(btn.dataset.index);
            const addr = addresses[i];
            openModal('addressModal');
            document.getElementById('houseNumber').value = addr.houseNo;
            document.getElementById('areaStreet').value = addr.streetArea;
            document.getElementById('landmark').value = addr.landmark || '';
            document.getElementById('city').value = addr.shippingCity;
            document.getElementById('pinCode').value = addr.shippingPincode;
            document.getElementById('state').value = addr.shippingState;
            document.getElementById('addressType').value = addr.addressType;
            localStorage.setItem('editingAddressIndex', i);
        };
    });

    updateSummary();
}

async function saveAddress() {
    const form = {
        houseNo: document.getElementById('houseNumber')?.value.trim(),
        streetArea: document.getElementById('areaStreet')?.value.trim(),
        landmark: document.getElementById('landmark')?.value.trim(),
        city: document.getElementById('city')?.value.trim(),
        pinCode: document.getElementById('pinCode')?.value.trim(),
        state: document.getElementById('state')?.value,
        country: document.getElementById('country')?.value,
        addressType: document.getElementById('addressType')?.value
    };

    if (!form.houseNo || !form.streetArea || !form.city || !form.pinCode || form.pinCode.length !== 6) {
        alert('Fill all fields. PIN must be 6 digits.');
        return;
    }

    const payload = {
        customerPhone: user.phone,
        customerEmail: user.email,
        shippingAddress: `${form.houseNo}, ${form.streetArea}`,
        shippingCity: form.city,
        shippingState: form.state,
        shippingPincode: form.pinCode,
        shippingCountry: form.country,
        addressType: form.addressType,
        houseNo: form.houseNo,
        streetArea: form.streetArea,
        landmark: form.landmark
    };

    const editingIndex = localStorage.getItem('editingAddressIndex');
    let url = `${API_BASE}/api/addresses/create-address/${user.userId}`;
    let method = 'POST';

    if (editingIndex !== null) {
        const index = parseInt(editingIndex);
        if (!isNaN(index) && addresses[index]) {
            url = `${API_BASE}/api/addresses/patch-address/${user.userId}/${addresses[index].shippingId}`;
            method = 'PATCH';
        }
    }

    try {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) {
            localStorage.removeItem('editingAddressIndex');
            closeModal('addressModal');
            fetchAddresses();
        } else {
            const err = await res.text();
            alert('Save failed: ' + err);
        }
    } catch (err) {
        alert('Network error');
    }
}

// ==================== GIFT ORDER – FULLY WORKING ====================
function renderGiftDetails() {
    const existing = document.getElementById('giftSummaryCard');
    if (existing) existing.remove();
    if (!giftDetails) return;

    const container = document.getElementById('addressOptions');
    const card = document.createElement('div');
    card.id = 'giftSummaryCard';
    card.className = 'p-5 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border-2 border-pink-200 mt-4 shadow-sm';
    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                    <i class="fas fa-gift text-pink-600 text-xl"></i>
                    <p class="font-bold text-pink-800">This is a Gift Order</p>
                </div>
                <div class="text-sm space-y-1 ml-7">
                    <p><span class="font-medium">To:</span> ${giftDetails.name}</p>
                    <p><span class="font-medium">Phone:</span> ${giftDetails.phone}</p>
                    ${giftDetails.message ? `<p class="italic text-purple-700 mt-2">"${giftDetails.message}"</p>` : ''}
                </div>
            </div>
            <button id="editGiftBtn" class="text-pink-600 hover:text-pink-800 text-sm font-medium">
                <i class="fas fa-edit mr-1"></i>Edit
            </button>
        </div>
    `;
    container.appendChild(card);
    document.getElementById('editGiftBtn')?.addEventListener('click', () => {
        openModal('giftModal');
        document.getElementById('recipientName').value = giftDetails.name;
        document.getElementById('recipientPhone').value = giftDetails.phone;
        document.getElementById('giftMessage').value = giftDetails.message || '';
    });
}

document.getElementById('giftOrder')?.addEventListener('click', () => {
    if (!user) return alert('Login first');
    orderType = 'gift';
    openModal('giftModal');
    document.getElementById('giftOrder').classList.remove('btn-secondary'); document.getElementById('giftOrder').classList.add('btn-selected');
    document.getElementById('ownOrder').classList.remove('btn-selected'); document.getElementById('ownOrder').classList.add('btn-secondary');
});

document.getElementById('ownOrder')?.addEventListener('click', () => {
    orderType = 'own';
    giftDetails = null;
    document.getElementById('giftSummaryCard')?.remove();
    document.getElementById('ownOrder').classList.remove('btn-secondary'); document.getElementById('ownOrder').classList.add('btn-selected');
    document.getElementById('giftOrder').classList.remove('btn-selected'); document.getElementById('giftOrder').classList.add('btn-secondary');
});

document.getElementById('saveGiftDetails')?.addEventListener('click', () => {
    const name = document.getElementById('recipientName')?.value.trim();
    const phone = document.getElementById('recipientPhone')?.value.trim();
    const message = document.getElementById('giftMessage')?.value.trim();
    if (!name || !phone || phone.length !== 10) return alert('Please fill Recipient Name & valid 10-digit Phone');
    giftDetails = { name, phone, message };
    closeModal('giftModal');
    renderGiftDetails();
});

// ==================== SUMMARY ====================
function updateSummary() {
    const subTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity) + item.addons.reduce((s, a) => s + a.price * a.quantity, 0), 0);
    const tax = Math.round(subTotal * 0.05);
    let deliveryCharge = 0;
    let deliveryLabel = subTotal > 500 ? "FREE" : "₹40";

    if (selectedAddress?.shippingPincode) {
        const info = getDeliveryInfo(selectedAddress.shippingPincode);
        deliveryCharge = info.charge !== null ? info.charge : 0;
        deliveryLabel = info.charge === null ? `<span style="color:#c00; font-weight:600">${info.label}</span>` : info.label;
    }

    const total = subTotal + deliveryCharge + tax - discount;

    const el = document.getElementById('orderSummary');
    if (!el) return;

    el.innerHTML = `
        <div class="flex justify-between py-1"><span>Subtotal</span><span>₹${subTotal.toLocaleString('en-IN')}</span></div>
        <div class="flex justify-between py-1"><span>Delivery Charge</span><span>${deliveryLabel}</span></div>
        <div class="flex justify-between py-1"><span>Tax (5%)</span><span>₹${tax}</span></div>
        ${discount > 0 ? `<div class="flex justify-between py-1 text-green-600"><span>Discount</span><span>-₹${discount}</span></div>` : ''}
        <div class="border-t my-2"></div>
        <div class="flex justify-between text-lg font-bold"><span>Total</span><span style="color:var(--primary)">₹${total.toLocaleString('en-IN')}</span></div>
    `;

    const placeBtn = document.getElementById('placeOrder');
    if (placeBtn) {
        const info = selectedAddress ? getDeliveryInfo(selectedAddress.shippingPincode) : { charge: null };
        placeBtn.disabled = !selectedAddress || info.charge === null || cartItems.length === 0;
    }
}

// ==================== PAYMENT & ORDER (FULLY ORIGINAL) ====================
async function clearCart() {
    try {
        await fetch(`${API_BASE}/api/cart/clear-cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId })
        });
    } catch (err) { log('Clear cart failed', err); }
}

function showLoader() {
    let loader = document.getElementById('checkoutLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'checkoutLoader';
        loader.innerHTML = `<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div class="bg-white p-6 rounded-lg shadow-xl">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                <p class="mt-4 text-center">Processing...</p>
            </div>
        </div>`;
        document.body.appendChild(loader);
    }
    loader.style.display = 'block';
}

function hideLoader() {
    const loader = document.getElementById('checkoutLoader');
    if (loader) loader.style.display = 'none';
}

function blastConfetti() {
    if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
}

async function initiateRazorpay(amountInRupees) {
    const amountInPaise = Math.round(amountInRupees * 100);
    const payload = {
        userId: user.userId,
        amount: amountInPaise,
        currency: "INR",
        receipt: `order_${Date.now()}`,
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone
    };

    try {
        const res = await fetch(`${API_BASE}/api/payments/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const order = await res.json();

        const options = {
            key: RAZORPAY_KEY,
            amount: order.amount,
            currency: order.currency,
            name: "THB Bakery",
            description: "Order Payment",
            order_id: order.id,
            handler: async (response) => {
                hideLoader();
                await createOrderOnBackend(response.razorpay_order_id);
            },
            prefill: { name: user.name, email: user.email, contact: user.phone },
            theme: { color: '#660B05' }
        };

        const rzp = new Razorpay(options);
        rzp.open();
    } catch (err) {
        hideLoader();
        alert('Payment failed');
    }
}

async function createOrderOnBackend(razorpayOrderId = null) {
    if (!selectedAddress) return alert('Select address');

    const display = document.getElementById('selectedDateDisplay')?.textContent || '';
    const now = new Date();
    const localDateTime = now.toISOString().slice(0, 19).replace('T', ' ');

    const payload = {
        userId: user.userId,
        shippingAddress: `${selectedAddress.houseNo}, ${selectedAddress.streetArea}`,
        shippingCity: selectedAddress.shippingCity,
        shippingState: selectedAddress.shippingState,
        shippingPincode: selectedAddress.shippingPincode,
        shippingCountry: selectedAddress.shippingCountry || 'India',
        shippingCustomerName: user.name,
        shippingEmail: user.email,
        shippingPhone: user.phone,
        customerName: user.name,
        customerPhone: user.phone,
        customerEmail: user.email,
        paymentMethod: document.getElementById('paymentMethod')?.value || 'cod',
        couponAppliedCode: selectedCoupon?.code || null,
        discountPercent: selectedCoupon?.type === 'percentage' ? selectedCoupon.value : 0,
        discountAmount: discount,
        addressType: selectedAddress.addressType,
        houseNo: selectedAddress.houseNo,
        streetArea: selectedAddress.streetArea,
        landmark: selectedAddress.landmark || '',
        orderDateTime: localDateTime,
        deliveryDateTime: display,
        orderType: orderType === 'gift' ? 'gift' : 'own',
        items: cartItems.map(item => ({
            productId: item.productId || null, 
            snackId: item.snackId || null,
            quantity: item.quantity,
            selectedWeight: item.size,
            cakeMessage: '',
            specialInstructions: '',
            partyItems: (item.addons || []).map(a => ({
                partItemName: a.name,
                partyItemQuantity: a.quantity || 1,
                partyItemPrice: a.price
            }))
        }))
    };

    if (orderType === 'gift' && giftDetails) {
        payload.recipientName = giftDetails.name;
        payload.recipientMobile = giftDetails.phone;
        payload.giftMessage = giftDetails.message;
    }

    if (razorpayOrderId) payload.razorpayOrderId = razorpayOrderId;

    try {
        const res = await fetch(`${API_BASE}/api/orders/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const order = await res.json();
            await clearCart();
            hideLoader();
            blastConfetti();
            setTimeout(() => {
                alert(`Order #${order.orderId} placed successfully!`);
                window.location.reload();
            }, 500);
        } else {
            const err = await res.text();
            hideLoader();
            alert('Order failed: ' + err);
        }
    } catch (err) {
        hideLoader();
        alert('Network error');
    }
}

document.getElementById('placeOrder')?.addEventListener('click', async () => {
    if (!user || !selectedAddress || cartItems.length === 0) return alert('Complete all fields');
    showLoader();

    const subTotal = cartItems.reduce((s, i) => s + (i.price * i.quantity) + i.addons.reduce((t, a) => t + a.price * a.quantity, 0), 0);
    const total = subTotal + (subTotal > 500 ? 0 : 40) + Math.round(subTotal * 0.05) - discount;

    if (document.getElementById('paymentMethod')?.value === 'online') {
        await loadRazorpayScript();
        hideLoader();
        await initiateRazorpay(total);
    } else {
        await createOrderOnBackend();
    }
});

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    validateAndSetUser();
    updateAuthUI();
    localStorage.removeItem('editingAddressIndex');

    if (user) {
        fetchAddresses();
        fetchCartItems();
        initDatePicker();
    }

    document.getElementById('saveAddress')?.addEventListener('click', saveAddress);
});












// // ========================================
// // checkout.js – FINAL VERSION (Gift Message Fixed + Distance Delivery Perfect)
// // ========================================

// console.log('%c checkout.js LOADED – FULLY WORKING with Gift Card Display', 'color: #ff1493; font-size: 18px; font-weight: bold;');

// const API_BASE = 'http://localhost:8082';
// let userSession = null;
// let user = null;
// let addresses = [];
// let cartItems = [];
// let selectedAddress = null;
// let selectedCoupon = null;
// let discount = 0;
// let orderType = 'own';
// let giftDetails = null;
// let fp;

// const RAZORPAY_KEY = 'rzp_live_RVdM6AniDvOBOH';

// // ==================== SHOP LOCATION & PINCODE DATABASE ====================
// const SHOP_COORDS = { lat: 18.5872, lng: 73.7534 }; // Mahalunge 411045

// const PINCODE_COORDS = {
//     "411045": { lat: 18.5872, lng: 73.7534 },
//     "411061": { lat: 18.5550, lng: 73.7900 },
//     "411021": { lat: 18.5472, lng: 73.8988 },
//     "411008": { lat: 18.5583, lng: 73.8077 },
//     "411057": { lat: 18.6022, lng: 73.7644 },
//     "411027": { lat: 18.5658, lng: 73.7789 },
//     "411033": { lat: 18.6222, lng: 73.8527 },
//     "411044": { lat: 18.5990, lng: 73.7550 },
//     "411007": { lat: 18.5314, lng: 73.8905 },
//     "411016": { lat: 18.5991, lng: 73.7953 },
//     "411001": { lat: 18.5204, lng: 73.8567 },
//     "411002": { lat: 18.5289, lng: 73.8744 },
//     "411004": { lat: 18.5308, lng: 73.8477 },
//     "411005": { lat: 18.5068, lng: 73.8332 },
//     "411006": { lat: 18.5531, lng: 73.7939 },
//     "411014": { lat: 18.5364, lng: 73.8307 },
//     "411017": { lat: 18.6222, lng: 73.8194 }
//     // Add more anytime
// };

// function calculateDistance(lat1, lon1, lat2, lon2) {
//     const R = 6371;
//     const dLat = (lat2 - lat1) * Math.PI / 180;
//     const dLon = (lon2 - lon1) * Math.PI / 180;
//     const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
//     const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//     return R * c;
// }

// function getDeliveryInfo(pincode) {
//     if (!pincode || pincode.length !== 6 || isNaN(pincode)) {
//         return { charge: null, label: "Invalid PIN Code", distance: 0 };
//     }
//     const coords = PINCODE_COORDS[pincode];
//     if (!coords) {
//         return { charge: null, label: "Delivery not available", distance: 0 };
//     }
//     const distance = calculateDistance(SHOP_COORDS.lat, SHOP_COORDS.lng, coords.lat, coords.lng);
//     if (distance <= 3)  return { charge: 0,   label: `Free Delivery)`, distance: Math.round(distance) };
//     if (distance <= 5)  return { charge: 99,  label: `₹99 `, distance: Math.round(distance) };
//     if (distance <= 7)  return { charge: 199, label: `₹199 `, distance: Math.round(distance) };
//     return { charge: null, label: "Not deliverable (>7km)", distance: Math.round(distance) };
// }

// // ==================== MODAL CONTROL ====================
// function openModal(modalId) {
//     const modal = document.getElementById(modalId);
//     if (modal) {
//         modal.classList.add('active');
//         document.body.style.overflow = 'hidden';
//     }
// }

// function closeModal(modalId) {
//     const modal = document.getElementById(modalId);
//     if (modal) {
//         modal.classList.remove('active');
//         document.body.style.overflow = 'auto';
//     }
// }

// document.addEventListener('click', (e) => {
//     const target = e.target;
//     if (target.classList.contains('modal')) closeModal(target.id);
//     if (target.classList.contains('close')) {
//         const modal = target.closest('.modal');
//         if (modal) closeModal(modal.id);
//     }
//     if (target.id === 'cancelAddress') closeModal('addressModal');
//     if (target.id === 'cancelGift') closeModal('giftModal');
// });

// // ==================== LOGGING ====================
// function log(message, data = '') {
//     console.log(`%c[CHECKOUT] ${message}`, 'color: #0066cc; font-weight: bold;', data);
// }

// // ==================== LOAD RAZORPAY ====================
// function loadRazorpayScript() {
//     return new Promise((resolve, reject) => {
//         if (window.Razorpay) return resolve();
//         const script = document.createElement('script');
//         script.src = 'https://checkout.razorpay.com/v1/checkout.js';
//         script.onload = resolve;
//         script.onerror = reject;
//         document.body.appendChild(script);
//     });
// }

// // ==================== VALIDATE USER ====================
// function validateAndSetUser() {
//     log('Validating user session...');
//     const raw = localStorage.getItem('userSession');
//     if (!raw) return null;

//     try {
//         userSession = JSON.parse(raw);
//     } catch (e) {
//         log('Parse error', e);
//         return null;
//     }

//     if (!userSession.user || !userSession.expiry || Date.now() > userSession.expiry) {
//         localStorage.removeItem('userSession');
//         window.location.href = '/login.html';
//         return null;
//     }

//     user = {
//         userId: userSession.user.userId,
//         name: userSession.user.customerName,
//         email: userSession.user.email,
//         phone: userSession.user.mobile
//     };

//     log('USER VALIDATED', user);
//     return user;
// }

// // ==================== UPDATE AUTH UI ====================
// function updateAuthUI() {
//     const addBtn = document.getElementById('addNewAddress');
//     const placeBtn = document.getElementById('placeOrder');

//     if (!user) {
//         addBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Login / Sign Up';
//         addBtn.onclick = () => window.location.href = '/login.html';
//         placeBtn.disabled = true;
//         placeBtn.innerHTML = 'Login to Place Order';
//     } else {
//         addBtn.innerHTML = '<i class="fas fa-plus mr-2"></i>Add New Address';
//         addBtn.onclick = () => openModal('addressModal');
//         placeBtn.disabled = false;
//         placeBtn.innerHTML = '<i class="fas fa-shopping-cart mr-2"></i>PLACE ORDER';
//     }
// }

// // ==================== DATE PICKER ====================
// function initDatePicker() {
//     const tomorrow = new Date();
//     tomorrow.setDate(tomorrow.getDate() + 1);

//     fp = flatpickr("#flatpickrInput", {
//         enableTime: true,
//         dateFormat: "d M Y, h:i K",
//         minDate: tomorrow,
//         defaultHour: 10,
//         defaultMinute: 0,
//         time_24hr: false,
//         onChange: function(selectedDates, dateStr) {
//             document.getElementById("selectedDateDisplay").textContent = dateStr;
//         }
//     });

//     const today = new Date();
//     const todayStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
//                      ', ' + today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
//     document.getElementById("selectedDateDisplay").textContent = todayStr;
// }

// document.getElementById("todayBtn")?.addEventListener("click", () => {
//     document.getElementById("customDatePicker").classList.add("hidden");
//     document.getElementById("dateTimeDisplay").classList.remove("hidden");
//     const today = new Date();
//     const todayStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
//                      ', ' + today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
//     document.getElementById("selectedDateDisplay").textContent = todayStr;
// });

// document.getElementById("customDateBtn")?.addEventListener("click", () => {
//     document.getElementById("customDatePicker").classList.remove("hidden");
//     document.getElementById("dateTimeDisplay").classList.add("hidden");
//     fp.open();
// });

// // ==================== FETCH ADDRESSES ====================
// async function fetchAddresses() {
//     if (!user) return;
//     log('Fetching addresses...');
//     try {
//         const res = await fetch(`${API_BASE}/api/addresses/get-address-by-userId/${user.userId}`);
//         if (!res.ok) throw new Error(`HTTP ${res.status}`);
//         addresses = await res.json();
//         log('Addresses loaded', addresses);
//         renderAddresses();
//     } catch (err) {
//         log('Address fetch failed', err);
//     }
// }

// // ==================== RENDER ADDRESSES ====================
// function renderAddresses() {
//     const container = document.getElementById('addressOptions');
//     if (!container) return;

//     container.innerHTML = addresses.length === 0
//         ? '<p class="text-center text-gray-500 p-4">No addresses. Add one!</p>'
//         : '';

//     addresses.forEach((addr, i) => {
//         const full = `${addr.houseNo}, ${addr.streetArea}${addr.landmark ? ', ' + addr.landmark : ''}, ${addr.shippingCity}, ${addr.shippingState} ${addr.shippingPincode}`;
//         const card = document.createElement('div');
//         card.className = 'address-card p-4 bg-white rounded-lg border mb-3';
//         card.innerHTML = `
//             <label class="flex justify-between items-start cursor-pointer">
//                 <div class="flex items-start gap-3">
//                     <input type="radio" name="address" value="${addr.shippingId}" class="mt-1" ${i === 0 ? 'checked' : ''}>
//                     <div>
//                         <div class="font-semibold">${addr.addressType}</div>
//                         <div class="text-sm text-gray-600">${full}</div>
//                     </div>
//                 </div>
//                 <button type="button" class="edit-address text-xs text-blue-600" data-index="${i}">Edit</button>
//             </label>
//         `;
//         container.appendChild(card);
//     });

//     const checkedRadio = document.querySelector('input[name="address"]:checked');
//     selectedAddress = checkedRadio ? addresses.find(a => a.shippingId == checkedRadio.value) : addresses[0] || null;

//     document.querySelectorAll('input[name="address"]').forEach(radio => {
//         radio.addEventListener('change', (e) => {
//             selectedAddress = addresses.find(a => a.shippingId == e.target.value);
//             updateSummary();
//         });
//     });

//     document.querySelectorAll('.edit-address').forEach(btn => {
//         btn.onclick = () => {
//             const i = parseInt(btn.dataset.index);
//             const addr = addresses[i];
//             openModal('addressModal');
//             document.getElementById('houseNumber').value = addr.houseNo;
//             document.getElementById('areaStreet').value = addr.streetArea;
//             document.getElementById('landmark').value = addr.landmark || '';
//             document.getElementById('city').value = addr.shippingCity;
//             document.getElementById('pinCode').value = addr.shippingPincode;
//             document.getElementById('state').value = addr.shippingState;
//             document.getElementById('addressType').value = addr.addressType;
//             localStorage.setItem('editingAddressIndex', i);
//         };
//     });

//     updateSummary();
// }

// // ==================== SAVE ADDRESS ====================
// async function saveAddress() {
//     const form = {
//         houseNo: document.getElementById('houseNumber')?.value.trim(),
//         streetArea: document.getElementById('areaStreet')?.value.trim(),
//         landmark: document.getElementById('landmark')?.value.trim(),
//         city: document.getElementById('city')?.value.trim(),
//         pinCode: document.getElementById('pinCode')?.value.trim(),
//         state: document.getElementById('state')?.value,
//         country: document.getElementById('country')?.value,
//         addressType: document.getElementById('addressType')?.value
//     };

//     if (!form.houseNo || !form.streetArea || !form.city || !form.pinCode || form.pinCode.length !== 6) {
//         alert('Fill all fields. PIN must be 6 digits.');
//         return;
//     }

//     const payload = {
//         customerPhone: user.phone,
//         customerEmail: user.email,
//         shippingAddress: `${form.houseNo}, ${form.streetArea}`,
//         shippingCity: form.city,
//         shippingState: form.state,
//         shippingPincode: form.pinCode,
//         shippingCountry: form.country,
//         addressType: form.addressType,
//         houseNo: form.houseNo,
//         streetArea: form.streetArea,
//         landmark: form.landmark
//     };

//     const editingIndex = localStorage.getItem('editingAddressIndex');
//     let url = `${API_BASE}/api/addresses/create-address/${user.userId}`;
//     let method = 'POST';

//     if (editingIndex !== null) {
//         const index = parseInt(editingIndex);
//         if (!isNaN(index) && addresses[index]) {
//             url = `${API_BASE}/api/addresses/patch-address/${user.userId}/${addresses[index].shippingId}`;
//             method = 'PATCH';
//         }
//     }

//     try {
//         const res = await fetch(url, {
//             method,
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });

//         if (res.ok) {
//             localStorage.removeItem('editingAddressIndex');
//             closeModal('addressModal');
//             fetchAddresses();
//         } else {
//             const err = await res.text();
//             alert('Save failed: ' + err);
//         }
//     } catch (err) {
//         alert('Network error');
//     }
// }

// // ==================== CART FUNCTIONS ====================
// async function fetchCartItems() {
//     if (!user) return;
//     try {
//         const res = await fetch(`${API_BASE}/api/cart/get-cart-items?userId=${user.userId}`);
//         if (!res.ok) throw new Error();
//         cartItems = await res.json();
//         renderCartItems();
//         updateSummary();
//     } catch (err) {
//         log('Cart fetch failed', err);
//     }
// }

// function renderCartItems() {
//     const container = document.getElementById('cartItems');
//     if (!container) return;
//     container.innerHTML = cartItems.length === 0 ? '<p class="text-center text-gray-500 p-8">Cart is empty</p>' : '';

//     cartItems.forEach((item, i) => {
//         const img = item.imageUrl.startsWith('http') ? item.imageUrl : `${API_BASE}${item.imageUrl}`;
//         const addonTotal = (item.addons || []).reduce((s, a) => s + a.price, 0);
//         const itemTotal = item.price * item.quantity + addonTotal;

//         const div = document.createElement('div');
//         div.className = 'flex flex-col gap-4 p-4 bg-gray-50 rounded-xl mb-3';

//         let addonsHTML = '';
//         if (item.addons && item.addons.length > 0) {
//             addonsHTML = `
//                 <div class="mt-3 pt-3 border-t border-gray-200">
//                     <p class="font-medium text-sm mb-2">Add-ons:</p>
//                     <div class="flex flex-wrap gap-3">
//                         ${item.addons.map(a => `
//                             <div class="flex items-center gap-2 bg-white p-2 rounded-lg border">
//                                 <img src="${a.imageUrl}" class="w-10 h-10 object-cover rounded" onerror="this.src='https://via.placeholder.com/40'">
//                                 <div>
//                                     <p class="text-xs font-medium">${a.name}</p>
//                                     <p class="text-xs text-green-600">+₹${a.price}</p>
//                                 </div>
//                             </div>
//                         `).join('')}
//                     </div>
//                 </div>
//             `;
//         }

//         div.innerHTML = `
//             <div class="flex gap-4">
//                 <img src="${img}" class="w-20 h-20 object-cover rounded-lg" onerror="this.src='https://via.placeholder.com/80'">
//                 <div class="flex-1">
//                     <h3 class="font-semibold">${item.title}</h3>
//                     <p class="text-sm text-gray-600">${item.size}</p>
//                 </div>
//                 <div class="text-right">
//                     <p class="font-bold">₹${itemTotal.toLocaleString('en-IN')}</p>
//                     <div class="flex items-center gap-2 mt-2">
//                         <button class="w-8 h-8 rounded-full bg-gray-200 qty-minus" data-index="${i}">-</button>
//                         <span class="w-8 text-center font-bold">${item.quantity}</span>
//                         <button class="w-8 h-8 rounded-full bg-gray-200 qty-plus" data-index="${i}">+</button>
//                     </div>
//                 </div>
//             </div>
//             ${addonsHTML}
//         `;
//         container.appendChild(div);
//     });
// }

// document.addEventListener('click', (e) => {
//     const i = e.target.dataset.index;
//     if (e.target.classList.contains('qty-plus') && i !== undefined) {
//         cartItems[i].quantity++;
//         renderCartItems();
//         updateSummary();
//     }
//     if (e.target.classList.contains('qty-minus') && i !== undefined) {
//         if (cartItems[i].quantity > 1) cartItems[i].quantity--;
//         else cartItems.splice(i, 1);
//         renderCartItems();
//         updateSummary();
//     }
// });

// // ==================== GIFT ORDER – FIXED & BEAUTIFUL ====================
// function renderGiftDetails() {
//     const existing = document.getElementById('giftSummaryCard');
//     if (existing) existing.remove();

//     if (!giftDetails) return;

//     const container = document.getElementById('addressOptions');
//     const card = document.createElement('div');
//     card.id = 'giftSummaryCard';
//     card.className = 'p-5 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border-2 border-pink-200 mt-4 shadow-sm';

//     card.innerHTML = `
//         <div class="flex justify-between items-start">
//             <div class="flex-1">
//                 <div class="flex items-center gap-2 mb-2">
//                     <i class="fas fa-gift text-pink-600 text-xl"></i>
//                     <p class="font-bold text-pink-800">This is a Gift Order</p>
//                 </div>
//                 <div class="text-sm space-y-1 ml-7">
//                     <p><span class="font-medium">To:</span> ${giftDetails.name}</p>
//                     <p><span class="font-medium">Phone:</span> ${giftDetails.phone}</p>
//                     ${giftDetails.message ? `<p class="italic text-purple-700 mt-2">"${giftDetails.message}"</p>` : ''}
//                 </div>
//             </div>
//             <button id="editGiftBtn" class="text-pink-600 hover:text-pink-800 text-sm font-medium">
//                 <i class="fas fa-edit mr-1"></i>Edit
//             </button>
//         </div>
//     `;

//     container.appendChild(card);

//     document.getElementById('editGiftBtn')?.addEventListener('click', () => {
//         openModal('giftModal');
//         document.getElementById('recipientName').value = giftDetails.name;
//         document.getElementById('recipientPhone').value = giftDetails.phone;
//         document.getElementById('giftMessage').value = giftDetails.message || '';
//     });
// }

// document.getElementById('giftOrder')?.addEventListener('click', () => {
//     if (!user) return alert('Login first');
//     orderType = 'gift';
//     openModal('giftModal');

//     document.getElementById('giftOrder').classList.remove('btn-secondary');
//     document.getElementById('giftOrder').classList.add('btn-selected');
//     document.getElementById('ownOrder').classList.remove('btn-selected');
//     document.getElementById('ownOrder').classList.add('btn-secondary');
// });

// document.getElementById('ownOrder')?.addEventListener('click', () => {
//     orderType = 'own';
//     giftDetails = null;
//     document.getElementById('giftSummaryCard')?.remove();

//     document.getElementById('ownOrder').classList.remove('btn-secondary');
//     document.getElementById('ownOrder').classList.add('btn-selected');
//     document.getElementById('giftOrder').classList.remove('btn-selected');
//     document.getElementById('giftOrder').classList.add('btn-secondary');
// });

// document.getElementById('saveGiftDetails')?.addEventListener('click', () => {
//     const name = document.getElementById('recipientName')?.value.trim();
//     const phone = document.getElementById('recipientPhone')?.value.trim();
//     const message = document.getElementById('giftMessage')?.value.trim();

//     if (!name || !phone || phone.length !== 10) {
//         alert('Please fill Recipient Name & valid 10-digit Phone');
//         return;
//     }

//     giftDetails = { name, phone, message };
//     closeModal('giftModal');
//     renderGiftDetails(); // THIS WAS THE MISSING LINE – NOW FIXED!
// });

// // ==================== UPDATE SUMMARY ====================
// function updateSummary() {
//     const subTotal = cartItems.reduce((sum, item) => {
//         const addonTotal = (item.addons || []).reduce((s, a) => s + a.price, 0);
//         return sum + (item.price * item.quantity) + addonTotal;
//     }, 0);

//     const tax = Math.round(subTotal * 0.05);
//     let deliveryCharge = 0;
//     let deliveryLabel = subTotal > 500 ? "FREE" : "₹40";

//     if (selectedAddress?.shippingPincode) {
//         const info = getDeliveryInfo(selectedAddress.shippingPincode);
//         deliveryCharge = info.charge !== null ? info.charge : 0;
//         deliveryLabel = info.charge === null 
//             ? `<span style="color:#c00; font-weight:600">${info.label}</span>`
//             : info.label;
//     }

//     const total = subTotal + deliveryCharge + tax - discount;

//     const el = document.getElementById('orderSummary');
//     if (!el) return;

//     el.innerHTML = `
//         <div class="flex justify-between py-1"><span>Subtotal</span><span>₹${subTotal.toLocaleString('en-IN')}</span></div>
//         <div class="flex justify-between py-1"><span>Delivery Charge</span><span>${deliveryLabel}</span></div>
//         <div class="flex justify-between py-1"><span>Tax (5%)</span><span>₹${tax}</span></div>
//         ${discount > 0 ? `<div class="flex justify-between py-1 text-green-600"><span>Discount</span><span>-₹${discount}</span></div>` : ''}
//         <div class="border-t my-2"></div>
//         <div class="flex justify-between text-lg font-bold"><span>Total</span><span style="color:var(--primary)">₹${total.toLocaleString('en-IN')}</span></div>
//     `;

//     const placeBtn = document.getElementById('placeOrder');
//     if (placeBtn) {
//         const info = selectedAddress ? getDeliveryInfo(selectedAddress.shippingPincode) : { charge: null };
//         placeBtn.disabled = !selectedAddress || info.charge === null || cartItems.length === 0;
//     }
// }

// // ==================== REST OF CODE (unchanged) ====================
// async function clearCart() {
//     try {
//         await fetch(`${API_BASE}/api/cart/clear-cart`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ userId: user.userId })
//         });
//     } catch (err) { log('Clear cart failed', err); }
// }

// function showLoader() {
//     let loader = document.getElementById('checkoutLoader');
//     if (!loader) {
//         loader = document.createElement('div');
//         loader.id = 'checkoutLoader';
//         loader.innerHTML = `<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
//             <div class="bg-white p-6 rounded-lg shadow-xl">
//                 <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
//                 <p class="mt-4 text-center">Processing...</p>
//             </div>
//         </div>`;
//         document.body.appendChild(loader);
//     }
//     loader.style.display = 'block';
// }

// function hideLoader() {
//     const loader = document.getElementById('checkoutLoader');
//     if (loader) loader.style.display = 'none';
// }

// function blastConfetti() {
//     if (typeof confetti === 'function') {
//         confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
//     }
// }

// async function initiateRazorpay(amountInRupees) {
//     const amountInPaise = Math.round(amountInRupees * 100);
//     const payload = {
//         userId: user.userId,
//         amount: amountInPaise,
//         currency: "INR",
//         receipt: `order_${Date.now()}`,
//         customerName: user.name,
//         customerEmail: user.email,
//         customerPhone: user.phone
//     };

//     try {
//         const res = await fetch(`${API_BASE}/api/payments/create-order`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });
//         const order = await res.json();

//         const options = {
//             key: RAZORPAY_KEY,
//             amount: order.amount,
//             currency: order.currency,
//             name: "THB Bakery",
//             description: "Order Payment",
//             order_id: order.id,
//             handler: async (response) => {
//                 hideLoader();
//                 await createOrderOnBackend(response.razorpay_order_id);
//             },
//             prefill: { name: user.name, email: user.email, contact: user.phone },
//             theme: { color: '#660B05' }
//         };

//         const rzp = new Razorpay(options);
//         rzp.open();
//     } catch (err) {
//         hideLoader();
//         alert('Payment failed');
//     }
// }

// async function createOrderOnBackend(razorpayOrderId = null) {
//     if (!selectedAddress) return alert('Select address');

//     const display = document.getElementById('selectedDateDisplay')?.textContent || '';
//     const now = new Date();
//     const localDateTime = now.toISOString().slice(0, 19).replace('T', ' ');

//     const payload = {
//         userId: user.userId,
//         shippingAddress: `${selectedAddress.houseNo}, ${selectedAddress.streetArea}`,
//         shippingCity: selectedAddress.shippingCity,
//         shippingState: selectedAddress.shippingState,
//         shippingPincode: selectedAddress.shippingPincode,
//         shippingCountry: selectedAddress.shippingCountry || 'India',
//         shippingCustomerName: user.name,
//         shippingEmail: user.email,
//         shippingPhone: user.phone,
//         customerName: user.name,
//         customerPhone: user.phone,
//         customerEmail: user.email,
//         paymentMethod: document.getElementById('paymentMethod')?.value || 'cod',
//         couponAppliedCode: selectedCoupon?.code || null,
//         discountPercent: selectedCoupon?.type === 'percentage' ? selectedCoupon.value : 0,
//         discountAmount: discount,
//         addressType: selectedAddress.addressType,
//         houseNo: selectedAddress.houseNo,
//         streetArea: selectedAddress.streetArea,
//         landmark: selectedAddress.landmark || '',
//         orderDateTime: localDateTime,
//         deliveryDateTime: display,
//         orderType: orderType === 'gift' ? 'gift' : 'own',
//         items: cartItems.map(item => ({
//             productId: item.productId,
//             snackId: item.snackId,
//             quantity: item.quantity,
//             selectedWeight: item.size,
//             cakeMessage: '',
//             specialInstructions: '',
//             partyItems: (item.addons || []).map(a => ({
//                 partItemName: a.name,
//                 partyItemQuantity: a.quantity || 1,   // partyItemQuantity: 1,
//                 partyItemPrice: a.price
//             }))
//         }))
//     };

//     if (orderType === 'gift' && giftDetails) {
//         payload.recipientName = giftDetails.name;
//         payload.recipientMobile = giftDetails.phone;
//         payload.giftMessage = giftDetails.message;
//     }

//     if (razorpayOrderId) payload.razorpayOrderId = razorpayOrderId;

//     try {
//         const res = await fetch(`${API_BASE}/api/orders/create`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });

//         if (res.ok) {
//             const order = await res.json();
//             await clearCart();
//             hideLoader();
//             blastConfetti();
//             setTimeout(() => {
//                 alert(`Order #${order.orderId} placed successfully!`);
//                 window.location.reload();
//             }, 500);
//         } else {
//             const err = await res.text();
//             hideLoader();
//             alert('Order failed: ' + err);
//         }
//     } catch (err) {
//         hideLoader();
//         alert('Network error');
//     }
// }

// document.getElementById('placeOrder')?.addEventListener('click', async () => {
//     if (!user || !selectedAddress || cartItems.length === 0) {
//         alert('Complete all fields');
//         return;
//     }

//     showLoader();

//     const subTotal = cartItems.reduce((s, i) => s + (i.price * i.quantity) + (i.addons || []).reduce((t, a) => t + a.price, 0), 0);
//     const total = subTotal + (subTotal > 500 ? 0 : 40) + Math.round(subTotal * 0.05) - discount;

//     if (document.getElementById('paymentMethod')?.value === 'online') {
//         await loadRazorpayScript();
//         hideLoader();
//         await initiateRazorpay(total);
//     } else {
//         await createOrderOnBackend();
//     }
// });

// // ==================== INIT ====================
// document.addEventListener('DOMContentLoaded', () => {
//     log('DOM Loaded');
//     validateAndSetUser();
//     updateAuthUI();

//     localStorage.removeItem('editingAddressIndex');

//     if (user) {
//         fetchAddresses();
//         fetchCartItems();
//         initDatePicker();
//     }

//     document.getElementById('saveAddress')?.addEventListener('click', saveAddress);
// });






//==============================================================================================//



// // ========================================
// // checkout.js – FULL PRODUCTION READY
// // ========================================

// console.log('%c checkout.js LOADED', 'color: green; font-weight: bold;');

// const API_BASE = 'http://localhost:8082';
// let userSession = null;
// let user = null;
// let addresses = [];
// let cartItems = [];
// let selectedAddress = null;
// let selectedCoupon = null;
// let discount = 0;
// let orderType = 'own';
// let giftDetails = null;
// let fp; // Flatpickr instance

// const RAZORPAY_KEY = 'rzp_live_RVdM6AniDvOBOH';

// // ==================== MODAL CONTROL ====================
// function openModal(modalId) {
//     const modal = document.getElementById(modalId);
//     if (modal) {
//         modal.classList.add('active');
//         document.body.style.overflow = 'hidden';
//     }
// }

// function closeModal(modalId) {
//     const modal = document.getElementById(modalId);
//     if (modal) {
//         modal.classList.remove('active');
//         document.body.style.overflow = 'auto';
//     }
// }

// // Close on outside click, X, or Cancel button
// document.addEventListener('click', (e) => {
//     const target = e.target;

//     // Click outside modal
//     if (target.classList.contains('modal')) {
//         closeModal(target.id);
//         return;
//     }

//     // X button
//     if (target.classList.contains('close')) {
//         const modal = target.closest('.modal');
//         if (modal) closeModal(modal.id);
//         return;
//     }

//     // Cancel buttons
//     if (target.id === 'cancelAddress') {
//         closeModal('addressModal');
//     }
//     if (target.id === 'cancelGift') {
//         closeModal('giftModal');
//     }
// });

// // ==================== LOGGING ====================
// function log(message, data = '') {
//     console.log(`%c[CHECKOUT] ${message}`, 'color: #0066cc; font-weight: bold;', data);
// }

// // ==================== LOAD RAZORPAY ====================
// function loadRazorpayScript() {
//     return new Promise((resolve, reject) => {
//         if (window.Razorpay) return resolve();
//         const script = document.createElement('script');
//         script.src = 'https://checkout.razorpay.com/v1/checkout.js';
//         script.onload = () => resolve();
//         script.onerror = () => reject();
//         document.body.appendChild(script);
//     });
// }

// // ==================== VALIDATE USER ====================
// function validateAndSetUser() {
//     log('Validating user session...');
//     const raw = localStorage.getItem('userSession');
//     if (!raw) return null;

//     try {
//         userSession = JSON.parse(raw);
//     } catch (e) {
//         log('Parse error', e);
//         return null;
//     }

//     if (!userSession.user || !userSession.expiry || Date.now() > userSession.expiry) {
//         localStorage.removeItem('userSession');
//         window.location.href = '/login.html';
//         return null;
//     }

//     user = {
//         userId: userSession.user.userId,
//         name: userSession.user.customerName,
//         email: userSession.user.email,
//         phone: userSession.user.mobile
//     };

//     log('USER VALIDATED', user);
//     return user;
// }

// // ==================== UPDATE AUTH UI ====================
// function updateAuthUI() {
//     const addBtn = document.getElementById('addNewAddress');
//     const placeBtn = document.getElementById('placeOrder');

//     if (!user) {
//         addBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Login / Sign Up';
//         addBtn.onclick = () => window.location.href = '/login.html';
//         placeBtn.disabled = true;
//         placeBtn.innerHTML = 'Login to Place Order';
//     } else {
//         addBtn.innerHTML = '<i class="fas fa-plus mr-2"></i>Add New Address';
//         addBtn.onclick = () => openModal('addressModal');
//         placeBtn.disabled = false;
//         placeBtn.innerHTML = '<i class="fas fa-shopping-cart mr-2"></i>PLACE ORDER';
//     }
// }

// // ==================== DATE PICKER – FLATPICKR ====================
// function initDatePicker() {
//     const tomorrow = new Date();
//     tomorrow.setDate(tomorrow.getDate() + 1);

//     fp = flatpickr("#flatpickrInput", {
//         enableTime: true,
//         dateFormat: "d M Y, h:i K",
//         minDate: tomorrow,
//         defaultHour: 10,
//         defaultMinute: 0,
//         time_24hr: false,
//         onChange: function(selectedDates, dateStr) {
//             document.getElementById("selectedDateDisplay").textContent = dateStr;
//             document.getElementById("customDatePicker").classList.remove("hidden");
//             document.getElementById("dateTimeDisplay").classList.add("hidden");
//         }
//     });

//     // Default: Today
//     const today = new Date();
//     const todayStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
//                      ', ' + today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
//     document.getElementById("selectedDateDisplay").textContent = todayStr;
// }

// // Toggle Today / Custom
// document.getElementById("todayBtn")?.addEventListener("click", () => {
//     document.getElementById("customDatePicker").classList.add("hidden");
//     document.getElementById("dateTimeDisplay").classList.remove("hidden");
//     const today = new Date();
//     const todayStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
//                      ', ' + today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
//     document.getElementById("selectedDateDisplay").textContent = todayStr;
// });

// document.getElementById("customDateBtn")?.addEventListener("click", () => {
//     document.getElementById("customDatePicker").classList.remove("hidden");
//     document.getElementById("dateTimeDisplay").classList.add("hidden");
//     fp.open();
// });

// // ==================== FETCH ADDRESSES ====================
// async function fetchAddresses() {
//     if (!user) return;
//     log('Fetching addresses...');
//     try {
//         const res = await fetch(`${API_BASE}/api/addresses/get-address-by-userId/${user.userId}`);
//         if (!res.ok) throw new Error(`HTTP ${res.status}`);
//         addresses = await res.json();
//         log('Addresses loaded', addresses);
//         renderAddresses();
//     } catch (err) {
//         log('Address fetch failed', err);
//     }
// }

// // ==================== RENDER ADDRESSES ====================
// function renderAddresses() {
//     const container = document.getElementById('addressOptions');
//     if (!container) return;

//     container.innerHTML = addresses.length === 0
//         ? '<p class="text-center text-gray-500 p-4">No addresses. Add one!</p>'
//         : '';

//     addresses.forEach((addr, i) => {
//         const full = `${addr.houseNo}, ${addr.streetArea}${addr.landmark ? ', ' + addr.landmark : ''}, ${addr.shippingCity}, ${addr.shippingState} ${addr.shippingPincode}`;
//         const card = document.createElement('div');
//         card.className = 'address-card p-4 bg-white rounded-lg border mb-3';
//         card.innerHTML = `
//             <label class="flex justify-between items-start cursor-pointer">
//                 <div class="flex items-start gap-3">
//                     <input type="radio" name="address" value="${addr.shippingId}" class="mt-1" ${i === 0 ? 'checked' : ''}>
//                     <div>
//                         <div class="font-semibold">${addr.addressType}</div>
//                         <div class="text-sm text-gray-600">${full}</div>
//                     </div>
//                 </div>
//                 <button type="button" class="edit-address text-xs text-blue-600" data-index="${i}">
//                     <i class="fas fa-edit"></i> Edit
//                 </button>
//             </label>
//         `;
//         container.appendChild(card);
//     });

//     selectedAddress = addresses[0] || null;
//     document.querySelectorAll('input[name="address"]').forEach(radio => {
//         radio.addEventListener('change', (e) => {
//             selectedAddress = addresses.find(a => a.shippingId == e.target.value);
//             log('Address selected', selectedAddress);
//         });
//     });

//     document.querySelectorAll('.edit-address').forEach(btn => {
//         btn.onclick = () => {
//             const i = parseInt(btn.dataset.index);
//             if (i >= 0 && i < addresses.length) {
//                 const addr = addresses[i];
//                 openModal('addressModal');
//                 document.getElementById('houseNumber').value = addr.houseNo;
//                 document.getElementById('areaStreet').value = addr.streetArea;
//                 document.getElementById('landmark').value = addr.landmark || '';
//                 document.getElementById('city').value = addr.shippingCity;
//                 document.getElementById('pinCode').value = addr.shippingPincode;
//                 document.getElementById('state').value = addr.shippingState;
//                 document.getElementById('addressType').value = addr.addressType;
//                 localStorage.setItem('editingAddressIndex', i);
//             }
//         };
//     });
// }

// // ==================== SAVE ADDRESS – FIXED ====================
// async function saveAddress() {
//     const form = {
//         houseNo: document.getElementById('houseNumber')?.value.trim(),
//         streetArea: document.getElementById('areaStreet')?.value.trim(),
//         landmark: document.getElementById('landmark')?.value.trim(),
//         city: document.getElementById('city')?.value.trim(),
//         pinCode: document.getElementById('pinCode')?.value.trim(),
//         state: document.getElementById('state')?.value,
//         country: document.getElementById('country')?.value,
//         addressType: document.getElementById('addressType')?.value
//     };

//     if (!form.houseNo || !form.streetArea || !form.city || !form.pinCode || form.pinCode.length !== 6) {
//         alert('Fill all fields. PIN must be 6 digits.');
//         return;
//     }

//     const payload = {
//         customerPhone: user.phone,
//         customerEmail: user.email,
//         shippingAddress: `${form.houseNo}, ${form.streetArea}`,
//         shippingCity: form.city,
//         shippingState: form.state,
//         shippingPincode: form.pinCode,
//         shippingCountry: form.country,
//         addressType: form.addressType,
//         houseNo: form.houseNo,
//         streetArea: form.streetArea,
//         landmark: form.landmark
//     };

//     // === CRITICAL FIX: Only edit if valid index and address exists ===
//     const editingIndex = localStorage.getItem('editingAddressIndex');
//     let isEditing = false;
//     let url = `${API_BASE}/api/addresses/create-address/${user.userId}`;
//     let method = 'POST';

//     if (editingIndex !== null && addresses.length > 0) {
//         const index = parseInt(editingIndex);
//         if (!isNaN(index) && index >= 0 && index < addresses.length) {
//             const addr = addresses[index];
//             url = `${API_BASE}/api/addresses/patch-address/${user.userId}/${addr.shippingId}`;
//             method = 'PATCH';
//             isEditing = true;
//         }
//     }

//     try {
//         const res = await fetch(url, {
//             method,
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });

//         if (res.ok) {
//             localStorage.removeItem('editingAddressIndex'); // Always clear
//             closeModal('addressModal');
//             fetchAddresses();
//         } else {
//             const err = await res.text();
//             alert('Save failed: ' + err);
//         }
//     } catch (err) {
//         alert('Network error');
//     }
// }

// // ==================== FETCH CART ====================
// async function fetchCartItems() {
//     if (!user) return;
//     try {
//         const res = await fetch(`${API_BASE}/api/cart/get-cart-items?userId=${user.userId}`);
//         if (!res.ok) throw new Error();
//         cartItems = await res.json();
//         renderCartItems();
//         updateSummary();
//     } catch (err) {
//         log('Cart fetch failed', err);
//     }
// }

// // ==================== RENDER CART WITH ADDONS + IMAGES ====================
// function renderCartItems() {
//     const container = document.getElementById('cartItems');
//     if (!container) return;
//     container.innerHTML = cartItems.length === 0
//         ? '<p class="text-center text-gray-500 p-8">Cart is empty</p>'
//         : '';

//     cartItems.forEach((item, i) => {
//         const img = item.imageUrl.startsWith('http') ? item.imageUrl : `${API_BASE}${item.imageUrl}`;
//         const addonTotal = (item.addons || []).reduce((s, a) => s + a.price, 0);
//         const itemTotal = item.price * item.quantity + addonTotal;

//         const div = document.createElement('div');
//         div.className = 'flex flex-col gap-4 p-4 bg-gray-50 rounded-xl mb-3';

//         let addonsHTML = '';
//         if (item.addons && item.addons.length > 0) {
//             addonsHTML = `
//                 <div class="mt-3 pt-3 border-t border-gray-200">
//                     <p class="font-medium text-sm mb-2">Add-ons:</p>
//                     <div class="flex flex-wrap gap-3">
//                         ${item.addons.map(a => `
//                             <div class="flex items-center gap-2 bg-white p-2 rounded-lg border">
//                                 <img src="${a.imageUrl}" class="w-10 h-10 object-cover rounded" onerror="this.src='https://via.placeholder.com/40'">
//                                 <div>
//                                     <p class="text-xs font-medium">${a.name}</p>
//                                     <p class="text-xs text-green-600">+₹${a.price}</p>
//                                 </div>
//                             </div>
//                         `).join('')}
//                     </div>
//                 </div>
//             `;
//         }

//         div.innerHTML = `
//             <div class="flex gap-4">
//                 <img src="${img}" class="w-20 h-20 object-cover rounded-lg" onerror="this.src='https://via.placeholder.com/80'">
//                 <div class="flex-1">
//                     <h3 class="font-semibold">${item.title}</h3>
//                     <p class="text-sm text-gray-600">${item.size}</p>
//                 </div>
//                 <div class="text-right">
//                     <p class="font-bold">₹${itemTotal.toLocaleString('en-IN')}</p>
//                     <div class="flex items-center gap-2 mt-2">
//                         <button class="w-8 h-8 rounded-full bg-gray-200 qty-minus" data-index="${i}">-</button>
//                         <span class="w-8 text-center font-bold">${item.quantity}</span>
//                         <button class="w-8 h-8 rounded-full bg-gray-200 qty-plus" data-index="${i}">+</button>
//                     </div>
//                 </div>
//             </div>
//             ${addonsHTML}
//         `;
//         container.appendChild(div);
//     });
// }

// // ==================== QUANTITY UPDATE ====================
// document.addEventListener('click', (e) => {
//     const i = e.target.dataset.index;
//     if (e.target.classList.contains('qty-plus') && i !== undefined) {
//         cartItems[i].quantity++;
//         renderCartItems();
//         updateSummary();
//     }
//     if (e.target.classList.contains('qty-minus') && i !== undefined) {
//         if (cartItems[i].quantity > 1) cartItems[i].quantity--;
//         else cartItems.splice(i, 1);
//         renderCartItems();
//         updateSummary();
//     }
// });

// // ==================== GIFT ORDER ====================
// document.getElementById('giftOrder')?.addEventListener('click', () => {
//     if (!user) return alert('Login first');
//     orderType = 'gift';
//     openModal('giftModal');
// });

// document.getElementById('saveGiftDetails')?.addEventListener('click', () => {
//     const name = document.getElementById('recipientName')?.value.trim();
//     const phone = document.getElementById('recipientPhone')?.value.trim();
//     const message = document.getElementById('giftMessage')?.value.trim();
//     if (!name || !phone || phone.length !== 10) return alert('Invalid recipient');
//     giftDetails = { name, phone, message };
//     closeModal('giftModal');
//     renderGiftDetails();
// });

// function renderGiftDetails() {
//     const container = document.getElementById('addressOptions');
//     const existing = document.getElementById('giftCard');
//     if (existing) existing.remove();
//     if (!giftDetails) return;

//     const card = document.createElement('div');
//     card.id = 'giftCard';
//     card.className = 'p-4 bg-blue-50 rounded-lg border-blue-200 mt-3';
//     card.innerHTML = `
//         <div class="flex justify-between">
//             <div>
//                 <div class="font-semibold text-blue-700">Gift Order</div>
//                 <div class="text-sm">To: ${giftDetails.name} (${giftDetails.phone})</div>
//                 ${giftDetails.message ? `<div class="text-xs italic">"${giftDetails.message}"</div>` : ''}
//             </div>
//             <button id="editGift" class="text-blue-600 text-xs">Edit</button>
//         </div>
//     `;
//     container.appendChild(card);
//     document.getElementById('editGift')?.addEventListener('click', () => openModal('giftModal'));
// }

// // ==================== UPDATE SUMMARY ====================
// function updateSummary() {
//     const subTotal = cartItems.reduce((sum, item) => {
//         const addonTotal = (item.addons || []).reduce((s, a) => s + a.price, 0);
//         return sum + (item.price * item.quantity) + addonTotal;
//     }, 0);

//     const delivery = subTotal > 500 ? 0 : 40;
//     const tax = Math.round(subTotal * 0.05);
//     const total = subTotal + delivery + tax - discount;

//     const el = document.getElementById('orderSummary');
//     if (!el) return;
//     el.innerHTML = `
//         <div class="flex justify-between py-1"><span>Subtotal</span><span>₹${subTotal}</span></div>
//         <div class="flex justify-between py-1"><span>Delivery</span><span>${delivery === 0 ? 'FREE' : '₹' + delivery}</span></div>
//         <div class="flex justify-between py-1"><span>Tax</span><span>₹${tax}</span></div>
//         ${discount > 0 ? `<div class="flex justify-between py-1 text-green-600"><span>Discount</span><span>-₹${discount}</span></div>` : ''}
//         <div class="border-t my-2"></div>
//         <div class="flex justify-between text-lg font-bold"><span>Total</span><span style="color:var(--primary)">₹${total}</span></div>
//     `;
// }

// // ==================== CLEAR CART ====================
// async function clearCart() {
//     try {
//         await fetch(`${API_BASE}/api/cart/clear-cart`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ userId: user.userId })
//         });
//         log('Cart cleared');
//     } catch (err) {
//         log('Clear cart failed', err);
//     }
// }

// // ==================== LOADER ====================
// function showLoader() {
//     let loader = document.getElementById('checkoutLoader');
//     if (!loader) {
//         loader = document.createElement('div');
//         loader.id = 'checkoutLoader';
//         loader.innerHTML = `
//             <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
//                 <div class="bg-white p-6 rounded-lg shadow-xl">
//                     <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
//                     <p class="mt-4 text-center">Processing...</p>
//                 </div>
//             </div>
//         `;
//         document.body.appendChild(loader);
//     }
//     loader.style.display = 'block';
// }

// function hideLoader() {
//     const loader = document.getElementById('checkoutLoader');
//     if (loader) loader.style.display = 'none';
// }

// // ==================== CONFETTI ====================
// function blastConfetti() {
//     if (typeof confetti === 'function') {
//         confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
//     }
// }

// // ==================== RAZORPAY ====================
// async function initiateRazorpay(amountInRupees) {
//     const amountInPaise = Math.round(amountInRupees * 100);
//     const payload = {
//         userId: user.userId,
//         amount: amountInPaise,
//         currency: "INR",
//         receipt: `order_${Date.now()}`,
//         customerName: user.name,
//         customerEmail: user.email,
//         customerPhone: user.phone
//     };

//     try {
//         const res = await fetch(`${API_BASE}/api/payments/create-order`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });
//         const order = await res.json();

//         const options = {
//             key: RAZORPAY_KEY,
//             amount: order.amount,
//             currency: order.currency,
//             name: "THB Bakery",
//             description: "Order Payment",
//             order_id: order.id,
//             handler: async (response) => {
//                 hideLoader();
//                 await createOrderOnBackend(response.razorpay_order_id);
//             },
//             prefill: { name: user.name, email: user.email, contact: user.phone },
//             theme: { color: '#660B05' }
//         };

//         const rzp = new Razorpay(options);
//         rzp.open();
//     } catch (err) {
//         hideLoader();
//         alert('Payment failed');
//     }
// }

// // ==================== CREATE ORDER ====================
// // ==================== CREATE ORDER ====================
// async function createOrderOnBackend(razorpayOrderId = null) {
//     if (!selectedAddress) return alert('Select address');

//     const display = document.getElementById('selectedDateDisplay')?.textContent || '';
//     const deliveryTime = display.includes('PM') || display.includes('AM') ? display.split(', ')[1] : 'Anytime';

//     // FIX: Get local time in correct format (YYYY-MM-DD HH:mm:ss)
//     const now = new Date();
//     const year = now.getFullYear();
//     const month = String(now.getMonth() + 1).padStart(2, '0');
//     const day = String(now.getDate()).padStart(2, '0');
//     const hours = String(now.getHours()).padStart(2, '0');
//     const minutes = String(now.getMinutes()).padStart(2, '0');
//     const seconds = String(now.getSeconds()).padStart(2, '0');
//     const localDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

//     const payload = {
//         userId: user.userId,
//         shippingAddress: `${selectedAddress.houseNo}, ${selectedAddress.streetArea}`,
//         shippingCity: selectedAddress.shippingCity,
//         shippingState: selectedAddress.shippingState,
//         shippingPincode: selectedAddress.shippingPincode,
//         shippingCountry: selectedAddress.shippingCountry || 'India',
//         shippingCustomerName: user.name,
//         shippingEmail: user.email,
//         shippingPhone: user.phone,
//         customerName: user.name,
//         customerPhone: user.phone,
//         customerEmail: user.email,
//         paymentMethod: document.getElementById('paymentMethod')?.value || 'cod',
//         couponAppliedCode: selectedCoupon?.code || null,
//         discountPercent: selectedCoupon?.type === 'percentage' ? selectedCoupon.value : 0,
//         discountAmount: discount,
//         addressType: selectedAddress.addressType,
//         houseNo: selectedAddress.houseNo,
//         streetArea: selectedAddress.streetArea,
//         landmark: selectedAddress.landmark || '',
//         orderDateTime: localDateTime, // FIXED: Now uses local time instead of UTC
//         deliveryDateTime: display,
//         orderType: orderType === 'gift' ? 'gift' : 'own',
//         items: cartItems.map(item => ({
//             productId: item.productId,
//             snackId : item.snackId,
//             quantity: item.quantity,
//             selectedWeight: item.size,
//             cakeMessage: '',
//             specialInstructions: '',
//             partyItems: (item.addons || []).map(a => ({
//                 partItemName: a.name,
//                 partyItemQuantity: 1,
//                 partyItemPrice: a.price
//             }))
//         }))
//     };

//     if (orderType === 'gift' && giftDetails) {
//         payload.recipientName = giftDetails.name;
//         payload.recipientMobile = giftDetails.phone;
//         payload.giftMessage = giftDetails.message;
//     }

//     if (razorpayOrderId) payload.razorpayOrderId = razorpayOrderId;

//     try {
//         const res = await fetch(`${API_BASE}/api/orders/create`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });

//         if (res.ok) {
//             const order = await res.json();
//             await clearCart();
//             hideLoader();
//             blastConfetti();
//             setTimeout(() => {
//                 alert(`Order #${order.orderId} placed!`);
//                 window.location.reload();
//             }, 500);
//         } else {
//             const err = await res.text();
//             hideLoader();
//             alert('Order failed: ' + err);
//         }
//     } catch (err) {
//         hideLoader();
//         alert('Network error');
//     }
// }


// // ==================== PLACE ORDER ====================
// document.getElementById('placeOrder')?.addEventListener('click', async () => {
//     if (!user || !selectedAddress || cartItems.length === 0) {
//         alert('Complete all fields');
//         return;
//     }

//     showLoader();

//     const subTotal = cartItems.reduce((s, i) => s + (i.price * i.quantity) + (i.addons || []).reduce((t, a) => t + a.price, 0), 0);
//     const total = subTotal + (subTotal > 500 ? 0 : 40) + Math.round(subTotal * 0.05) - discount;

//     if (document.getElementById('paymentMethod')?.value === 'online') {
//         await loadRazorpayScript();
//         hideLoader();
//         await initiateRazorpay(total);
//     } else {
//         await createOrderOnBackend();
//     }
// });

// // ==================== INIT ====================
// document.addEventListener('DOMContentLoaded', () => {
//     log('DOM Loaded');
//     validateAndSetUser();
//     updateAuthUI();

//     // === CLEAR STALE EDITING INDEX ON PAGE LOAD ===
//     localStorage.removeItem('editingAddressIndex');

//     if (user) {
//         fetchAddresses();
//         fetchCartItems();
//         initDatePicker();
//     }

//     document.getElementById('saveAddress')?.addEventListener('click', saveAddress);
// });