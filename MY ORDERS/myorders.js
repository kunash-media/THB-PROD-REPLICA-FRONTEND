'use strict';
let orders = [];
let currentOrderId = null;
let countdownIntervals = new Map();

const statusMap = {
    'placed': { display: 'Placed', class: 'bg-sky-100 text-sky-800 border-sky-300' },
    'shipped': { display: 'Shipped', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    'delivered': { display: 'Delivered', class: 'bg-green-100 text-green-800 border-green-300' },
    'cancelled': { display: 'Cancelled', class: 'bg-red-100 text-red-800 border-red-300' },
};

function parseDate(dateStr) {
    const [date, time] = dateStr.split(' ');
    const [y, m, d] = date.split('-');
    const [h, min, s] = time.split(':');
    return new Date(Date.UTC(y, m - 1, d, h, min, s));
}

function normalizeStatus(status) {
    return (status || '').toString().trim().toLowerCase();
}

function isWithinCancellationWindow(dateStr) {
    const orderTime = parseDate(dateStr);
    const now = new Date();
    const diffMs = now - orderTime;
    const fifteenMinutes = 15 * 60 * 1000;
    return diffMs >= 0 && diffMs < fifteenMinutes;
}

function formatCountdown(ms) {
    if (ms <= 0) return "Time expired";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function updateCountdown(orderId, orderDateTime) {
    const timerElement = document.querySelector(`[data-order-id="${orderId}"] .cancel-timer`);
    const cancelBtn = document.querySelector(`[data-order-id="${orderId}"] .cancel-btn`);
    if (!timerElement) return;

    const orderTime = parseDate(orderDateTime);
    const fifteenMinutes = 15 * 60 * 1000;
    const targetTime = new Date(orderTime.getTime() + fifteenMinutes);

    const update = () => {
        const now = new Date();
        const remaining = targetTime - now;
        if (remaining <= 0) {
            timerElement.textContent = "Cancellation expired";
            timerElement.classList.add('text-red-600', 'font-medium');
            if (cancelBtn) {
                cancelBtn.classList.replace('btn-danger', 'btn-outline');
                cancelBtn.disabled = true;
                cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            }
            clearInterval(countdownIntervals.get(orderId));
            countdownIntervals.delete(orderId);
            return;
        }
        timerElement.textContent = formatCountdown(remaining);
    };

    update();
    const interval = setInterval(update, 1000);
    countdownIntervals.set(orderId, interval);
}

function showModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('hidden');
    setTimeout(() => modal.querySelector('.modal-card').classList.add('show'), 10);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    const card = modal.querySelector('.modal-card');
    card.classList.remove('show');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function getUserId() {
    try {
        return JSON.parse(localStorage.getItem('userSession') || '{}')?.user?.userId;
    } catch { return null; }
}

async function fetchOrders() {
    const userId = getUserId();
    const loading = document.getElementById('loadingOverlay');
    const container = document.getElementById('ordersList');
    loading.classList.remove('hidden');

    countdownIntervals.forEach(i => clearInterval(i));
    countdownIntervals.clear();

    if (!userId) {
        container.innerHTML = `<div class="text-center py-16 order-card"><i class="fas fa-user-lock text-6xl text-primary mb-4"></i><h2 class="text-2xl font-bold text-primary mb-2">Login Required</h2><a href="../login.html" class="btn btn-primary">Log In</a></div>`;
        loading.classList.add('hidden');
        return;
    }

    try {
        const res = await fetch(`http://localhost:8082/api/orders/user/${userId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        orders = data
            .map(o => {
                const statusKey = normalizeStatus(o.orderStatus);
                const status = statusMap[statusKey] || { display: statusKey, class: 'bg-gray-100 text-gray-800' };
                const canCancel = statusKey === 'placed' && isWithinCancellationWindow(o.orderDateTime);

                return {
                    id: o.orderId,
                    date: new Date(o.orderDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    status: status.display,
                    statusClass: status.class,
                    canCancel,
                    total: (o.totalAmount || 0).toFixed(2),
                    api: o,
                    orderDateTime: o.orderDateTime
                };
            })
            .sort((a, b) => parseDate(b.api.orderDateTime) - parseDate(a.api.orderDateTime));

        renderOrders();
    } catch (err) {
        console.error('%c[Fetch Error]', 'color: #F44336;', err);
        container.innerHTML = `<div class="text-center py-16 order-card"><i class="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i><h2 class="text-2xl font-bold text-primary mb-2">Error</h2><button onclick="fetchOrders()" class="btn btn-primary">Retry</button></div>`;
    } finally {
        loading.classList.add('hidden');
    }
}

function renderOrders() {
    const container = document.getElementById('ordersList');
    container.innerHTML = '';

    if (!orders.length) {
        container.innerHTML = `<div class="text-center py-20 order-card"><i class="fas fa-shopping-bag text-7xl text-primary mb-6"></i><h2 class="text-3xl font-bold text-primary mb-4">No Orders</h2><a href="/home.html" class="btn btn-primary">Shop Now</a></div>`;
        return;
    }

    orders.forEach(order => {
        const api = order.api;
        const firstItem = api.items?.[0] || {};
        const totalItems = api.items?.length || 0;
        const totalAddons = api.items?.reduce((s, i) => s + (i.partyItems?.length || 0), 0) || 0;
        const addonsBadge = totalAddons ? `<span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full ml-2">+${totalAddons}</span>` : '';

        let cancelSection = order.canCancel ? `
            <button class="btn btn-danger cancel-btn" data-id="${order.id}"><i class="fas fa-times"></i> Cancel</button>
            <div class="cancel-timer text-xs font-medium text-orange-600 mt-2"></div>
        ` : `
            <button class="btn btn-outline opacity-50 cursor-not-allowed" disabled>Cancel</button>
            <div class="text-xs text-gray-500 mt-2">Cancellation expired</div>
        `;

        const invoiceBtn = normalizeStatus(order.status) === 'delivered'
            ? `<button class="btn btn-outline border-green-600 text-green-600 hover:bg-green-500 invoice-btn" data-id="${order.id}"><i class="fas fa-file-invoice"></i> Invoice</button>`
            : '';

        const policy = `<p class="text-xs text-gray-500 italic mt-1"><span class="font-semibold text-red-700">Note</span>: Cancel within 15 minutes after placing the order.</p>`;

        container.innerHTML += `
            <div class="order-card" data-order-id="${order.id}">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="text-lg font-bold text-primary">Order #${order.id}</h3>
                        <p class="text-sm text-dark">Placed on ${order.date}</p>
                    </div>
                    <span class="status-badge ${order.statusClass}">${order.status}</span>
                </div>
                <div class="flex gap-4 mb-4">
                    <img src="${firstItem.productImage || 'https://via.placeholder.com/120'}" class="w-20 h-20 rounded-lg object-cover shadow-sm">
                    <div class="flex-1">
                        <h4 class="font-semibold text-primary">${totalItems === 1 ? firstItem.productName : `${totalItems} Items`} ${addonsBadge}</h4>
                        <p class="text-sm text-dark">View details →</p>
                    </div>
                    <p class="text-lg font-bold text-primary">₹${order.total}</p>
                </div>
                <div class="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200">
                    <div class="flex gap-2 items-center">
                        ${cancelSection}
                        <button class="btn btn-primary view-btn" data-id="${order.id}"><i class="fas fa-eye"></i> Details</button>
                        ${invoiceBtn}
                    </div>
                    <div class="ml-auto text-right">
                        <p class="text-sm font-medium text-dark">Total: <span class="text-primary font-bold">₹${order.total}</span></p>
                    </div>
                </div>
                <div class="mt-2 pt-3 border-t border-gray-200">${policy}</div>
            </div>
        `;

        if (order.canCancel) setTimeout(() => updateCountdown(order.id, order.orderDateTime), 100);
    });

    attachButtons();
}

function attachButtons() {
    document.querySelectorAll('.cancel-btn,.view-btn,.invoice-btn').forEach(btn => {
        btn.onclick = () => {
            if (btn.classList.contains('cancel-btn')) handleCancel(btn.dataset.id);
            if (btn.classList.contains('view-btn')) handleView(btn.dataset.id);
            if (btn.classList.contains('invoice-btn')) downloadInvoice(btn.dataset.id);
        };
    });
}

function handleCancel(id) {
    const order = orders.find(o => o.id == id);
    if (!order?.canCancel) return toast('Cancellation not allowed', 'error');
    currentOrderId = id;
    document.getElementById('cancelWarningText').innerHTML = `<p class="mb-2">Cancel Order #${id}?</p>`;
    showModal('cancelModal');
}

async function confirmCancel() {
    if (!currentOrderId) return;
    closeModal('cancelModal');
    document.getElementById('loadingOverlay').classList.remove('hidden');
    try {
        const res = await fetch(`http://localhost:8082/api/orders/${currentOrderId}/cancel`, { method: 'POST' });
        res.ok ? (toast('Order cancelled!', 'success'), fetchOrders()) : toast('Failed to cancel', 'error');
    } catch { toast('Network error', 'error'); }
    finally { document.getElementById('loadingOverlay').classList.add('hidden'); }
}

function handleView(id) {
    const order = orders.find(o => o.id == id);
    if (!order) return;
    const api = order.api;
    const items = api.items || [];

    let itemsHtml = '';
    let productSubtotal = 0;
    let addonsTotal = 0;

    items.forEach(item => {
        const qty = item.quantity ?? 1;
        const lineTotal = (item.subtotal || 0);
        productSubtotal += lineTotal;

        itemsHtml += `
            <div class="flex gap-4 items-start pb-4 border-b border-gray-200 last:border-0">
                <img src="${item.productImage || 'https://via.placeholder.com/120'}" class="w-24 h-24 rounded-lg object-cover shadow-sm">
                <div class="flex-1">
                    <p class="text-lg font-bold text-primary">${item.productName}</p>
                    <p class="text-sm text-dark mt-1">Weight: ${item.selectedWeight || '—'}</p>
                    <p class="text-sm text-dark">Quantity: ${qty}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-dark">₹${(item.unitPrice || 0).toFixed(2)} × ${qty}</p>
                    <p class="font-bold text-primary">₹${lineTotal.toFixed(2)}</p>
                </div>
            </div>
        `;

        if (item.partyItems?.length > 0) {
            item.partyItems.forEach(p => {
                const addonPrice = (p.partyItemPrice || 0) * (p.partyItemQuantity || 1);
                addonsTotal += addonPrice;
                itemsHtml += `
                    <div class="border gray-50 ml-12 -mt-2 mb-3 p-3 bg-purple-50 rounded-lg text-xs">
                        <div class="flex justify-between">
                            <span>• ${p.partyItemName} × ${p.partyItemQuantity || 1}</span>
                            <span class="font-medium">₹${addonPrice.toFixed(2)}</span>
                        </div>
                    </div>
                `;
            });
        }
    });

    const discountLine = api.discountAmount > 0 ? `
        <div class="flex justify-between text-red-600">
            <span>Discount ${api.discountPercent > 0 ? `(${api.discountPercent}%)` : ''}</span>
            <span>-₹${api.discountAmount.toFixed(2)}</span>
        </div>` : '';

    const convenienceLine = api.convenienceFee > 0 ? `
        <div class="flex justify-between">
            <span>Convenience Fee</span>
            <span>₹${api.convenienceFee.toFixed(2)}</span>
        </div>` : '';

    const statusBadge = `<span class="status-badge ${order.statusClass}">${order.status}</span>`;

    document.getElementById('viewContent').innerHTML = `
        <div class="space-y-5">
            ${itemsHtml}

            <div class="mt-5 pt-4 border-t border-gray-300 space-y-3 text-sm font-medium">
                <div class="flex justify-between">
                    <span>Items Total</span>
                    <span>₹${productSubtotal.toFixed(2)}</span>
                </div>
                ${addonsTotal > 0 ? `
                <div class="flex justify-between text-purple-700">
                    <span>Add-ons Total</span>
                    <span>₹${addonsTotal.toFixed(2)}</span>
                </div>` : ''}
                <div class="flex justify-between text-lg font-bold text-primary pt-3 border-t">
                    <span>Subtotal</span>
                    <span>₹${(productSubtotal + addonsTotal).toFixed(2)}</span>
                </div>
                ${discountLine}
                <div class="flex justify-between">
                    <span>Tax</span>
                    <span>₹${(api.tax || 0).toFixed(2)}</span>
                </div>
                ${convenienceLine}
                <div class="flex justify-between text-xl font-bold text-primary pt-4 border-t border-gray-400">
                    <span>Total Paid</span>
                    <span>₹${order.total}</span>
                </div>
            </div>

            <div class="mt-6 pt-5 border-t border-gray-200 space-y-3 text-sm">
                <div class="flex justify-between"><span class="text-dark">Status</span>${statusBadge}</div>
                <div class="flex justify-between"><span class="text-dark">Placed</span><span>${order.date}</span></div>
                <div class="flex justify-between"><span class="text-dark">Delivery</span><span>${api.deliveryDateTime || '—'}</span></div>
                ${api.giftMessage ? `<div class="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                    <p class="font-medium">Gift Message:</p>
                    <p class="italic">"${api.giftMessage}"</p>
                </div>` : ''}
            </div>
        </div>
    `;

    showModal('viewModal');
}

async function downloadInvoice(id) {
    const order = orders.find(o => o.id == id);
    if (!order || normalizeStatus(order.status) !== 'delivered') return;
    const api = order.api;

    document.getElementById('printOrderId').textContent = api.orderId;
    document.getElementById('printOrderDate').textContent = new Date(api.orderDateTime).toLocaleDateString('en-IN');
    document.getElementById('printDeliveryDate').textContent = api.deliveryDateTime || '—';
    document.getElementById('printCustomerName').textContent = api.customerName;
    document.getElementById('printCustomerPhone').textContent = api.customerPhone;
    document.getElementById('printCustomerEmail').textContent = api.customerEmail || '—';
    document.getElementById('printShippingName').textContent = api.shippingCustomerName;
    document.getElementById('printShippingAddress').textContent = `${api.shippingAddress}, ${api.shippingCity}, ${api.shippingState} - ${api.shippingPincode}`;
    document.getElementById('printShippingPhone').textContent = api.shippingPhone;

    const tbody = document.getElementById('printItemsTable');
    tbody.innerHTML = '';
    let subtotal = 0;

    (api.items || []).forEach(item => {
        const qty = item.quantity ?? 1;
        const lineTotal = item.subtotal || 0;
        tbody.innerHTML += `<tr>
            <td class="border p-2">${item.productName}</td>
            <td class="border p-2 text-center">${qty}</td>
            <td class="border p-2 text-center">${item.selectedWeight || '—'}</td>
            <td class="border p-2 text-right">₹${(item.unitPrice || 0).toFixed(2)}</td>
            <td class="border p-2 text-right">₹${lineTotal.toFixed(2)}</td>
        </tr>`;
        subtotal += lineTotal;

        (item.partyItems || []).forEach(p => {
            const addonTotal = (p.partyItemPrice || 0) * (p.partyItemQuantity || 1);
            tbody.innerHTML += `<tr>
                <td class="border p-2 pl-8 italic text-sm">— ${p.partyItemName}</td>
                <td class="border p-2 text-center">${p.partyItemQuantity || 1}</td>
                <td class="border p-2 text-center">-</td>
                <td class="border p-2 text-right">₹${(p.partyItemPrice || 0).toFixed(2)}</td>
                <td class="border p-2 text-right">₹${addonTotal.toFixed(2)}</td>
            </tr>`;
            subtotal += addonTotal;
        });
    });

    document.getElementById('printSubtotal').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('printTax').textContent = `₹${(api.tax || 0).toFixed(2)}`;
    document.getElementById('printDiscount').textContent = `₹${(api.discountAmount || 0).toFixed(2)}`;
    document.getElementById('printTotal').textContent = `₹${api.totalAmount.toFixed(2)}`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    const clone = document.getElementById('printableInvoice').cloneNode(true);
    clone.style.display = 'block';
    doc.body.appendChild(clone);
    const style = doc.createElement('style');
    style.textContent = document.querySelector('style').textContent;
    doc.head.appendChild(style);

    await new Promise(r => setTimeout(r, 300));
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
    toast('Invoice ready! Save as PDF', 'success');
}

function toast(message, type = 'info') {
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        backgroundColor: type === 'success' ? "#10B981" : type === 'error' ? "#EF4444" : "#3B82F6",
    }).showToast();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('%c[MyOrders] Loaded', 'color: #8B4513; font-weight: bold;');
    fetchOrders();
});












