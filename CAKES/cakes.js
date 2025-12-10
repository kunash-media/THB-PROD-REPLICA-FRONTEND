/******************************************************************************************
 *  ALLCAKES.JS - FINAL UPGRADED VERSION (2025) - BACKEND WISHLIST INTEGRATED
 *  1. Out of Stock badge replaces everything when stock = 0
 *  2. Real discount % calculated from productOldPrice vs productNewPrice
 *  3. Wishlist now fully uses backend (api-service.js) — no more localStorage
 ******************************************************************************************/

const API_BASE_URL = 'http://localhost:8082/api/v1';
const API_BASE_URL_IMG = 'http://localhost:8082';

// Global state
let productData = [];
let currentCategory = 'all';
let currentSort = 'default';
let currentPage = 0;
const PAGE_SIZE = 8;
let totalPages = 1;
let isLoading = false;

// Category map
const CATEGORY_MAP = {
    'all': 'All Cakes',
    'basic': 'Basic Cakes',
    'chocolate': 'Chocolate Cakes',
    'tea': 'Tea Time Cakes',
    'premium': 'Premium Cakes'
};

/******************************************************************************************
 *  NEW: Calculate real discount percentage
 ******************************************************************************************/
function calculateDiscountPercent(oldPrice, newPrice) {
    if (!oldPrice || oldPrice <= newPrice || oldPrice <= 0) return 0;
    return Math.round(((oldPrice - newPrice) / oldPrice) * 100);
}

/******************************************************************************************
 *  NEW: Dynamic badge with correct priority
 ******************************************************************************************/
function getDynamicBadge(product) {
    if (product.productQuantity === 0 || product.productQuantity < 1) {
        return { text: 'Out of Stock', color: 'bg-gray-600' };
    }

    const realDiscount = calculateDiscountPercent(product.productOldPrice, product.productNewPrice);
    if (realDiscount > 0) {
        return { text: `${realDiscount}% OFF`, color: 'bg-red-600' };
    }

    if (product.productDiscount && product.productDiscount.trim() !== '') {
        return { text: product.productDiscount, color: 'bg-teal-700' };
    }

    if (product.orderCount > 100) {
        return { text: 'Best Seller', color: 'bg-teal-700' };
    }

    if (product.ratings >= 4.5) {
        return { text: 'Top Rated', color: 'bg-yellow-600' };
    }

    return null;
}

/******************************************************************************************
 *  UTILITY
 ******************************************************************************************/
function normalizeCategory(label) {
    const key = String(label).trim().toLowerCase();
    return CATEGORY_MAP[key] || label;
}

/******************************************************************************************
 *  SKELETON LOADER
 ******************************************************************************************/
function injectSkeletonLoader() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = Array(8).fill('').map(() => `
        <div class="skeleton-card">
            <div class="skeleton-img"></div>
            <div class="p-6">
                <div class="skeleton-title"></div>
                <div class="skeleton-price"></div>
                <div class="skeleton-rating"></div>
                <div class="skeleton-btn"></div>
            </div>
        </div>
    `).join('');
}

function clearSkeletonLoader() {
    const grid = document.getElementById('product-grid');
    if (grid) grid.innerHTML = '';
}

function toggleShowMoreButton(show) {
    const container = document.getElementById('show-more-container');
    if (container) container.classList.toggle('hidden', !show);
}

/******************************************************************************************
 *  PRODUCT CARD — BACKEND WISHLIST READY
 ******************************************************************************************/
function createProductCard(product) {
    const imageUrl = product.image || `${API_BASE_URL_IMG}${product.productImageUrl || ''}`;
    const hasOldPrice = product.originalPrice && product.originalPrice > product.price;
    const badge = getDynamicBadge({
        productQuantity: product.productQuantity || 0,
        productOldPrice: product.originalPrice,
        productNewPrice: product.price,
        productDiscount: product.productDiscount,
        orderCount: product.orderCount || 0,
        ratings: product.rating || 0
    });

    return `
        <div class="bg-white rounded-lg shadow-md overflow-hidden relative cursor-pointer hover:shadow-lg transition-all duration-300 product-card group ${product.productQuantity === 0 ? 'opacity-70' : ''}" data-product-id="${product.id}">
            
            <!-- DYNAMIC BADGE -->
            ${badge ? `
                <div class="absolute top-3 left-3 ${badge.color} text-white px-3 py-1 rounded-md text-sm font-medium z-10 shadow-md">
                    ${badge.text}
                </div>
            ` : ''}

            <!-- Wishlist Button - Now uses backend -->
            <button class="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md wishlist-btn z-10 transition-all duration-200 hover:scale-110 text-gray-400 hover:text-red-500"
                    data-id="${product.id}"
                    data-type="PRODUCT"
                    onclick="toggleWishlist(this, ${product.id}, 'PRODUCT')">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" 
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z">
                    </path>
                </svg>
            </button>

            <div onclick="handleProductClick(${product.id})" class="relative overflow-hidden">
                <img src="${imageUrl}" alt="${product.name}" 
                     class="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
                     onerror="this.src='/IMG/placeholder-cake.jpg'" loading="lazy">
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300"></div>
            </div>

            <div class="p-6" onclick="handleProductClick(${product.id})">
                <h3 class="font-semibold text-gray-800 mb-1 text-lg line-clamp-2 hover:text-primary transition-colors cursor-pointer">
                    ${product.name}
                </h3>
                <p class="text-sm text-gray-500 mb-3">${product.subCategory || product.category}</p>
                <div class="flex items-center mb-3">
                    <span class="text-xl font-bold text-gray-900">₹${product.price.toLocaleString()}</span>
                    ${hasOldPrice ? `<span class="text-sm text-gray-500 line-through ml-2">₹${product.originalPrice.toLocaleString()}</span>` : ''}
                </div>
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center">
                        <div class="flex items-center bg-green-600 text-white px-2 py-1 rounded text-sm">
                            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            ${product.rating.toFixed(1)}
                        </div>
                        <span class="text-sm text-gray-600 ml-2">(${product.reviewCount})</span>
                    </div>
                    <div class="text-xs text-gray-500 flex items-center"><i class="fas fa-clock mr-1"></i>1 hrs</div>
                </div>
                <button onclick="handleProductClick(${product.id})" 
                        class="w-full ${product.productQuantity === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-secondary'} text-white py-3 rounded-lg transition-all duration-200 font-medium">
                    ${product.productQuantity === 0 ? 'Out of Stock' : 'View Details'}
                </button>
            </div>
        </div>
    `;
}

