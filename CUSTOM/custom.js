/* ==================== custom.js – FINAL UPGRADED VERSION (2025) – FULL CODE ==================== */
document.addEventListener("DOMContentLoaded", function () {
    /* ------------------------------------------------------------------ */
    /* 1. NAVIGATION: MOBILE MENU, SEARCH, PROFILE DROPDOWN, LOGOUT MODAL */
    /* ------------------------------------------------------------------ */
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    const searchToggle = document.getElementById('searchToggle');
    const searchOverlay = document.getElementById('searchOverlay');
    const closeSearch = document.getElementById('closeSearch');
    const searchInput = document.getElementById('searchInput');
    const searchSuggestions = document.getElementById('searchSuggestions');
    const logoutModal = document.getElementById('logoutModal');
    const modalCancel = document.getElementById('modalCancel');
    const modalConfirm = document.getElementById('modalConfirm');

    // Close mobile menu on resize to desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024 && !navLinks.classList.contains('hidden')) {
            navLinks.classList.classList.add('hidden');
            const icon = menuToggle.querySelector('i');
            if (icon) icon.classList.replace('fa-times', 'fa-bars');
        }
    });

    // Search overlay
    if (searchToggle && searchOverlay && searchInput && searchSuggestions) {
        const showSearchOverlay = () => {
            searchOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            setTimeout(() => {
                const modal = searchOverlay.querySelector('.scale-95');
                if (modal) modal.classList.add('scale-100');
            }, 10);
            searchInput.focus();
            performSearch('');
        };
        const hideSearchOverlay = () => {
            const modal = searchOverlay.querySelector('.scale-100');
            if (modal) modal.classList.remove('scale-100');
            setTimeout(() => {
                searchOverlay.classList.add('hidden');
                document.body.style.overflow = '';
                searchSuggestions.innerHTML = '';
            }, 300);
        };
        searchToggle.addEventListener('click', (e) => {
            e.preventDefault();
            showSearchOverlay();
        });
        if (closeSearch) closeSearch.addEventListener('click', hideSearchOverlay);
        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) hideSearchOverlay();
        });
        searchInput.addEventListener('input', (e) => performSearch(e.target.value));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideSearchOverlay();
        });
    }

    // Profile dropdown & logout
    function isLoggedIn() {
        const session = localStorage.getItem('userSession');
        if (!session) return false;
        try {
            const { expiry } = JSON.parse(session);
            return Date.now() < expiry;
        } catch {
            localStorage.removeItem('userSession');
            return false;
        }
    }

    function populateDropdown() {
        const dropdowns = document.querySelectorAll('.dropdown-content');
        const content = isLoggedIn()
            ? `
                <a href="/profile.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">My Profile</a>
                <a href="#" onclick="showLogoutModal(); return false;" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Logout</a>
              `
            : `
                <a href="/login.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Login/Signup</a>
              `;
        dropdowns.forEach(d => d.innerHTML = content);
    }

    window.showLogoutModal = () => logoutModal?.classList.remove('hidden');
    window.hideLogoutModal = () => logoutModal?.classList.add('hidden');

    if (modalCancel) modalCancel.addEventListener('click', hideLogoutModal);
    if (modalConfirm) modalConfirm.addEventListener('click', () => {
        localStorage.removeItem('userSession');
        populateDropdown();
        hideLogoutModal();
        showToast('Logged out successfully', 'success');
    });

    populateDropdown();

    /* ------------------------------------------------------------------ */
    /* 2. TOASTIFY NOTIFICATION (CENTERED & BEAUTIFUL) */
    /* ------------------------------------------------------------------ */
    function showToast(message, type = 'success') {
        let background = '#10b981'; // green
        if (type === 'error') background = '#ef4444';
        if (type === 'warning') background = '#f59e0b';

        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "center",
            position: "center",
            stopOnFocus: true,
            style: {
                background: background,
                borderRadius: "16px",
                padding: "18px 30px",
                fontSize: "17px",
                fontWeight: "bold",
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }
        }).showToast();
    }

    /* ------------------------------------------------------------------ */
    /* 3. API & PRODUCT LOGIC */
    /* ------------------------------------------------------------------ */
    const API_BASE_URL = 'http://localhost:8082/api/customize-cakes';
    const WHATSAPP_NUMBER = '9537999898';
    let productData = [];
    let currentCategory = 'all';

    class BakeryAPI {
        static async getAllProducts() {
            try {
                const response = await fetch(`${API_BASE_URL}`);
                const result = await response.json();
                return result.success ? result.data : [];
            } catch (error) {
                console.error('Failed to fetch products:', error);
                return [];
            }
        }
    }

    function transformApiProduct(apiProduct) {
        return {
            id: apiProduct.id,
            name: apiProduct.title,
            price: apiProduct.newPrices && apiProduct.newPrices.length > 0 ? apiProduct.newPrices[0] : 0,
            originalPrice: apiProduct.oldPrices && apiProduct.oldPrices.length > 0 ? apiProduct.oldPrices[0] : null,
            category: apiProduct.category ? apiProduct.category.toLowerCase().replace(/\s+/g, '-') : 'custom',
            image: apiProduct.imageUrl ? `http://localhost:8082${apiProduct.imageUrl}` : 'IMAGES/placeholder.jpg',
            weights: apiProduct.weights || ['0.5 kg', '1 kg', '2 kg', '3 kg', '4 kg'],
            oldPrices: apiProduct.oldPrices || [],
            newPrices: apiProduct.newPrices || [],
            discount: apiProduct.discount || 0,
            isActive: apiProduct.isActive !== false
        };
    }

    function calculateDiscountPercentage(originalPrice, sellingPrice) {
        if (!originalPrice || originalPrice <= sellingPrice) return 0;
        return Math.round(((originalPrice - sellingPrice) / originalPrice) * 100);
    }

    /* ------------------------------------------------------------------ */
    /* 4. RENDER PRODUCTS – PEHLE DEFINE KIYA HAI (NO ERROR) */
    /* ------------------------------------------------------------------ */
    function renderProducts(products) {
        const grid = document.getElementById('product-grid');
        if (!grid) {
            console.error('Product grid element not found');
            return;
        }

        if (products.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-gray-500 text-lg">No products found</p>
                    <p class="text-gray-400 mt-2">Try selecting a different category</p>
                </div>
            `;
            return;
        }

        const cardsHTML = products.map(product => createProductCard(product)).join('');
        grid.innerHTML = cardsHTML;
        markWishlistedItems(); // Heart red after render
    }

    function createProductCard(product) {
        const discountPercent = calculateDiscountPercentage(product.originalPrice, product.price);
        const weightOptions = ['0.5 kg', '1 kg', '2 kg', '3 kg', '4 kg'];

        return `
            <div class="bg-white rounded-lg shadow-md overflow-hidden relative hover:shadow-lg transition-shadow duration-300 product-card" data-product-id="${product.id}">
                ${discountPercent > 0 ? `
                    <div class="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold z-10">
                        ${discountPercent}% OFF
                    </div>
                ` : ''}
                <button class="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md wishlist-btn z-10"
                        data-id="${product.id}"
                        data-type="CUSTOMIZE_CAKE"
                        onclick="event.stopPropagation(); toggleWishlist(this, ${product.id})">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z">
                        </path>
                    </svg>
                </button>
                <div class="cursor-pointer" onclick="handleProductClick(${product.id})">
                    <img src="${product.image}" alt="${product.name}" class="w-full h-64 object-cover">
                </div>
                <div class="p-6">
                    <h3 class="font-semibold text-gray-800 mb-3 text-lg line-clamp-2 cursor-pointer" onclick="handleProductClick(${product.id})">${product.name}</h3>
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center">
                            <span class="text-xl font-bold text-gray-900 product-price">₹ ${product.price}</span>
                            ${product.originalPrice ? `
                                <span class="text-sm text-gray-500 line-through ml-2 product-original-price">₹ ${product.originalPrice}</span>
                            ` : ''}
                        </div>
                        <div class="relative">
                            <select class="weight-selector border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    onchange="updateProductPrice(this, ${product.id})">
                                ${weightOptions.map((weight, index) => `
                                    <option value="${weight}" ${index === 0 ? 'selected' : ''}>${weight}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="orderOnWhatsApp('${JSON.stringify(product).replace(/"/g, '&quot;')}', event)"
                                class="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 whatsapp-btn text-sm">
                            WhatsApp
                        </button>
                        <button onclick="openModal()"
                                class="flex-1 bg-primary hover:bg-secondary text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1 customize-btn text-sm">
                            Customise
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function updateProductPrice(selectElement, productId) {
        const selectedWeight = selectElement.value;
        const productCard = selectElement.closest('.product-card');
        const priceElement = productCard.querySelector('.product-price');
        const originalPriceElement = productCard.querySelector('.product-original-price');
        const discountBadge = productCard.querySelector('.bg-red-500');
        const product = productData.find(p => p.id === productId);
        if (!product) return;

        const weightMultipliers = { '0.5 kg': 0.5, '1 kg': 1, '2 kg': 2, '3 kg': 3, '4 kg': 4 };
        const multiplier = weightMultipliers[selectedWeight] || 1;
        const newPrice = Math.round(product.price * multiplier);
        const newOriginalPrice = product.originalPrice ? Math.round(product.originalPrice * multiplier) : null;

        priceElement.textContent = `₹ ${newPrice}`;
        if (originalPriceElement && newOriginalPrice) {
            originalPriceElement.textContent = `₹ ${newOriginalPrice}`;
        } else if (originalPriceElement) {
            originalPriceElement.style.display = 'none';
        }
        if (discountBadge && newOriginalPrice) {
            const newDiscountPercent = calculateDiscountPercentage(newOriginalPrice, newPrice);
            discountBadge.textContent = newDiscountPercent > 0 ? `${newDiscountPercent}% OFF` : '';
            discountBadge.style.display = newDiscountPercent > 0 ? 'block' : 'none';
        }

        product.currentPrice = newPrice;
        product.currentWeight = selectedWeight;
        product.currentOriginalPrice = newOriginalPrice;
    }

    function updateProducts() {
        let products = [...productData];
        if (currentCategory !== 'all') {
            products = products.filter(p => p.category === currentCategory);
        }
        renderProducts(products);
    }

    /* ------------------------------------------------------------------ */
    /* 5. BACKEND WISHLIST */
    /* ------------------------------------------------------------------ */
    async function toggleWishlist(btn, productId) {
        event.stopPropagation();

        if (!window.apiService?.getUserId()) {
            showToast("Please login to add to wishlist", "warning");
            setTimeout(() => window.location.href = '/login.html', 1500);
            return;
        }

        const isActive = btn.classList.contains('active');

        try {
            if (isActive) {
                const wishlistItemId = btn.dataset.wid;
                if (wishlistItemId) {
                    await window.apiService.removeFromWishlist(wishlistItemId, 'CUSTOMIZE_CAKE');
                    btn.classList.remove('active');
                    btn.querySelector('svg').innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>';
                    btn.dataset.wid = '';
                    showToast('Removed from wishlist', 'success');
                }
            } else {
                // await window.apiService.addToWishlist(productId, 'CUSTOMIZE_CAKE');
                await window.apiService.addToWishlist(productId, 'CUSTOMIZE_CAKE', 'customizeCakeId');
                btn.classList.add('active');
                btn.querySelector('svg').innerHTML = '<path fill="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>';
                showToast('Added to wishlist', 'success');

                const list = await window.apiService.getWishlist();
                const item = list.find(i => i.productId == productId);
                if (item?.wishlistItemId) {
                    btn.dataset.wid = item.wishlistItemId;
                }
            }
            await window.apiService.updateWishlistCount();
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
                btn.dataset.wid = item.customizeCakeId;
            }
        });

        await window.apiService.updateWishlistCount();
    } catch (err) {
        console.warn('Wishlist refresh failed', err);
    }
}

    function handleProductClick(productId) {
        const product = productData.find(p => p.id === productId);
        if (product) orderOnWhatsApp(product, new Event('click'));
    }

    function openModal() {
        const modal = document.getElementById('customize-modal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeModal() {
        const modal = document.getElementById('customize-modal');
        if (modal) modal.classList.add('hidden');
        const form = document.getElementById('customize-form');
        if (form) form.reset();
    }

    async function orderOnWhatsApp(productInput, event) {
        event.preventDefault();
        event.stopPropagation();
        const product = typeof productInput === 'string' ? JSON.parse(productInput) : productInput;
        const fullImageURL = product.image;
        const currentPrice = product.currentPrice || product.price;
        const currentWeight = product.currentWeight || '1 kg';
        const currentOriginalPrice = product.currentOriginalPrice || product.originalPrice;

        const baseMessage = `Hello! I would like to order:\n\n` +
                          ` ${product.name}\n` +
                          ` Weight: ${currentWeight}\n` +
                          ` Price: ₹${currentPrice}\n` +
                          `${currentOriginalPrice ? ` Original Price: ₹${currentOriginalPrice}\n` : ''}` +
                          `\nPlease help me customize this cake. Thank you!`;

        if (navigator.share) {
            try {
                const response = await fetch(fullImageURL);
                if (!response.ok) throw new Error('Failed to fetch image');
                const blob = await response.blob();
                const imageFile = new File([blob], `${product.name.replace(/\s+/g, '_')}.jpg`, { type: blob.type });
                const shareData = { title: 'Order Custom Cake', text: baseMessage, files: [imageFile] };
                if (navigator.canShare && navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    return;
                } else {
                    await navigator.share({ title: 'Order Custom Cake', text: baseMessage + `\n\nView product image: ${fullImageURL}` });
                    return;
                }
            } catch (error) { console.warn('Web Share failed:', error); }
        }

        const fallbackMessage = baseMessage + `\n\nView/Download Product Image: ${fullImageURL}`;
        const encodedMessage = encodeURIComponent(fallbackMessage);
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');
    }

    function performSearch(query) {
        const suggestions = document.getElementById('searchSuggestions');
        if (!suggestions) return;
        if (query.length === 0) {
            suggestions.innerHTML = '<p class="text-xs text-gray-500 p-2">Start typing to see suggestions...</p>';
            return;
        }
        const filtered = productData.filter(product =>
            product.name.toLowerCase().includes(query.toLowerCase()) ||
            (product.category && product.category.toLowerCase().includes(query.toLowerCase()))
        ).slice(0, 5);
        suggestions.innerHTML = '';
        if (filtered.length === 0) {
            suggestions.innerHTML = '<p class="text-xs text-gray-500 p-2">No products found.</p>';
            return;
        }
        filtered.forEach(product => {
            const a = document.createElement('a');
            a.href = `/product-details.html?id=${product.id}`;
            a.className = 'flex items-center p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-sm';
            a.innerHTML = `
                <i class="fas fa-search text-primary mr-3"></i>
                <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900 truncate">${product.name}</div>
                    <div class="text-xs text-gray-500 truncate">${product.category || 'Cakes'}</div>
                </div>
            `;
            a.addEventListener('click', () => {
                hideSearchOverlay();
            });
            suggestions.appendChild(a);
        });
    }

    const filterBtn = document.getElementById('cakeFilterBtn');
    const filterOptions = document.getElementById('filterOptions');
    const options = document.querySelectorAll('.option');
    const selectedOption = document.getElementById('selectedOption');

    if (filterBtn && filterOptions) {
        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterOptions.classList.toggle('hidden');
        });
        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = option.dataset.value;
                const text = option.textContent.trim();
                if (selectedOption) selectedOption.textContent = text;
                currentCategory = value;
                updateProducts();
                filterOptions.classList.add('hidden');
            });
        });
        document.addEventListener('click', () => filterOptions.classList.add('hidden'));
    }

    const form = document.getElementById('customize-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const flavour = document.getElementById('flavour').value;
            const size = document.getElementById('size').value;
            const addons = document.getElementById('addons').value;
            let details = '';
            if (flavour) details += `Flavour: ${flavour}\n`;
            if (size) details += `Size: ${size}\n`;
            if (addons) details += `Add-ons: ${addons}\n`;
            const message = `Hello! I would like to order a custom cake.\n\nCustom Cake Details:\n${details}\nPlease help me customize this cake. Thank you!`;
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank");
            closeModal();
        });
    }

    const closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

    /* ------------------------------------------------------------------ */
    /* 6. INITIALIZE EVERYTHING */
    /* ------------------------------------------------------------------ */
    async function initializeProducts() {
        try {
            console.log('Fetching products from API...');
            const apiProducts = await BakeryAPI.getAllProducts();
            productData = apiProducts
                .filter(product => product.isActive !== false)
                .map(transformApiProduct);
            console.log('Products loaded from API:', productData.length);
            updateProducts();
            markWishlistedItems();
        } catch (error) {
            console.error('Failed to initialize products from API:', error);
            productData = [];
            updateProducts();
            showToast('Failed to load products', 'error');
        }
    }

    // Start everything
    initializeProducts();

    // Global exports
    window.BakeryAPI = BakeryAPI;
    window.initializeProducts = initializeProducts;
    window.performSearch = performSearch;
    window.orderOnWhatsApp = orderOnWhatsApp;
    window.toggleWishlist = toggleWishlist;
    window.handleProductClick = handleProductClick;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.updateProducts = updateProducts;
    window.renderProducts = renderProducts;
    window.updateProductPrice = updateProductPrice;
    window.calculateDiscountPercentage = calculateDiscountPercentage;
});