//========================================= OLD PROD CODE =========================================//


// 'use strict';
// let orders = [];
// let currentOrderId = null;
// let countdownIntervals = new Map(); // To store interval IDs per order

// // STATUS MAP (lowercase keys for consistency)
// const statusMap = {
//     'placed': { display: 'Placed', class: 'bg-sky-100 text-sky-800 border-sky-300' },
//     'shipped': { display: 'Shipped', class: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
//     'delivered': { display: 'Delivered', class: 'bg-green-100 text-green-800 border-green-300' },
//     'cancelled': { display: 'Cancelled', class: 'bg-red-100 text-red-800 border-red-300' },
// };

// // PARSE DATE SAFELY
// function parseDate(dateStr) {
//     const [date, time] = dateStr.split(' ');
//     const [y, m, d] = date.split('-');
//     const [h, min, s] = time.split(':');
//     return new Date(Date.UTC(y, m - 1, d, h, min, s));
// }

// // NORMALIZE STATUS (handles any case)
// function normalizeStatus(status) {
//     return (status || '').toString().trim().toLowerCase();
// }

// // CHECK IF ORDER IS WITHIN 30-MINUTE CANCELLATION WINDOW
// function isWithinCancellationWindow(dateStr) {
//     const orderTime = parseDate(dateStr);
//     const now = new Date();
//     const diffMs = now - orderTime;
//     const thirtyMinutes = 30 * 60 * 1000;
//     const within = diffMs >= 0 && diffMs < thirtyMinutes;
//     console.log(`%c[CANCEL] ${dateStr} → ${within ? 'YES' : 'NO'} (${Math.floor(diffMs / 60000)}m elapsed)`, 'color: #FF9800;');
//     return within;
// }