/******************************************************************************************
 *  FETCH FUNCTIONS
 ******************************************************************************************/
async function fetchAllProducts(page = 0) {
    try {
        const res = await fetch(`${API_BASE_URL}/products/category/Cakes?page=${page}&size=${PAGE_SIZE}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.data?.content) throw new Error('Invalid response');
        totalPages = data.data.totalPages || 1;
        return data.data.content
            .filter(p => p.productCategory === 'Cakes')
            .map(p => ({
                id: p.productId,
                name: p.productName,
                category: p.productCategory,
                subCategory: p.productSubCategory,
                price: p.productNewPrice,
                originalPrice: p.productOldPrice,
                rating: p.ratings || 4.0,
                reviewCount: p.reviews || 0,
                image: p.productImageUrl ? `${API_BASE_URL_IMG}${p.productImageUrl}` : null,
                productDiscount: p.productDiscount || '',
                productQuantity: p.productQuantity || 0,
                deliveryTime: p.deliveryTime || 'In 3 hours',
                orderCount: p.orderCount || 0
            }));
    } catch (err) {
        console.error(err);
        showNotification('Failed to load products.', 'error');
        return [];
    }
}

async function fetchProductsBySubCategory(subCat, page = 0) {
    try {
        const res = await fetch(`${API_BASE_URL}/products/sub-category/${encodeURIComponent(subCat)}?page=${page}&size=${PAGE_SIZE}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.data?.content) throw new Error('Invalid response');
        totalPages = data.data.totalPages || 1;
        return data.data.content.map(p => ({
            id: p.productId,
            name: p.productName,
            category: p.productCategory,
            subCategory: p.productSubCategory,
            price: p.productNewPrice,
            originalPrice: p.productOldPrice,
            rating: p.ratings || 4.0,
            reviewCount: p.reviews || 0,
            image: p.productImageUrl ? `${API_BASE_URL_IMG}${p.productImageUrl}` : null,
            productDiscount: p.productDiscount || '',
            productQuantity: p.productQuantity || 0,
            deliveryTime: p.deliveryTime || 'In 3 hours',
            orderCount: p.orderCount || 0
        }));
    } catch (err) {
        console.error(err);
        showNotification(`No products in ${subCat}`, 'error');
        return [];
    }
}

/******************************************************************************************
 *  RENDER & PAGINATION
 ******************************************************************************************/
function renderProducts(products = []) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    clearSkeletonLoader();

    if (products.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-12"><h3 class="text-xl">No cakes found</h3></div>`;
        toggleShowMoreButton(false);
        return;
    }

    grid.innerHTML = products.map(createProductCard).join('');
    markWishlistedItems(); // Re-apply active class after render
    toggleShowMoreButton(currentPage < totalPages - 1);
}

async function loadMoreProducts() {
    if (isLoading || currentPage >= totalPages - 1) return;
    isLoading = true;
    currentPage++;
    injectSkeletonLoader();

    let newProducts = currentCategory === 'all'
        ? await fetchAllProducts(currentPage)
        : await fetchProductsBySubCategory(normalizeCategory(currentCategory), currentPage);

    const sorted = sortProducts(newProducts, currentSort);
    productData = [...productData, ...sorted];
    renderProducts(getCurrentPageProducts());
    isLoading = false;
}

function getCurrentPageProducts() {
    const end = (currentPage + 1) * PAGE_SIZE;
    return productData.slice(0, end);
}

function sortProducts(products, type) {
    const sorted = [...products];
    switch(type) {
        case 'price-low': return sorted.sort((a,b) => a.price - b.price);
        case 'price-high': return sorted.sort((a,b) => b.price - a.price);
        case 'rating': return sorted.sort((a,b) => b.rating - a.rating);
        default: return sorted.sort((a,b) => a.id - b.id);
    }
}

