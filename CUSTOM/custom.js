/* ==================== custom.js – FULLY FIXED & COPY-PASTE READY ==================== */
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

    // === MOBILE MENU TOGGLE ===
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('hidden');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            }
        });
    }

    // Close mobile menu on resize to desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024 && !navLinks.classList.contains('hidden')) {
            navLinks.classList.add('hidden');
            const icon = menuToggle.querySelector('i');
            if (icon) icon.classList.replace('fa-times', 'fa-bars');
        }
    });

    // === SEARCH OVERLAY ===
    if (searchToggle && searchOverlay && searchInput && searchSuggestions) {
        const showSearchOverlay = () => {
            searchOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            setTimeout(() => {
                const modal = searchOverlay.querySelector('.scale-95');
                if (modal) modal.classList.add('scale-100');
            }, 10);
            searchInput.focus();
            performSearch(''); // Show all suggestions on open
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

    // === PROFILE DROPDOWN & LOGOUT ===
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
    });

    // Initialize dropdown
    populateDropdown();

    /* ------------------------------------------------------------------ */
    /* 2. YOUR ORIGINAL API & PRODUCT LOGIC (UNCHANGED + SEARCH REDIRECT FIX) */
    /* ------------------------------------------------------------------ */
    const API_BASE_URL = 'http://localhost:8082/api/customize-cakes';
    const WHATSAPP_NUMBER = '7972026004';

    let productData = [];
    let wishlistDetails = JSON.parse(localStorage.getItem('wishlistDetails')) || [];
    let currentCategory = 'all';

    // === API SERVICE ===
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
        static async getProductById(id) {
            try {
                const response = await fetch(`${API_BASE_URL}/${id}`);
                const result = await response.json();
                return result.success ? result.data : null;
            } catch (error) {
                console.error('Failed to fetch product:', error);
                return null;
            }
        }
        static async searchProducts(query) {
            try {
                const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
                const result = await response.json();
                return result.success ? result.data : [];
            } catch (error) {
                console.error('Failed to search products:', error);
                return [];
            }
        }
        static async getProductsByCategory(category) {
            try {
                const response = await fetch(`${API_BASE_URL}/category/${encodeURIComponent(category)}`);
                const result = await response.json();
                return result.success ? result.data : [];
            } catch (error) {
                console.error('Failed to fetch products by category:', error);
                return [];
            }
        }
    }

    // === PRODUCT TRANSFORMATION ===
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

    // === INITIALIZE PRODUCTS ===
    async function initializeProducts() {
        try {
            console.log('Fetching products from API...');
            const apiProducts = await BakeryAPI.getAllProducts();
            productData = apiProducts
                .filter(product => product.isActive !== false)
                .map(transformApiProduct);
            console.log('Products loaded from API:', productData.length);
            updateProducts();
        } catch (error) {
            console.error('Failed to initialize products from API:', error);
            productData = [];
            updateProducts();
        }
    }

    // === UPDATE & RENDER PRODUCTS ===
    function updateProducts() {
        let products = [...productData];
        if (currentCategory !== 'all') {
            products = products.filter(p => p.category === currentCategory);
        }
        renderProducts(products);
    }

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
        updateWishlistCount();
    }

    function calculateDiscountPercentage(originalPrice, sellingPrice) {
        if (!originalPrice || originalPrice <= sellingPrice) return 0;
        return Math.round(((originalPrice - sellingPrice) / originalPrice) * 100);
    }

    function createProductCard(product) {
        const isInWishlist = wishlistDetails.some(item => item.id === product.id);
        const discountPercent = calculateDiscountPercentage(product.originalPrice, product.price);
        const weightOptions = ['0.5 kg', '1 kg', '2 kg', '3 kg', '4 kg'];
        const weightMultipliers = { '0.5 kg': 0.5, '1 kg': 1, '2 kg': 2, '3 kg': 3, '4 kg': 4 };

        return `
            <div class="bg-white rounded-lg shadow-md overflow-hidden relative hover:shadow-lg transition-shadow duration-300 product-card" data-product-id="${product.id}">
                ${discountPercent > 0 ? `
                    <div class="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold z-10">
                        ${discountPercent}% OFF
                    </div>
                ` : ''}
                <button class="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md wishlist-btn z-10 ${isInWishlist ? 'active' : ''}" 
                   onclick="toggleWishlist(this, ${product.id}, event)">
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
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                            WhatsApp
                        </button>
                        <button onclick="openModal()" 
                                class="flex-1 bg-primary hover:bg-secondary text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1 customize-btn text-sm">
                            <i class="fas fa-magic"></i> Customise
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

    async function orderOnWhatsApp(productInput, event) {
        event.preventDefault();
        event.stopPropagation();
        const product = typeof productInput === 'string' ? JSON.parse(productInput) : productInput;
        const fullImageURL = product.image;
        const currentPrice = product.currentPrice || product.price;
        const currentWeight = product.currentWeight || '1 kg';
        const currentOriginalPrice = product.currentOriginalPrice || product.originalPrice;

        const baseMessage = `Hello! I would like to order:\n\n` +
                          `  ${product.name}\n` +
                          `  Weight: ${currentWeight}\n` +
                          `  Price: ₹${currentPrice}\n` +
                          `${currentOriginalPrice ? `  Original Price: ₹${currentOriginalPrice}\n` : ''}` +
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

    function toggleWishlist(button, productId, event) {
        event.preventDefault();
        event.stopPropagation();
        const product = productData.find(p => p.id === productId);
        if (!product) return;

        const isInWishlist = wishlistDetails.some(item => item.id === productId);
        if (isInWishlist) {
            wishlistDetails = wishlistDetails.filter(item => item.id !== productId);
            button.classList.remove('active');
            showNotification('Removed from wishlist!');
        } else {
            wishlistDetails.push(product);
            button.classList.add('active');
            showNotification('Added to wishlist!');
        }
        localStorage.setItem('wishlistDetails', JSON.stringify(wishlistDetails));
        updateWishlistCount();
    }

    function updateWishlistCount() {
        const wishlistCount = document.getElementById('wishlist-count');
        if (wishlistCount) wishlistCount.textContent = wishlistDetails.length;
    }

    function showNotification(message) {
        const n = document.createElement('div');
        n.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 2000);
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

    // === SEARCH SUGGESTIONS – REDIRECT TO ROOT (NO /CUSTOM) ===
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
            // REDIRECT FROM ROOT (NO /CUSTOM)
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

    // === FILTER DROPDOWN ===
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

    // === CUSTOMIZE FORM SUBMIT ===
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

    // === INITIALIZE EVERYTHING ===
    initializeProducts();
    updateWishlistCount();

    // === GLOBAL EXPORTS ===
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