// // FORMAT REMAINING TIME FOR COUNTDOWN
// function formatCountdown(ms) {
//     if (ms <= 0) return "Time expired";
//     const minutes = Math.floor(ms / 60000);
//     const seconds = Math.floor((ms % 60000) / 1000);
//     return `Cancel in ${minutes}m ${seconds.toString().padStart(2, '0')}s`;
// }

// // UPDATE COUNTDOWN TIMER FOR A SPECIFIC ORDER
// function updateCountdown(orderId, orderDateTime) {
//     const timerElement = document.querySelector(`[data-order-id="${orderId}"] .cancel-timer`);
//     const cancelBtn = document.querySelector(`[data-order-id="${orderId}"] .cancel-btn`);

//     if (!timerElement) return;

//     const orderTime = parseDate(orderDateTime);
//     const thirtyMinutes = 30 * 60 * 1000;
//     const targetTime = new Date(orderTime.getTime() + thirtyMinutes);

//     const update = () => {
//         const now = new Date();
//         const remaining = targetTime - now;

//         if (remaining <= 0) {
//             timerElement.textContent = "Cancellation expired";
//             timerElement.classList.add('text-red-600', 'font-medium');
//             if (cancelBtn) {
//                 cancelBtn.classList.replace('btn-danger', 'btn-outline');
//                 cancelBtn.disabled = true;
//                 cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
//             }
//             clearInterval(countdownIntervals.get(orderId));
//             countdownIntervals.delete(orderId);
//             return;
//         }