/******************************************************************************************
 *  INITIALIZE PAGE
 ******************************************************************************************/
async function initializePage() {
    injectSkeletonLoader();
    try {
        productData = await fetchAllProducts(0);
        renderProducts(productData.slice(0, PAGE_SIZE));

        document.getElementById('sort-filter')?.addEventListener('change', (e) => {
            currentSort = e.target.value;
            productData = sortProducts(productData, currentSort);
            renderProducts(getCurrentPageProducts());
        });

        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelectorAll('.category-btn').forEach(b => {
                    b.classList.remove('bg-primary', 'text-white');
                    b.classList.add('bg-gray-200', 'text-gray-700', 'border', 'border-[#660B05]');
                });
                btn.classList.add('bg-primary', 'text-white');
                btn.classList.remove('bg-gray-200', 'text-gray-700', 'border');

                currentCategory = btn.dataset.category;
                currentPage = 0;
                injectSkeletonLoader();

                const fetched = currentCategory === 'all'
                    ? await fetchAllProducts(0)
                    : await fetchProductsBySubCategory(normalizeCategory(currentCategory), 0);

                productData = sortProducts(fetched, currentSort);
                renderProducts(getCurrentPageProducts());
            });
        });

        document.getElementById('show-more-btn')?.addEventListener('click', loadMoreProducts);

    } catch (err) {
        clearSkeletonLoader();
        document.getElementById('product-grid').innerHTML = `
            <div class="col-span-full text-center py-12">
                <button onclick="initializePage()" class="bg-primary text-white px-6 py-2 rounded-lg">Retry</button>
            </div>`;
    }
}

/******************************************************************************************
 *  BACKEND WISHLIST - FULLY CENTRALIZED
 ******************************************************************************************/
async function toggleWishlist(btn, productId, itemType = 'PRODUCT') {
    event.stopPropagation();

    if (!apiService.getUserId()) {
        // Old: alert + confirm
        // New: Beautiful Toastify with auto redirect
        showLoginToast();
        return;
    }

    const isActive = btn.classList.contains('active');

    try {
        if (isActive) {
            const wishlistItemId = btn.dataset.wid;
            if (wishlistItemId) {
                await apiService.removeFromWishlist(wishlistItemId, 'PRODUCT');
                btn.classList.remove('active');
                btn.dataset.wid = '';
                showToast('Removed from wishlist', 'success');
            }
        } else {
            await apiService.addToWishlist(productId, itemType);
            btn.classList.add('active');
            showToast('Added to wishlist', 'success');

            const list = await apiService.getWishlist();
            const item = list.find(i => i.productId == productId);
            if (item?.wishlistItemId) {
                btn.dataset.wid = item.wishlistItemId;
            }
        }
        await apiService.updateWishlistCount();
    } catch (err) {
        console.error('Wishlist error:', err);
        showToast('Failed to update wishlist', 'error');
    }
}

async function markWishlistedItems() {
    if (!window.apiService?.getUserId()) return;

    try {
        const wishlist = await window.apiService.getWishlist();

        // Clear all hearts first
        document.querySelectorAll('.wishlist-btn, .add-to-wishlist').forEach(btn => {
            btn.classList.remove('active');
            const icon = btn.querySelector('i') || btn.querySelector('svg');
            if (icon) {
                icon.classList.remove('fas', 'text-red-500');
                icon.classList.add('far');
                if (icon.tagName === 'svg') {
                    icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>';
                }
            }
            delete btn.dataset.wid;
        });

        // Mark correct ones
        wishlist.forEach(item => {
            let selector = '';
            if (item.itemType === 'CUSTOMIZE_CAKE' && item.customizeCakeId) {
                selector = `.wishlist-btn[data-id="${item.customizeCakeId}"][data-type="CUSTOMIZE_CAKE"]`;
            } else if (item.itemType === 'SNACK' && item.snackId) {
                selector = `.add-to-wishlist[data-id="${item.snackId}"][data-type="SNACK"]`;
            } else if (item.itemType === 'PRODUCT' && item.productId) {
                selector = `.wishlist-btn[data-id="${item.productId}"][data-type="PRODUCT"]`;
            }

            const btn = document.querySelector(selector);
            if (btn) {
                btn.classList.add('active');
                const icon = btn.querySelector('i') || btn.querySelector('svg');
                if (icon) {
                    icon.classList.remove('far');
                    icon.classList.add('fas', 'text-red-500');
                    if (icon.tagName === 'svg') {
                        icon.innerHTML = '<path fill="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>';
                    }
                }
                btn.dataset.wid = item.productId;
            }
        });

        await window.apiService.updateWishlistCount();
    } catch (err) {
        console.warn('Wishlist refresh failed', err);
    }
}


// ==================== TOASTIFY NOTIFICATION SYSTEM (CENTERED & BEAUTIFUL) ====================

