/******************************************************************************************
 *  CAKES.JS - FINAL FIXED VERSION
 *  - REMOVED: initializeSlideshow()
 *  - FIXED: Search overlay not opening
 *  - SKELETON LOADER + ALL FEATURES PRESERVED
 ******************************************************************************************/

const API_BASE_URL = 'http://localhost:8082/api/v1';
const API_BASE_URL_IMG = 'http://localhost:8082';

// Global state
let productData = [];
let wishlistDetails = JSON.parse(localStorage.getItem('wishlistDetails')) || [];
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
 *  PRODUCT CARD
 ******************************************************************************************/
function createProductCard(product) {
    const isInWishlist = wishlistDetails.some(item => item.id === product.id);
    const imageUrl = product.image || `${API_BASE_URL_IMG}${product.productImageUrl || ''}`;
    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
    const discountPercent = hasDiscount 
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) 
        : 0;

    return `
        <div class="bg-white rounded-lg shadow-md overflow-hidden relative cursor-pointer hover:shadow-lg transition-all duration-300 product-card group" data-product-id="${product.id}">
            ${product.badge ? `
                <div class="absolute top-3 left-3 ${product.badge.color} text-white px-3 py-1 rounded-md text-sm font-medium z-10 shadow-md">
                    ${product.badge.text}
                </div>
            ` : ''}
            ${hasDiscount && !product.badge ? `
                <div class="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-md text-sm font-medium z-10 shadow-md">
                    ${discountPercent}% OFF
                </div>
            ` : ''}
            <button class="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md wishlist-btn z-10 transition-all duration-200 hover:scale-110 ${
                isInWishlist ? 'active text-red-500' : 'text-gray-400 hover:text-red-500'
            }" 
                   onclick="event.stopPropagation(); toggleWishlist(this, ${product.id})">
                <svg class="w-5 h-5" fill="${isInWishlist ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
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
                    ${hasDiscount ? `<span class="text-sm text-gray-500 line-through ml-2">₹${product.originalPrice.toLocaleString()}</span>` : ''}
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
                    ${product.deliveryTime ? `<div class="text-xs text-gray-500 flex items-center"><i class="fas fa-clock mr-1"></i>${product.deliveryTime}</div>` : ''}
                </div>
                <button onclick="handleProductClick(${product.id})" 
                        class="w-full bg-primary text-white py-3 rounded-lg hover:bg-secondary transition-all duration-200 font-medium">
                    View Details
                </button>
            </div>
        </div>
    `;
}

function getProductBadge(product) {
    if (product.productDiscount?.includes('% OFF')) return { text: product.productDiscount, color: 'bg-teal-700' };
    if (product.orderCount > 100) return { text: 'Best Seller', color: 'bg-teal-700' };
    if (product.ratings >= 4.5) return { text: 'Top Rated', color: 'bg-yellow-600' };
    return null;
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
                badge: getProductBadge(p),
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
            badge: getProductBadge(p),
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
    updateWishlistCount();
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

        // Sort
        document.getElementById('sort-filter')?.addEventListener('change', (e) => {
            currentSort = e.target.value;
            productData = sortProducts(productData, currentSort);
            renderProducts(getCurrentPageProducts());
        });

        // Category tabs
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

        // Show more
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
 *  WISHLIST & NOTIFICATION
 ******************************************************************************************/
function toggleWishlist(btn, id) {
    const product = productData.find(p => p.id === id);
    if (!product) return;

    const index = wishlistDetails.findIndex(item => item.id === id);
    if (index > -1) {
        wishlistDetails.splice(index, 1);
        btn.classList.remove('active', 'text-red-500');
        btn.classList.add('text-gray-400');
        showNotification('Removed from wishlist', 'success');
    } else {
        wishlistDetails.push({ id: product.id, name: product.name, price: product.price, image: product.image });
        btn.classList.add('active', 'text-red-500');
        btn.classList.remove('text-gray-400');
        showNotification('Added to wishlist', 'success');
    }
    localStorage.setItem('wishlistDetails', JSON.stringify(wishlistDetails));
    updateWishlistCount();
}

function updateWishlistCount() {
    const el = document.getElementById('wishlist-count');
    if (el) el.textContent = wishlistDetails.length;
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
 *  SEARCH OVERLAY - FULLY WORKING
 ******************************************************************************************/
function initializeSearch() {
    const searchToggle = document.getElementById('searchToggle');
    const searchOverlay = document.getElementById('searchOverlay');
    const closeSearch = document.getElementById('closeSearch');
    const searchInput = document.getElementById('searchInput');

    if (!searchToggle || !searchOverlay) return;

    searchToggle.addEventListener('click', (e) => {
        e.preventDefault();
        searchOverlay.classList.remove('hidden');
        setTimeout(() => searchInput.focus(), 100);
    });

    closeSearch.addEventListener('click', () => {
        searchOverlay.classList.add('hidden');
        searchInput.value = '';
    });

    searchOverlay.addEventListener('click', (e) => {
        if (e.target === searchOverlay) {
            searchOverlay.classList.add('hidden');
            searchInput.value = '';
        }
    });

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        const suggestions = document.getElementById('searchSuggestions');
        if (!query) {
            suggestions.innerHTML = '';
            return;
        }

        const matches = productData
            .filter(p => p.name.toLowerCase().includes(query) || p.subCategory?.toLowerCase().includes(query))
            .slice(0, 5);

        suggestions.innerHTML = matches.length > 0
            ? matches.map(p => `
                <div onclick="handleProductClick(${p.id})" class="p-3 hover:bg-gray-100 cursor-pointer border-b">
                    <div class="font-medium">${p.name}</div>
                    <div class="text-sm text-gray-500">₹${p.price} • ${p.subCategory || p.category}</div>
                </div>
              `).join('')
            : `<div class="p-3 text-gray-500">No products found</div>`;
    });
}

/******************************************************************************************
 *  OTHER MODALS
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

// Login
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
        ? `<a href="/profile.html" class="block  px-4 py-2 text-sm hover:bg-gray-100">My Profile</a>
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
    initializeSearch();           // SEARCH NOW WORKS
    updateWishlistCount();
    updateCartCount();
    populateDropdown();

    // Logout modal
    document.getElementById('modalCancel')?.addEventListener('click', hideLogoutModal);
    document.getElementById('modalConfirm')?.addEventListener('click', performLogout);
    document.getElementById('logoutModal')?.addEventListener('click', e => {
        if (e.target.id === 'logoutModal') hideLogoutModal();
    });
});

// Export
window.toggleWishlist = toggleWishlist;
window.handleProductClick = handleProductClick;
window.initializePage = initializePage;