//         timerElement.textContent = formatCountdown(remaining);
//     };

//     update(); // Initial call
//     const interval = setInterval(update, 1000);
//     countdownIntervals.set(orderId, interval);
// }

// function showModal(id) {
//     const modal = document.getElementById(id);
//     modal.classList.remove('hidden');
//     setTimeout(() => modal.querySelector('.modal-card').classList.add('show'), 10);
// }

// function closeModal(id) {
//     const modal = document.getElementById(id);
//     const card = modal.querySelector('.modal-card');
//     card.classList.remove('show');
//     setTimeout(() => modal.classList.add('hidden'), 300);
// }

// function getUserId() {
//     try {
//         return JSON.parse(localStorage.getItem('userSession') || '{}')?.user?.userId;
//     } catch { return null; }
// }

// async function fetchOrders() {
//     const userId = getUserId();
//     const loading = document.getElementById('loadingOverlay');
//     const container = document.getElementById('ordersList');
//     loading.classList.remove('hidden');

//     // Clear all existing countdown intervals
//     countdownIntervals.forEach(interval => clearInterval(interval));
//     countdownIntervals.clear();

//     if (!userId) {
//         container.innerHTML = `<div class="text-center py-16 order-card"><i class="fas fa-user-lock text-6xl text-primary mb-4"></i><h2 class="text-2xl font-bold text-primary mb-2">Login Required</h2><a href="../login.html" class="btn btn-primary">Log In</a></div>`;
//         loading.classList.add('hidden');
//         return;
//     }