function showToast(message, type = 'success') {
    let background = '#10b981'; // green
    let icon = 'Success';

    if (type === 'error') {
        background = '#ef4444';
        icon = 'Error';
    } else if (type === 'warning') {
        background = '#f59e0b';
        icon = 'Warning';
    } else if (type === 'info') {
        background = '#3b82f6';
        icon = 'Info';
    }

    Toastify({
        text: `${icon} ${message}`,
        duration: 3000,
        close: true,
        gravity: "center",      // top, bottom, center
        position: "center",     // left, center, right
        stopOnFocus: true,
        style: {
            background: background,
            borderRadius: "12px",
            padding: "16px 24px",
            fontSize: "16px",
            fontWeight: "bold 16px Arial, sans-serif",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            textAlign: "center"
        },
        onClick: function(){}
    }).showToast();
}

// Special for login required
function showLoginToast() {
    Toastify({
        text: "Please login to add to wishlist",
        duration: 4000,
        close: true,
        gravity: "center",
        position: "center",
        style: {
            background: "#8b5cf6",
            borderRadius: "12px",
            padding: "18px 30px",
            fontSize: "17px",
            fontWeight: "bold",
            boxShadow: "0 10px 30px rgba(139, 92, 246, 0.4)",
        },
        callback: function() {
            window.location.href = '/login.html';
        }
    }).showToast();
}

function showNotification(msg, type = 'success') {
    const existing = document.querySelectorAll('.custom-notification');
    existing.forEach(n => n.remove());

    const div = document.createElement('div');
    div.className = `custom-notification fixed top-4 right-4 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white px-6 py-3 rounded-md shadow-lg z-50`;
    div.innerHTML = `<div class="flex items-center justify-between"><span>${msg}</span><button onclick="this.parentElement.parentElement.remove()" class="ml-4">×</button></div>`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

function handleProductClick(id) {
    const p = productData.find(x => x.id === id);
    if (p) sessionStorage.setItem('selectedProduct', JSON.stringify(p));
    window.location.href = `../product-details.html?id=${id}`;
}

/******************************************************************************************
 *  OTHER MODALS & UI
 ******************************************************************************************/
function initializeDeliveryModal() {
    const modal = document.getElementById('deliveryModal');
    const btn = document.getElementById('deliveryLocationBtn');
    const close = document.getElementById('closeModal');
    const confirm = document.getElementById('confirmLocation');
    const input = document.getElementById('locationInput');

    if (!modal || !btn) return;

    btn.addEventListener('click', () => modal.classList.remove('hidden'));
    close.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

    document.querySelectorAll('.location-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const loc = opt.textContent.trim();
            document.getElementById('selectedLocation').textContent = loc;
            modal.classList.add('hidden');
            showNotification(`Delivering to ${loc}`, 'success');
        });
    });

    input.addEventListener('input', () => confirm.disabled = input.value.trim().length < 3);
    confirm.addEventListener('click', () => {
        const loc = input.value.trim();
        if (loc) {
            document.getElementById('selectedLocation').textContent = loc;
            modal.classList.add('hidden');
            showNotification(`Delivering to ${loc}`, 'success');
        }
    });
}

function initializeMobileMenu() {
    const toggle = document.getElementById('menuToggle');
    const nav = document.getElementById('navLinks');
    const cakesToggle = document.getElementById('mobileCakesToggle');
    const cakesMenu = document.getElementById('mobileCakesMenu');

    if (toggle && nav) {
        toggle.addEventListener('click', () => nav.classList.toggle('hidden'));
    }
    if (cakesToggle && cakesMenu) {
        cakesToggle.addEventListener('click', () => {
            cakesMenu.classList.toggle('hidden');
            cakesToggle.querySelector('i').classList.toggle('rotate-180');
        });
    }
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const total = cart.reduce((sum, i) => sum + i.quantity, 0);
    const el = document.getElementById('cart-count');
    if (el) el.textContent = total;
}

function isLoggedIn() {
    const s = localStorage.getItem('userSession');
    if (!s) return false;
    try {
        const { expiry } = JSON.parse(s);
        return Date.now() < expiry;
    } catch { localStorage.removeItem('userSession'); return false; }
}

function populateDropdown() {
    const dropdowns = document.querySelectorAll('.dropdown-content');
    const html = isLoggedIn()
        ? `<a href="/profile.html" class="block px-4 py-2 text-sm hover:bg-gray-100">My Profile</a>
           <a href="#" onclick="showLogoutModal(); return false;" class="block px-4 py-2 text-sm hover:bg-gray-100">Logout</a>`
        : `<a href="/login.html" class="block px-4 py-2 text-sm hover:bg-gray-100">Login/Signup</a>`;
    dropdowns.forEach(d => d.innerHTML = html);
}

function showLogoutModal() { document.getElementById('logoutModal')?.classList.remove('hidden'); }
function hideLogoutModal() { document.getElementById('logoutModal')?.classList.add('hidden'); }
function performLogout() {
    localStorage.removeItem('userSession');
    populateDropdown();
    hideLogoutModal();
    showNotification('Logged out', 'success');
}

/******************************************************************************************
 *  DOM READY
 ******************************************************************************************/
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    initializeDeliveryModal();
    initializeMobileMenu();
    updateCartCount();
    populateDropdown();
    markWishlistedItems(); // This will mark hearts red after login

    document.getElementById('modalCancel')?.addEventListener('click', hideLogoutModal);
    document.getElementById('modalConfirm')?.addEventListener('click', performLogout);
    document.getElementById('logoutModal')?.addEventListener('click', e => {
        if (e.target.id === 'logoutModal') hideLogoutModal();
    });
});

