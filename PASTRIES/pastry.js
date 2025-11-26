/* ==================== pastry.js – FINAL FIXED VERSION ==================== */
document.addEventListener("DOMContentLoaded", function () {
    /* ------------------------------------------------------------------ */
    /* 1. MOBILE MENU TOGGLE */
    /* ------------------------------------------------------------------ */
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    const mobileCakesToggle = document.getElementById('mobileCakesToggle');
    const mobileCakesMenu = document.getElementById('mobileCakesMenu');
    const mobilePastriesToggle = document.getElementById('mobilePastriesToggle');
    const mobilePastriesMenu = document.getElementById('mobilePastriesMenu');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', function () {
            navLinks.classList.toggle('hidden');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                if (navLinks.classList.contains('hidden')) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                } else {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                }
            }
        });
    }

    // Mobile dropdown toggles
    if (mobileCakesToggle && mobileCakesMenu) {
        mobileCakesToggle.addEventListener('click', function () {
            mobileCakesMenu.classList.toggle('hidden');
            const icon = mobileCakesToggle.querySelector('i');
            if (icon) icon.classList.toggle('rotate-180');
        });
    }
    if (mobilePastriesToggle && mobilePastriesMenu) {
        mobilePastriesToggle.addEventListener('click', function () {
            mobilePastriesMenu.classList.toggle('hidden');
            const icon = mobilePastriesToggle.querySelector('i');
            if (icon) icon.classList.toggle('rotate-180');
        });
    }

    // Close mobile menu on resize to lg+
    window.addEventListener('resize', function () {
        if (window.innerWidth >= 1024) {
            navLinks.classList.add('hidden');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    });

    /* ------------------------------------------------------------------ */
    /* 2. PASTRIES API SERVICE */
    /* ------------------------------------------------------------------ */
    class PastriesApiService {
        constructor() {
            this.baseUrl = 'http://localhost:8082/api/v1';
            this.imgBaseUrl = 'http://localhost:8082';
            this.cache = {
                pastries: null,
                lastFetch: null,
                cacheDuration: 5 * 60 * 1000 // 5 min
            };
        }
        isCacheValid() {
            return this.cache.pastries &&
                   this.cache.lastFetch &&
                   (Date.now() - this.cache.lastFetch) < this.cache.cacheDuration;
        }
        async getAllPastries() {
            if (this.isCacheValid()) return this.cache.pastries;
            try {
                const response = await fetch(`${this.baseUrl}/products/category/Pastries?page=0&size=100`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const apiResponse = await response.json();
                const products = (apiResponse?.data?.content) || [];
                const pastries = products.map(p => this.mapApiToPastry(p)).filter(Boolean);
                this.cache.pastries = pastries;
                this.cache.lastFetch = Date.now();
                return pastries;
            } catch (error) {
                console.error('Error fetching pastries:', error);
                return this.cache.pastries || [];
            }
        }
        mapApiToPastry(apiProduct) {
            if (!apiProduct) return null;
            const productId = apiProduct.productId || apiProduct.id;
            if (!productId) return null;
            return {
                id: productId.toString(),
                name: apiProduct.productName || 'Unnamed Pastry',
                category: 'Pastries',
                flavor: apiProduct.flavor || 'Assorted',
                price: apiProduct.productNewPrice || 0,
                originalPrice: apiProduct.productOldPrice || null,
                rating: apiProduct.ratings || 4.5,
                reviewCount: apiProduct.reviews || 0,
                description: apiProduct.description || 'Delicious freshly baked pastry',
                image: apiProduct.productImageUrl 
                    ? `${this.imgBaseUrl}${apiProduct.productImageUrl}` 
                    : 'https://via.placeholder.com/300x200?text=Pastry',
                foodType: apiProduct.productFoodType || 'Vegetarian',
                highlights: this.extractHighlights(apiProduct),
                ingredients: apiProduct.productIngredients
                    ? (Array.isArray(apiProduct.productIngredients)
                        ? apiProduct.productIngredients
                        : apiProduct.productIngredients.split(',').map(i => i.trim()))
                    : ['Fresh ingredients'],
                allergens: apiProduct.allergenInfo || 'Contains dairy, eggs, and gluten',
                deliveryTime: apiProduct.deliveryTime || 'Same day delivery',
                orderCount: apiProduct.orderCount || 0
            };
        }
        extractHighlights(apiProduct) {
            if (apiProduct?.features) {
                if (Array.isArray(apiProduct.features)) return apiProduct.features;
                if (typeof apiProduct.features === 'string')
                    return apiProduct.features.split(',').map(f => f.trim());
            }
            return ['Freshly baked daily', 'Made with premium ingredients', 'Perfect for any occasion'];
        }
    }

    /* ------------------------------------------------------------------ */
    /* 3. PASTRIES PAGE CONTENT MANAGER */
    /* ------------------------------------------------------------------ */
    class PastriesPageManager {
        constructor() {
            this.apiService = new PastriesApiService();
            this.init();
        }
        async init() {
            await this.loadPastriesContent();
            this.attachGlobalListeners();
        }
        async loadPastriesContent() {
            const loadingState = document.getElementById('loadingState');
            const productsGrid = document.getElementById('productsGrid');
            const errorState = document.getElementById('errorState');

            try {
                const pastries = await this.apiService.getAllPastries();
                if (!productsGrid) return;

                if (!pastries || pastries.length === 0) {
                    this.showNoPastriesMessage();
                    if (loadingState) loadingState.classList.add('hidden');
                    if (errorState) errorState.classList.add('hidden');
                    productsGrid.classList.remove('hidden');
                    return;
                }

                this.renderPastriesGrid(pastries);
                if (loadingState) loadingState.classList.add('hidden');
                productsGrid.classList.remove('hidden');
                if (errorState) errorState.classList.add('hidden');
            } catch (error) {
                console.error('Error loading pastries content:', error);
                if (loadingState) loadingState.classList.add('hidden');
                if (errorState) errorState.classList.remove('hidden');
            }
        }
        renderPastriesGrid(pastries) {
            const productsGrid = document.getElementById('productsGrid');
            if (!productsGrid) return;

            productsGrid.innerHTML = pastries.map(pastry => `
                <div class="bg-white rounded-lg shadow-card overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer" data-id="${pastry.id}" onclick="window.location.href='/product-details.html?id=${pastry.id}'">
                    <div class="relative">
                        <img src="${pastry.image}" alt="${pastry.name}" class="w-full h-48 object-cover"
                             onerror="this.src='https://via.placeholder.com/300x200?text=Pastry+Image'">
                        <button class="wishlist-btn absolute top-2 right-2 bg-white p-2 rounded-full shadow-md" aria-label="Toggle wishlist" onclick="event.stopPropagation(); pastriesPageManager.toggleWishlist(this)">
                            <i class="far fa-heart text-black"></i>
                        </button>
                        ${pastry.originalPrice ? `
                            <div class="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 text-xs font-semibold rounded">
                                SAVE ₹${(pastry.originalPrice - pastry.price).toFixed(0)}
                            </div>` : ''}
                    </div>
                    <div class="p-4">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="font-semibold text-gray-800 line-clamp-2">${pastry.name}</h3>
                            <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">${pastry.foodType}</span>
                        </div>
                        <p class="text-gray-600 text-sm mb-3 line-clamp-2">${pastry.description}</p>
                        <div class="flex items-center mb-3">
                            <div class="flex text-yellow-400 mr-2">${this.generateStarRating(pastry.rating)}</div>
                            <span class="text-sm text-gray-500">(${pastry.reviewCount})</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <div>
                                ${pastry.originalPrice ? `<span class="text-sm text-gray-500 line-through">₹${pastry.originalPrice}</span>` : ''}
                                <span class="text-xl font-bold text-primary ml-2">₹${pastry.price}</span>
                            </div>
                            <button class="view-details-btn bg-primary text-white px-4 py-2 rounded-lg hover:bg-secondary transition-colors" onclick="event.stopPropagation(); window.location.href='/product-details.html?id=${pastry.id}'">
                                View Details
                            </button>
                        </div>
                        <div class="mt-3 text-xs text-gray-500">
                            <i class="fas fa-shipping-fast mr-1"></i>${pastry.deliveryTime}
                        </div>
                    </div>
                </div>
            `).join('');

            this.attachProductCardListeners();
        }
        generateStarRating(rating) {
            const full = Math.floor(rating || 0);
            const half = (rating % 1) >= 0.5 ? 1 : 0;
            const empty = 5 - full - half;
            let html = '';
            for (let i = 0; i < full; i++) html += '<i class="fas fa-star text-sm"></i>';
            if (half) html += '<i class="fas fa-star-half-alt text-sm"></i>';
            for (let i = 0; i < empty; i++) html += '<i class="far fa-star text-sm"></i>';
            return html;
        }
        attachProductCardListeners() {
            const productCards = document.querySelectorAll('#productsGrid > div[data-id]');
            const wishlistButtons = document.querySelectorAll('#productsGrid .wishlist-btn');

            wishlistButtons.forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    this.toggleWishlist(btn);
                });
            });

            productCards.forEach(card => {
                card.style.cursor = 'pointer';
            });
        }
        toggleWishlist(button) {
            const icon = button.querySelector('i');
            if (!icon) return;
            if (icon.classList.contains('far')) {
                icon.classList.remove('far');
                icon.classList.add('fas', 'text-red-500');
            } else {
                icon.classList.remove('fas', 'text-red-500');
                icon.classList.add('far');
            }
        }
        toast(message, type) {
            const n = document.createElement('div');
            n.className = `fixed top-4 right-4 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white px-4 py-2 rounded shadow z-50`;
            n.textContent = message;
            document.body.appendChild(n);
            setTimeout(() => n.remove(), 1500);
        }
        showNoPastriesMessage() {
            const loadingState = document.getElementById('loadingState');
            const productsGrid = document.getElementById('productsGrid');
            if (loadingState) loadingState.classList.add('hidden');
            if (!productsGrid) return;
            productsGrid.classList.remove('hidden');
            productsGrid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-cookie-bite text-4xl text-gray-400 mb-4"></i>
                    <h3 class="text-xl font-semibold text-gray-800 mb-2">No Pastries Available</h3>
                    <p class="text-gray-600">We're busy baking fresh pastries for you. Please check back soon!</p>
                </div>`;
        }
        attachGlobalListeners() {
            const retryButton = document.getElementById('retryButton');
            if (retryButton) {
                retryButton.addEventListener('click', () => {
                    const err = document.getElementById('errorState');
                    const load = document.getElementById('loadingState');
                    if (err) err.classList.add('hidden');
                    if (load) load.classList.remove('hidden');
                    this.loadPastriesContent();
                });
            }
        }
    }

    // Initialise pastries manager
    window.pastriesPageManager = new PastriesPageManager();

    /* ------------------------------------------------------------------ */
    /* 4. SEARCH FUNCTIONALITY – DYNAMIC FROM API */
    /* ------------------------------------------------------------------ */
    const searchInput = document.getElementById('searchInput');
    const suggestionsBox = document.getElementById('searchSuggestions');
    const searchOverlay = document.getElementById('searchOverlay');

    if (searchInput && suggestionsBox && searchOverlay) {
        const showSearchOverlay = () => {
            searchOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            setTimeout(() => searchOverlay.querySelector('.scale-95')?.classList.add('scale-100'), 10);
            searchInput.focus();
            showAllSuggestions('');
        };
        const hideSearchOverlay = () => {
            searchOverlay.querySelector('.scale-95')?.classList.remove('scale-100');
            setTimeout(() => {
                searchOverlay.classList.add('hidden');
                document.body.style.overflow = '';
                suggestionsBox.innerHTML = '';
            }, 300);
        };

        const showAllSuggestions = async (query = '') => {
            const lower = query.toLowerCase();
            suggestionsBox.innerHTML = '<div class="p-3 text-xs text-gray-500 animate-pulse">Loading suggestions...</div>';

            try {
                const api = new PastriesApiService();
                const pastries = await api.getAllPastries();

                const categoryButtons = [
                    { text: 'ALL CAKES', value: 'all', url: '/CAKES/allcakes.html' },
                    { text: 'BIRTHDAY', value: 'birthday', url: '/CUSTOM/custom.html' },
                    { text: 'ANNIVERSARY', value: 'anniversary', url: '/CUSTOM/custom.html' },
                    { text: 'BDAY BOY', value: 'bday-boy', url: '/CUSTOM/custom.html' },
                    { text: 'BDAY GIRL', value: 'bday-girl', url: '/CUSTOM/custom.html' },
                    { text: 'BABY SHOWER', value: 'baby-shower', url: '/CUSTOM/custom.html' },
                    { text: "HUSBAND'S BDAY", value: 'husbands-bday', url: '/CUSTOM/custom.html' },
                    { text: "WIFE'S BDAY", value: 'wifes-bday', url: '/CUSTOM/custom.html' },
                    { text: 'HALF BDAY CAKES', value: 'half-bday', url: '/CUSTOM/custom.html' },
                    { text: 'TRENDING ANTI GRAVITY', value: 'trending-anti-gravity', url: '/CUSTOM/custom.html' },
                    { text: 'CUSTOM CAKES', value: 'custom', url: '/CUSTOM/custom.html' }
                ];

                suggestionsBox.innerHTML = '';

                // Categories
                const filteredCats = categoryButtons.filter(c => 
                    c.text.toLowerCase().includes(lower) || c.value.includes(lower)
                );
                if (filteredCats.length) {
                    const hdr = document.createElement('div');
                    hdr.className = 'px-3 py-2 text-xs font-bold text-gray-600 uppercase border-b';
                    hdr.textContent = 'Categories';
                    suggestionsBox.appendChild(hdr);
                    filteredCats.forEach(cat => {
                        const btn = document.createElement('button');
                        btn.className = 'option w-full text-left px-3 py-2 hover:bg-gray-50 text-xs block truncate';
                        btn.textContent = cat.text;
                        btn.addEventListener('click', () => {
                            window.location.href = cat.url;
                            hideSearchOverlay();
                        });
                        suggestionsBox.appendChild(btn);
                    });
                }

                // Products (from API)
                const filteredProducts = pastries
                    .filter(p => p.name.toLowerCase().includes(lower))
                    .slice(0, 5);
                if (filteredProducts.length) {
                    const hdr = document.createElement('div');
                    hdr.className = 'px-3 py-2 mt-2 text-xs font-bold text-gray-600 uppercase border-t';
                    hdr.textContent = 'Pastries';
                    suggestionsBox.appendChild(hdr);
                    filteredProducts.forEach(p => {
                        const a = document.createElement('a');
                        a.href = `/product-details.html?id=${p.id}`;
                        a.className = 'flex items-center p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-sm';
                        a.innerHTML = `
                            <i class="fas fa-search text-primary mr-3"></i>
                            <div class="flex-1 min-w-0">
                                <div class="font-medium text-gray-900 truncate">${p.name}</div>
                                <div class="text-xs text-gray-500 truncate">₹${p.price} • ${p.flavor}</div>
                            </div>`;
                        a.addEventListener('click', hideSearchOverlay);
                        suggestionsBox.appendChild(a);
                    });
                }

                // Empty state
                if (query.length === 0) {
                    suggestionsBox.innerHTML = '<p class="text-xs text-gray-500 p-3 animate-pulse">Start typing to search pastries...</p>';
                } else if (!filteredProducts.length && !filteredCats.length) {
                    suggestionsBox.innerHTML = `
                        <div class="flex flex-col items-center justify-center py-6 px-4 text-center">
                            <div class="w-16 h-16 mb-3 rounded-full bg-gray-100 flex items-center justify-center animate-bounce">
                                <i class="fas fa-search text-gray-400 text-2xl"></i>
                            </div>
                            <p class="text-sm font-medium text-gray-700 mb-1">No results found</p>
                            <p class="text-xs text-gray-500">Try searching for "chocolate", "biscoff", or "cheesecake"</p>
                        </div>`;
                }

            } catch (err) {
                suggestionsBox.innerHTML = '<p class="text-xs text-red-500 p-3">Failed to load suggestions</p>';
            }
        };

        // Events
        searchInput.addEventListener('input', e => showAllSuggestions(e.target.value));
        searchInput.addEventListener('focus', () => showAllSuggestions(searchInput.value));
        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                if (!searchInput.value.trim()) suggestionsBox.classList.add('hidden');
            }, 150);
        });
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Escape') hideSearchOverlay();
        });

        document.getElementById('searchToggle')?.addEventListener('click', e => { e.preventDefault(); showSearchOverlay(); });
        document.getElementById('mobileSearchToggle')?.addEventListener('click', e => { e.preventDefault(); showSearchOverlay(); });
        document.getElementById('closeSearch')?.addEventListener('click', hideSearchOverlay);
        searchOverlay.addEventListener('click', e => { if (e.target === searchOverlay) hideSearchOverlay(); });

        // Animation
        if (!document.getElementById('search-anim-style')) {
            const style = document.createElement('style');
            style.id = 'search-anim-style';
            style.textContent = `
                @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
                .animate-fadeIn { animation: fadeIn .4s ease-out forwards; }
            `;
            document.head.appendChild(style);
        }
    }

    /* ------------------------------------------------------------------ */
    /* 5. LOGIN / PROFILE DROPDOWN + LOGOUT MODAL */
    /* ------------------------------------------------------------------ */
    function isLoggedIn() {
        const session = localStorage.getItem('userSession');
        if (!session) return false;
        try {
            const { expiry } = JSON.parse(session);
            if (Date.now() < expiry) return true;
        } catch (e) { }
        localStorage.removeItem('userSession');
        return false;
    }

    function populateDropdown() {
        const dropdowns = document.querySelectorAll('.dropdown-content');
        const content = isLoggedIn() ? `
            <a href="/profile.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">My Profile</a>
            <a href="#" onclick="showLogoutModal(); return false;" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Logout</a>
        ` : `
            <a href="/login.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Login/Signup</a>
        `;
        dropdowns.forEach(d => d.innerHTML = content);
    }

    function showLogoutModal() {
        document.getElementById('logoutModal').classList.remove('hidden');
    }
    function hideLogoutModal() {
        document.getElementById('logoutModal').classList.add('hidden');
    }
    function performLogout() {
        localStorage.removeItem('userSession');
        populateDropdown();
        hideLogoutModal();
    }

    // Initialise
    populateDropdown();

    const modal = document.getElementById('logoutModal');
    const cancelBtn = document.getElementById('modalCancel');
    const confirmBtn = document.getElementById('modalConfirm');

    if (cancelBtn) cancelBtn.addEventListener('click', hideLogoutModal);
    if (confirmBtn) confirmBtn.addEventListener('click', performLogout);
    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal) hideLogoutModal();
        });
    }

    /* ------------------------------------------------------------------ */
    /* END OF DOMContentLoaded */
    /* ------------------------------------------------------------------ */
});