//     try {
//         const res = await fetch(`http://localhost:8082/api/orders/user/${userId}`);
//         if (!res.ok) throw new Error(`HTTP ${res.status}`);
//         const data = await res.json();

//         orders = data
//             .map(o => {
//                 const item = o.items?.[0] || {};
//                 const statusKey = normalizeStatus(o.orderStatus);
//                 const status = statusMap[statusKey] || { display: statusKey, class: 'bg-gray-100 text-gray-800' };
//                 const canCancel = statusKey === 'placed' && isWithinCancellationWindow(o.orderDateTime);

//                 return {
//                     id: o.orderId,
//                     date: new Date(o.orderDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
//                     status: status.display,
//                     statusClass: status.class,
//                     canCancel,
//                     product: {
//                         name: item.productName || 'Unknown',
//                         qty: item.quantity || 1,
//                         weight: item.selectedWeight,
//                         price: (item.subtotal || 0).toFixed(2),
//                         image: item.productImage || 'https://via.placeholder.com/120?text=No+Image',
//                     },
//                     total: (o.totalAmount || 0).toFixed(2),
//                     partyItems: item.partyItems || [],
//                     api: o,
//                     orderDateTime: o.orderDateTime
//                 };
//             })
//             .sort((a, b) => parseDate(b.api.orderDateTime) - parseDate(a.api.orderDateTime));

//         renderOrders();
//     } catch (err) {
//         console.error('%c[Fetch Error]', 'color: #F44336;', err);
//         container.innerHTML = `<div class="text-center py-16 order-card"><i class="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i><h2 class="text-2xl font-bold text-primary mb-2">Error</h2><button onclick="fetchOrders()" class="btn btn-primary">Retry</button></div>`;
//     } finally {
//         loading.classList.add('hidden');
//     }
// }