// Export functions
window.toggleWishlist = toggleWishlist;
window.handleProductClick = handleProductClick;
window.initializePage = initializePage;



























// /******************************************************************************************
//  *  ALLCAKES.JS - FINAL UPGRADED VERSION (2025)
//  *  1. Out of Stock badge replaces everything when stock = 0
//  *  2. Real discount % calculated from productOldPrice vs productNewPrice
//  *  3. All existing features 100% preserved & working
//  ******************************************************************************************/

// const API_BASE_URL = 'http://localhost:8082/api/v1';
// const API_BASE_URL_IMG = 'http://localhost:8082';

// // Global state
// let productData = [];
// // let allProductsForSearch = [];  //NEW   //modified
// let wishlistDetails = JSON.parse(localStorage.getItem('wishlistDetails')) || [];
// let currentCategory = 'all';
// let currentSort = 'default';
// let currentPage = 0;
// const PAGE_SIZE = 8;
// let totalPages = 1;
// let isLoading = false;

// // Category map
// const CATEGORY_MAP = {
//     'all': 'All Cakes',
//     'basic': 'Basic Cakes',
//     'chocolate': 'Chocolate Cakes',
//     'tea': 'Tea Time Cakes',
//     'premium': 'Premium Cakes'
// };

// /******************************************************************************************
//  *  NEW: Calculate real discount percentage
//  ******************************************************************************************/
// function calculateDiscountPercent(oldPrice, newPrice) {
//     if (!oldPrice || oldPrice <= newPrice || oldPrice <= 0) return 0;
//     return Math.round(((oldPrice - newPrice) / oldPrice) * 100);
// }

// /******************************************************************************************
//  *  NEW: Dynamic badge with correct priority
//  ******************************************************************************************/
// function getDynamicBadge(product) {
//     // 1. OUT OF STOCK — HIGHEST PRIORITY
//     if (product.productQuantity === 0 || product.productQuantity < 1) {
//         return { text: 'Out of Stock', color: 'bg-gray-600' };
//     }

//     // 2. REAL DISCOUNT from old vs new price
//     const realDiscount = calculateDiscountPercent(product.productOldPrice, product.productNewPrice);
//     if (realDiscount > 0) {
//         return { text: `${realDiscount}% OFF`, color: 'bg-red-600' };
//     }

//     // 3. Manual backend badge
//     if (product.productDiscount && product.productDiscount.trim() !== '') {
//         return { text: product.productDiscount, color: 'bg-teal-700' };
//     }

//     // 4. Best Seller
//     if (product.orderCount > 100) {
//         return { text: 'Best Seller', color: 'bg-teal-700' };
//     }

//     // 5. Top Rated
//     if (product.ratings >= 4.5) {
//         return { text: 'Top Rated', color: 'bg-yellow-600' };
//     }

//     return null;
// }

// /******************************************************************************************
//  *  UTILITY
//  ******************************************************************************************/
// function normalizeCategory(label) {
//     const key = String(label).trim().toLowerCase();
//     return CATEGORY_MAP[key] || label;
// }

// /******************************************************************************************
//  *  SKELETON LOADER
//  ******************************************************************************************/
// function injectSkeletonLoader() {
//     const grid = document.getElementById('product-grid');
//     if (!grid) return;

//     grid.innerHTML = Array(8).fill('').map(() => `
//         <div class="skeleton-card">
//             <div class="skeleton-img"></div>
//             <div class="p-6">
//                 <div class="skeleton-title"></div>
//                 <div class="skeleton-price"></div>
//                 <div class="skeleton-rating"></div>
//                 <div class="skeleton-btn"></div>
//             </div>
//         </div>
//     `).join('');
// }

// function clearSkeletonLoader() {
//     const grid = document.getElementById('product-grid');
//     if (grid) grid.innerHTML = '';
// }

// function toggleShowMoreButton(show) {
//     const container = document.getElementById('show-more-container');
//     if (container) container.classList.toggle('hidden', !show);
// }

// /******************************************************************************************
//  *  PRODUCT CARD — FULLY UPGRADED
//  ******************************************************************************************/
// function createProductCard(product) {
//     const isInWishlist = wishlistDetails.some(item => item.id === product.id);
//     const imageUrl = product.image || `${API_BASE_URL_IMG}${product.productImageUrl || ''}`;
//     const hasOldPrice = product.originalPrice && product.originalPrice > product.price;
//     const badge = getDynamicBadge({
//         productQuantity: product.productQuantity || 0,
//         productOldPrice: product.originalPrice,
//         productNewPrice: product.price,
//         productDiscount: product.productDiscount,
//         orderCount: product.orderCount || 0,
//         ratings: product.rating || 0
//     });

//     return `
//         <div class="bg-white rounded-lg shadow-md overflow-hidden relative cursor-pointer hover:shadow-lg transition-all duration-300 product-card group ${product.productQuantity === 0 ? 'opacity-70' : ''}" data-product-id="${product.id}">
            