// function renderOrders() {
//     const container = document.getElementById('ordersList');
//     container.innerHTML = '';

//     if (!orders.length) {
//         container.innerHTML = `<div class="text-center py-20 order-card"><i class="fas fa-shopping-bag text-7xl text-primary mb-6"></i><h2 class="text-3xl font-bold text-primary mb-4">No Orders</h2><a href="/home.html" class="btn btn-primary">Shop Now</a></div>`;
//         return;
//     }

//     orders.forEach(order => {
//         const addons = order.partyItems.length ? `<span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full ml-2">+${order.partyItems.length}</span>` : '';

//         let cancelSection = '';
//         if (order.canCancel) {
//             cancelSection = `
//                 <button class="btn btn-danger cancel-btn" data-id="${order.id}">
//                     <i class="fas fa-times"></i> Cancel
//                 </button>
//                 <div class="cancel-timer text-xs font-medium text-orange-600 mt-2"></div>
//             `;
//         } else {
//             cancelSection = `
//                 <button class="btn btn-outline opacity-50 cursor-not-allowed" disabled>Cancel</button>
//                 <div class="text-xs text-gray-500 mt-2">Cancellation expired</div>
//             `;
//         }

//         const invoiceBtn = normalizeStatus(order.status) === 'delivered'
//             ? `<button class="btn btn-outline border-green-600 text-green-600 hover:bg-green-500 invoice-btn" data-id="${order.id}">
//                  <i class="fas fa-file-invoice"></i> Invoice
//                </button>`
//             : '';

//         const policy = `<p class="text-xs text-gray-500 italic mt-1"><span class="font-semibold text-red-700">Note</span>: Cancel within 30 minutes after placing the order.</p>`;

//         container.innerHTML += `
//             <div class="order-card" data-order-id="${order.id}">
//                 <div class="flex justify-between items-start mb-3">
//                     <div>
//                         <h3 class="text-lg font-bold text-primary">Order #${order.id}</h3>
//                         <p class="text-sm text-dark">Placed on ${order.date}</p>
//                     </div>
//                     <span class="status-badge ${order.statusClass}">${order.status}</span>
//                 </div>
//                 <div class="flex gap-4 mb-4">
//                     <img src="${order.product.image}" alt="${order.product.name}" class="w-20 h-20 rounded-lg object-cover shadow-sm">
//                     <div class="flex-1">
//                         <h4 class="font-semibold text-primary">${order.product.name}${addons}</h4>
//                         <p class="text-sm text-dark">Qty: ${order.product.qty} × ${order.product.weight || ''}</p>
//                     </div>
//                     <p class="text-lg font-bold text-primary">₹${order.product.price}</p>
//                 </div>
//                 <div class="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-200">
//                     <div class="flex gap-2 items-center">
//                         ${cancelSection}
//                         <button class="btn btn-primary view-btn" data-id="${order.id}"><i class="fas fa-eye"></i> Details</button>
//                         ${invoiceBtn}
//                     </div>
//                     <div class="ml-auto text-right">
//                         <p class="text-sm font-medium text-dark">Total: <span class="text-primary font-bold">₹${order.total}</span></p>
//                     </div>
//                 </div>
//                 <div class="mt-2 pt-3 border-t border-gray-200">
//                     ${policy}
//                 </div>
//             </div>
//         `;

//         // Start countdown timer if cancellable
//         if (order.canCancel) {
//             setTimeout(() => updateCountdown(order.id, order.orderDateTime), 100);
//         }
//     });

//     attachButtons();
// }

// function attachButtons() {
//     document.querySelectorAll('.cancel-btn').forEach(btn => {
//         btn.onclick = () => {
//             const id = btn.dataset.id;
//             console.log('%c[CANCEL CLICK]', 'color: #FF5722;', id);
//             handleCancel(id);
//         };
//     });
//     document.querySelectorAll('.view-btn').forEach(btn => {
//         btn.onclick = () => {
//             const id = btn.dataset.id;
//             console.log('%c[VIEW CLICK]', 'color: #9C27B0;', id);
//             handleView(id);
//         };
//     });
//     document.querySelectorAll('.invoice-btn').forEach(btn => {
//         btn.onclick = () => {
//             const id = btn.dataset.id;
//             console.log('%c[INVOICE CLICK]', 'color: #10B981;', id);
//             downloadInvoice(id);
//         };
//     });
// }

// function handleCancel(id) {
//     const order = orders.find(o => o.id == id);
//     if (!order?.canCancel) {
//         toast('Cancellation not allowed', 'error');
//         return;
//     }
//     currentOrderId = id;
//     document.getElementById('cancelWarningText').innerHTML = `
//         <p class="mb-2">Are you sure you want to cancel?</p>
//     `;
//     showModal('cancelModal');
// }

// async function confirmCancel() {
//     if (!currentOrderId) return;
//     closeModal('cancelModal');
//     document.getElementById('loadingOverlay').classList.remove('hidden');
//     try {
//         const res = await fetch(`http://localhost:8082/api/orders/${currentOrderId}/cancel`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' }
//         });
//         if (res.ok) {
//             toast('Order cancelled successfully!', 'success');
//             await fetchOrders();
//         } else {
//             const err = await res.text();
//             console.error('%c[Cancel API Error]', 'color: #F44336;', err);
//             toast('Failed to cancel. Try again.', 'error');
//         }
//     } catch (err) {
//         console.error('%c[Cancel Network Error]', 'color: #F44336;', err);
//         toast('Network error. Check connection.', 'error');
//     } finally {
//         document.getElementById('loadingOverlay').classList.add('hidden');
//     }
// }

// function handleView(id) {
//     const order = orders.find(o => o.id == id);
//     if (!order) return;
//     const { product, partyItems, total, api } = order;
//     const item = api.items[0];
//     let discountLine = '';
//     if (api.discountAmount > 0) {
//         discountLine = `
//             <div class="flex justify-between">
//                 <span class="text-dark">Discount ${api.discountPercent > 0 ? `(${api.discountPercent}%)` : ''}</span>
//                 <span class="text-red-600 font-medium">-₹${api.discountAmount.toFixed(2)}</span>
//             </div>
//         `;
//     }
//     const partyHtml = partyItems.length ? `
//         <div class="mt-4 p-4 bg-gray-50 rounded-lg">
//             <p class="font-medium text-dark mb-2 text-xs uppercase tracking-wider">Add-ons</p>
//             ${partyItems.map(p => `
//                 <div class="flex justify-between text-xs mb-1">
//                     <span>• ${p.partyItemName} × ${p.partyItemQuantity}</span>
//                     <span>₹${(p.partyItemPrice || 0).toFixed(2)}</span>
//                 </div>
//             `).join('')}
//         </div>
//     ` : '';
//     const orderTypeBadge = api.orderType === 'gift'
//         ? `<span class="inline-block px-2 py-0.5 text-xs font-medium bg-pink-100 text-pink-700 rounded-full ml-2">Gift</span>`
//         : '';
//     const statusBadge = `<span class="status-badge ${order.statusClass}">${order.status}</span>`;
//     document.getElementById('viewContent').innerHTML = `
//         <div class="flex gap-4 items-start pb-4 border-b border-gray-200">
//             <img src="${product.image}" alt="${product.name}" class="w-24 h-24 rounded-lg object-cover shadow-sm">
//             <div class="flex-1">
//                 <div class="flex items-center gap-2">
//                     <p class="text-lg font-bold text-primary">${product.name}</p>
//                     ${orderTypeBadge}
//                 </div>
//                 <p class="text-sm text-dark mt-1">Weight: ${product.weight || '—'}</p>
//                 <p class="text-sm text-dark">Qty: ${product.qty}</p>
//             </div>
//         </div>
//         <div class="mt-4 space-y-2 text-sm">
//             <div class="flex justify-between">
//                 <span class="text-dark">Subtotal</span>
//                 <span>₹${product.price}</span>
//             </div>
//             ${discountLine}
//             <div class="flex justify-between">
//                 <span class="text-dark">Tax</span>
//                 <span>₹${(api.tax || 0).toFixed(2)}</span>
//             </div>
//             ${api.convenienceFee > 0 ? `
//             <div class="flex justify-between">
//                 <span class="text-dark">Convenience Fee</span>
//                 <span>₹${api.convenienceFee.toFixed(2)}</span>
//             </div>` : ''}
//             <div class="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
//                 <span class="text-primary">Total</span>
//                 <span class="text-primary">₹${total}</span>
//             </div>
//         </div>
//         ${partyHtml}
//         <div class="mt-5 pt-4 border-t border-gray-200 space-y-2 text-sm">
//             <div class="flex justify-between items-center">
//                 <span class="text-dark">Status</span>
//                 ${statusBadge}
//             </div>
//             <div class="flex justify-between">
//                 <span class="text-dark">Placed</span>
//                 <span>${order.date}</span>
//             </div>
//             <div class="flex justify-between">
//                 <span class="text-dark">Delivery</span>
//                 <span>${api.deliveryDateTime || '—'}</span>
//             </div>
//             <div class="flex justify-between">
//                 <span class="text-dark">Recipient</span>
//                 <span>${api.recipientName || '—'}</span>
//             </div>
//             ${api.giftMessage ? `
//             <div class="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
//                 <p class="font-medium mb-1">Gift Message:</p>
//                 <p class="italic">"${api.giftMessage}"</p>
//             </div>` : ''}
//         </div>
//     `;
//     showModal('viewModal');
// }