//             <!-- DYNAMIC BADGE -->
//             ${badge ? `
//                 <div class="absolute top-3 left-3 ${badge.color} text-white px-3 py-1 rounded-md text-sm font-medium z-10 shadow-md">
//                     ${badge.text}
//                 </div>
//             ` : ''}

//             <!-- Wishlist Button -->
//             <button class="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md wishlist-btn z-10 transition-all duration-200 hover:scale-110 ${
//                 isInWishlist ? 'active text-red-500' : 'text-gray-400 hover:text-red-500'
//             }" 
//                    onclick="event.stopPropagation(); toggleWishlist(this, ${product.id})">
//                 <svg class="w-5 h-5" fill="${isInWishlist ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
//                     <path stroke-linecap="round" stroke-linejoin="round" 
//                           d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z">
//                     </path>
//                 </svg>
//             </button>

//             <div onclick="handleProductClick(${product.id})" class="relative overflow-hidden">
//                 <img src="${imageUrl}" alt="${product.name}" 
//                      class="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
//                      onerror="this.src='/IMG/placeholder-cake.jpg'" loading="lazy">
//                 <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300"></div>
//             </div>

//             <div class="p-6" onclick="handleProductClick(${product.id})">
//                 <h3 class="font-semibold text-gray-800 mb-1 text-lg line-clamp-2 hover:text-primary transition-colors cursor-pointer">
//                     ${product.name}
//                 </h3>
//                 <p class="text-sm text-gray-500 mb-3">${product.subCategory || product.category}</p>
//                 <div class="flex items-center mb-3">
//                     <span class="text-xl font-bold text-gray-900">₹${product.price.toLocaleString()}</span>
//                     ${hasOldPrice ? `<span class="text-sm text-gray-500 line-through ml-2">₹${product.originalPrice.toLocaleString()}</span>` : ''}
//                 </div>
//                 <div class="flex items-center justify-between mb-4">
//                     <div class="flex items-center">
//                         <div class="flex items-center bg-green-600 text-white px-2 py-1 rounded text-sm">
//                             <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
//                                 <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
//                             </svg>
//                             ${product.rating.toFixed(1)}
//                         </div>
//                         <span class="text-sm text-gray-600 ml-2">(${product.reviewCount})</span>
//                     </div>
//                    <div class="text-xs text-gray-500 flex items-center"><i class="fas fa-clock mr-1"></i>1 hrs</div>
//                 </div>
//                 <button onclick="handleProductClick(${product.id})" 
//                         class="w-full ${product.productQuantity === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-secondary'} text-white py-3 rounded-lg transition-all duration-200 font-medium">
//                     ${product.productQuantity === 0 ? 'Out of Stock' : 'View Details'}
//                 </button>
//             </div>
//         </div>
//     `;
// }

// /******************************************************************************************
//  *  FETCH FUNCTIONS — NOW INCLUDE productQuantity & productDiscount
//  ******************************************************************************************/
// async function fetchAllProducts(page = 0) {
//     try {
//         const res = await fetch(`${API_BASE_URL}/products/category/Cakes?page=${page}&size=${PAGE_SIZE}`);
//         if (!res.ok) throw new Error(`HTTP ${res.status}`);
//         const data = await res.json();
//         if (!data.data?.content) throw new Error('Invalid response');
//         totalPages = data.data.totalPages || 1;
//         return data.data.content
//             .filter(p => p.productCategory === 'Cakes')
//             .map(p => ({
//                 id: p.productId,
//                 name: p.productName,
//                 category: p.productCategory,
//                 subCategory: p.productSubCategory,
//                 price: p.productNewPrice,
//                 originalPrice: p.productOldPrice,
//                 rating: p.ratings || 4.0,
//                 reviewCount: p.reviews || 0,
//                 image: p.productImageUrl ? `${API_BASE_URL_IMG}${p.productImageUrl}` : null,
//                 productDiscount: p.productDiscount || '',
//                 productQuantity: p.productQuantity || 0,
//                 deliveryTime: p.deliveryTime || 'In 3 hours',
//                 orderCount: p.orderCount || 0
//             }));
//     } catch (err) {
//         console.error(err);
//         showNotification('Failed to load products.', 'error');
//         return [];
//     }
// }

// async function fetchProductsBySubCategory(subCat, page = 0) {
//     try {
//         const res = await fetch(`${API_BASE_URL}/products/sub-category/${encodeURIComponent(subCat)}?page=${page}&size=${PAGE_SIZE}`);
//         if (!res.ok) throw new Error(`HTTP ${res.status}`);
//         const data = await res.json();
//         if (!data.data?.content) throw new Error('Invalid response');
//         totalPages = data.data.totalPages || 1;
//         return data.data.content.map(p => ({
//             id: p.productId,
//             name: p.productName,
//             category: p.productCategory,
//             subCategory: p.productSubCategory,
//             price: p.productNewPrice,
//             originalPrice: p.productOldPrice,
//             rating: p.ratings || 4.0,
//             reviewCount: p.reviews || 0,
//             image: p.productImageUrl ? `${API_BASE_URL_IMG}${p.productImageUrl}` : null,
//             productDiscount: p.productDiscount || '',
//             productQuantity: p.productQuantity || 0,
//             deliveryTime: p.deliveryTime || 'In 3 hours',
//             orderCount: p.orderCount || 0
//         }));
//     } catch (err) {
//         console.error(err);
//         showNotification(`No products in ${subCat}`, 'error');
//         return [];
//     }
// }