// async function downloadInvoice(id) {
//     const order = orders.find(o => o.id == id);
//     if (!order || normalizeStatus(order.status) !== 'delivered') return;
//     const api = order.api;
//     const item = api.items[0];
//     document.getElementById('printOrderId').textContent = api.orderId;
//     document.getElementById('printOrderDate').textContent = new Date(api.orderDateTime).toLocaleDateString('en-IN');
//     document.getElementById('printDeliveryDate').textContent = api.deliveryDateTime || '—';
//     document.getElementById('printCustomerName').textContent = api.customerName;
//     document.getElementById('printCustomerPhone').textContent = api.customerPhone;
//     document.getElementById('printCustomerEmail').textContent = api.customerEmail || '—';
//     document.getElementById('printShippingName').textContent = api.shippingCustomerName;
//     document.getElementById('printShippingAddress').textContent = `${api.shippingAddress}, ${api.shippingCity}, ${api.shippingState} - ${api.shippingPincode}`;
//     document.getElementById('printShippingPhone').textContent = api.shippingPhone;
//     const tbody = document.getElementById('printItemsTable');
//     tbody.innerHTML = '';
//     let subtotal = 0;
//     tbody.innerHTML += `<tr>
//         <td class="border p-2">${item.productName}</td>
//         <td class="border p-2 text-center">${item.quantity}</td>
//         <td class="border p-2 text-center">${item.selectedWeight || '—'}</td>
//         <td class="border p-2 text-right">₹${(item.unitPrice || 0).toFixed(2)}</td>
//         <td class="border p-2 text-right">₹${(item.subtotal || 0).toFixed(2)}</td>
//     </tr>`;
//     subtotal += item.subtotal || 0;
//     (item.partyItems || []).forEach(p => {
//         tbody.innerHTML += `<tr>
//             <td class="border p-2 pl-8 italic text-sm">— ${p.partyItemName}</td>
//             <td class="border p-2 text-center">${p.partyItemQuantity}</td>
//             <td class="border p-2 text-center">-</td>
//             <td class="border p-2 text-right">₹${(p.partyItemPrice || 0).toFixed(2)}</td>
//             <td class="border p-2 text-right">₹${(p.partyItemSubtotal || 0).toFixed(2)}</td>
//         </tr>`;
//         subtotal += p.partyItemSubtotal || 0;
//     });
//     document.getElementById('printSubtotal').textContent = `₹${subtotal.toFixed(2)}`;
//     document.getElementById('printTax').textContent = `₹${(api.tax || 0).toFixed(2)}`;
//     document.getElementById('printDiscount').textContent = `₹${(api.discountAmount || 0).toFixed(2)}`;
//     document.getElementById('printTotal').textContent = `₹${api.totalAmount.toFixed(2)}`;

//     const iframe = document.createElement('iframe');
//     iframe.style.position = 'fixed';
//     iframe.style.right = '0';
//     iframe.style.bottom = '0';
//     iframe.style.width = '0';
//     iframe.style.height = '0';
//     iframe.style.border = '0';
//     document.body.appendChild(iframe);
//     const doc = iframe.contentWindow.document;
//     const clone = document.getElementById('printableInvoice').cloneNode(true);
//     clone.style.display = 'block';
//     doc.body.innerHTML = '';
//     doc.body.appendChild(clone);
//     const style = doc.createElement('style');
//     style.textContent = document.querySelector('style').textContent;
//     doc.head.appendChild(style);

//     await new Promise(r => {
//         const img = doc.querySelector('img');
//         if (!img || img.complete) r();
//         else { img.onload = r; img.onerror = r; }
//     });

//     iframe.contentWindow.focus();
//     iframe.contentWindow.print();
//     setTimeout(() => document.body.removeChild(iframe), 1500);
//     toast('Invoice ready! Save as PDF', 'success');
// }

// function toast(message, type = 'info') {
//     Toastify({
//         text: message,
//         duration: 3000,
//         gravity: "top",
//         position: "right",
//         backgroundColor: type === 'success' ? "#10B981" : type === 'error' ? "#EF4444" : "#3B82F6",
//     }).showToast();
// }

// document.addEventListener('DOMContentLoaded', () => {
//     console.log('%c[INIT] MyOrders Ready', 'color: #8B4513; font-weight: bold;');
//     fetchOrders();
// });