// /******************************************************************************************
//  *  RENDER & PAGINATION
//  ******************************************************************************************/
// function renderProducts(products = []) {
//     const grid = document.getElementById('product-grid');
//     if (!grid) return;
//     clearSkeletonLoader();

//     if (products.length === 0) {
//         grid.innerHTML = `<div class="col-span-full text-center py-12"><h3 class="text-xl">No cakes found</h3></div>`;
//         toggleShowMoreButton(false);
//         return;
//     }

//     grid.innerHTML = products.map(createProductCard).join('');
//     updateWishlistCount();
//     toggleShowMoreButton(currentPage < totalPages - 1);
// }

// async function loadMoreProducts() {
//     if (isLoading || currentPage >= totalPages - 1) return;
//     isLoading = true;
//     currentPage++;
//     injectSkeletonLoader();

//     let newProducts = currentCategory === 'all'
//         ? await fetchAllProducts(currentPage)
//         : await fetchProductsBySubCategory(normalizeCategory(currentCategory), currentPage);

//     const sorted = sortProducts(newProducts, currentSort);
//     productData = [...productData, ...sorted];
//     renderProducts(getCurrentPageProducts());
//     isLoading = false;
// }

// function getCurrentPageProducts() {
//     const end = (currentPage + 1) * PAGE_SIZE;
//     return productData.slice(0, end);
// }

// function sortProducts(products, type) {
//     const sorted = [...products];
//     switch(type) {
//         case 'price-low': return sorted.sort((a,b) => a.price - b.price);
//         case 'price-high': return sorted.sort((a,b) => b.price - a.price);
//         case 'rating': return sorted.sort((a,b) => b.rating - a.rating);
//         default: return sorted.sort((a,b) => a.id - b.id);
//     }
// }

// /******************************************************************************************
//  *  INITIALIZE PAGE
//  ******************************************************************************************/
// async function initializePage() {
//     injectSkeletonLoader();
//     try {
//         productData = await fetchAllProducts(0);
//         renderProducts(productData.slice(0, PAGE_SIZE));

//         document.getElementById('sort-filter')?.addEventListener('change', (e) => {
//             currentSort = e.target.value;
//             productData = sortProducts(productData, currentSort);
//             renderProducts(getCurrentPageProducts());
//         });

//         document.querySelectorAll('.category-btn').forEach(btn => {
//             btn.addEventListener('click', async () => {
//                 document.querySelectorAll('.category-btn').forEach(b => {
//                     b.classList.remove('bg-primary', 'text-white');
//                     b.classList.add('bg-gray-200', 'text-gray-700', 'border', 'border-[#660B05]');
//                 });
//                 btn.classList.add('bg-primary', 'text-white');
//                 btn.classList.remove('bg-gray-200', 'text-gray-700', 'border');

//                 currentCategory = btn.dataset.category;
//                 currentPage = 0;
//                 injectSkeletonLoader();

//                 const fetched = currentCategory === 'all'
//                     ? await fetchAllProducts(0)
//                     : await fetchProductsBySubCategory(normalizeCategory(currentCategory), 0);

//                 productData = sortProducts(fetched, currentSort);
//                 renderProducts(getCurrentPageProducts());
//             });
//         });

//         document.getElementById('show-more-btn')?.addEventListener('click', loadMoreProducts);

//     } catch (err) {
//         clearSkeletonLoader();
//         document.getElementById('product-grid').innerHTML = `
//             <div class="col-span-full text-center py-12">
//                 <button onclick="initializePage()" class="bg-primary text-white px-6 py-2 rounded-lg">Retry</button>
//             </div>`;
//     }
// }

// /******************************************************************************************
//  *  WISHLIST & NOTIFICATION
//  ******************************************************************************************/
// function toggleWishlist(btn, id) {
//     const product = productData.find(p => p.id === id);
//     if (!product) return;

//     const index = wishlistDetails.findIndex(item => item.id === id);
//     if (index > -1) {
//         wishlistDetails.splice(index, 1);
//         btn.classList.remove('active', 'text-red-500');
//         btn.classList.add('text-gray-400');
//         showNotification('Removed from wishlist', 'success');
//     } else {
//         wishlistDetails.push({ id: product.id, name: product.name, price: product.price, image: product.image });
//         btn.classList.add('active', 'text-red-500');
//         btn.classList.remove('text-gray-400');
//         showNotification('Added to wishlist', 'success');
//     }
//     localStorage.setItem('wishlistDetails', JSON.stringify(wishlistDetails));
//     updateWishlistCount();
// }

// function updateWishlistCount() {
//     const el = document.getElementById('wishlist-count');
//     if (el) el.textContent = wishlistDetails.length;
// }

// function showNotification(msg, type = 'success') {
//     const existing = document.querySelectorAll('.custom-notification');
//     existing.forEach(n => n.remove());

//     const div = document.createElement('div');
//     div.className = `custom-notification fixed top-4 right-4 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white px-6 py-3 rounded-md shadow-lg z-50`;
//     div.innerHTML = `<div class="flex items-center justify-between"><span>${msg}</span><button onclick="this.parentElement.parentElement.remove()" class="ml-4">×</button></div>`;
//     document.body.appendChild(div);
//     setTimeout(() => div.remove(), 3000);
// }

// function handleProductClick(id) {
//     const p = productData.find(x => x.id === id);
//     if (p) sessionStorage.setItem('selectedProduct', JSON.stringify(p));
//     window.location.href = `../product-details.html?id=${id}`;
// }







// /******************************************************************************************
//  *  OTHER MODALS & UI
//  ******************************************************************************************/
// function initializeDeliveryModal() {
//     const modal = document.getElementById('deliveryModal');
//     const btn = document.getElementById('deliveryLocationBtn');
//     const close = document.getElementById('closeModal');
//     const confirm = document.getElementById('confirmLocation');
//     const input = document.getElementById('locationInput');

//     if (!modal || !btn) return;

//     btn.addEventListener('click', () => modal.classList.remove('hidden'));
//     close.addEventListener('click', () => modal.classList.add('hidden'));
//     modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

//     document.querySelectorAll('.location-option').forEach(opt => {
//         opt.addEventListener('click', () => {
//             const loc = opt.textContent.trim();
//             document.getElementById('selectedLocation').textContent = loc;
//             modal.classList.add('hidden');
//             showNotification(`Delivering to ${loc}`, 'success');
//         });
//     });

//     input.addEventListener('input', () => confirm.disabled = input.value.trim().length < 3);
//     confirm.addEventListener('click', () => {
//         const loc = input.value.trim();
//         if (loc) {
//             document.getElementById('selectedLocation').textContent = loc;
//             modal.classList.add('hidden');
//             showNotification(`Delivering to ${loc}`, 'success');
//         }
//     });
// }




// function initializeMobileMenu() {
//     const toggle = document.getElementById('menuToggle');
//     const nav = document.getElementById('navLinks');
//     const cakesToggle = document.getElementById('mobileCakesToggle');
//     const cakesMenu = document.getElementById('mobileCakesMenu');

//     if (toggle && nav) {
//         toggle.addEventListener('click', () => nav.classList.toggle('hidden'));
//     }
//     if (cakesToggle && cakesMenu) {
//         cakesToggle.addEventListener('click', () => {
//             cakesMenu.classList.toggle('hidden');
//             cakesToggle.querySelector('i').classList.toggle('rotate-180');
//         });
//     }
// }

// function updateCartCount() {
//     const cart = JSON.parse(localStorage.getItem('cart') || '[]');
//     const total = cart.reduce((sum, i) => sum + i.quantity, 0);
//     const el = document.getElementById('cart-count');
//     if (el) el.textContent = total;
// }

// function isLoggedIn() {
//     const s = localStorage.getItem('userSession');
//     if (!s) return false;
//     try {
//         const { expiry } = JSON.parse(s);
//         return Date.now() < expiry;
//     } catch { localStorage.removeItem('userSession'); return false; }
// }

// function populateDropdown() {
//     const dropdowns = document.querySelectorAll('.dropdown-content');
//     const html = isLoggedIn()
//         ? `<a href="/profile.html" class="block px-4 py-2 text-sm hover:bg-gray-100">My Profile</a>
//            <a href="#" onclick="showLogoutModal(); return false;" class="block px-4 py-2 text-sm hover:bg-gray-100">Logout</a>`
//         : `<a href="/login.html" class="block px-4 py-2 text-sm hover:bg-gray-100">Login/Signup</a>`;
//     dropdowns.forEach(d => d.innerHTML = html);
// }

// function showLogoutModal() { document.getElementById('logoutModal')?.classList.remove('hidden'); }
// function hideLogoutModal() { document.getElementById('logoutModal')?.classList.add('hidden'); }
// function performLogout() {
//     localStorage.removeItem('userSession');
//     populateDropdown();
//     hideLogoutModal();
//     showNotification('Logged out', 'success');
// }

// /******************************************************************************************
//  *  DOM READY
//  ******************************************************************************************/
// document.addEventListener('DOMContentLoaded', () => {
//     initializePage();
//     initializeDeliveryModal();
//     initializeMobileMenu();
//     // initializeSearch();  //modified
//     updateWishlistCount();
//     updateCartCount();
//     populateDropdown();
//     // loadAllProductsForSearch(); // Preload in background for faster future searches

//     document.getElementById('modalCancel')?.addEventListener('click', hideLogoutModal);
//     document.getElementById('modalConfirm')?.addEventListener('click', performLogout);
//     document.getElementById('logoutModal')?.addEventListener('click', e => {
//         if (e.target.id === 'logoutModal') hideLogoutModal();
//     });
// });

// // Export functions
// window.toggleWishlist = toggleWishlist;
// window.handleProductClick = handleProductClick;
// window.initializePage = initializePage;