console.log('[ProductDetailManager] Script loaded');

const API_BASE_URL = 'http://localhost:8082/api/v1';
const API_BASE_URL_IMG = 'http://localhost:8082';   

class ProductDetailManager {
    constructor() {
        this.currentProduct = null;
        this.currentQuantity = 1;
        this.selectedSize = null;
        this.currentImageIndex = 0;
        this.selectedAddons = new Map();
        this.addonsData = [];
        this.relatedProducts = [];
    }

    init() {
        console.log('[ProductDetailManager] Initializing product detail page');
        this.showLoading();
        this.loadProduct();
        this.loadAddons();
        this.setupEventListeners();
        this.setupPincodeChecker(); // ← ADD THIS LINE
        this.markWishlistedHeart(); // Heart red on login
    }

    getProductId() {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id') || urlParams.get('product') || '1';
        console.log(`[ProductDetailManager] Extracted product ID: ${id}`);
        return id;
    }


    async loadProduct() {
    const productId = this.getProductId();
    console.log(`[ProductDetailManager] Starting product load for ID: ${productId}`);

    try {
        let partialProduct = null;
        const sessionData = sessionStorage.getItem('selectedProduct');
        if (sessionData) {
            const parsed = JSON.parse(sessionData);
            if (parsed.id?.toString() === productId) {
                console.log(`[ProductDetailManager] Using cached session product data`);
                parsed.images = parsed.image ? [parsed.image] : [];
                partialProduct = parsed;
                this.currentProduct = partialProduct;
                this.renderProduct(partialProduct, true);
            }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Product not found (HTTP ${response.status})`);
        }

        const apiData = await response.json();
        if (!apiData.success || !apiData.data) {
            throw new Error('Invalid API response format');
        }

        const productData = apiData.data;
        if (productData.deleted === true) {
            throw new Error('This product has been removed');
        }

        const mappedProduct = this.mapApiToProduct(productData);

        // Merge session data (like wishlist status) with fresh API data
        this.currentProduct = { ...partialProduct, ...mappedProduct };

        // === CRITICAL: Select default size and sync price ===
        this.selectedSize = mappedProduct.sizes?.find(s => s.default) || mappedProduct.sizes?.[0] || null;

        if (this.selectedSize) {
            this.currentProduct.price = this.selectedSize.price;
            console.log(`[ProductDetailManager] Default size selected: ${this.selectedSize.label} → ₹${this.selectedSize.price}`);
        } else if (mappedProduct.sizes?.length > 0) {
            // Fallback: use first size if no default
            this.selectedSize = mappedProduct.sizes[0];
            this.currentProduct.price = this.selectedSize.price;
            console.log(`[ProductDetailManager] No default size, using first: ${this.selectedSize.label} → ₹${this.selectedSize.price}`);
        } else {
            // No sizes → use base price
            this.currentProduct.price = mappedProduct.price || 0;
            console.log(`[ProductDetailManager] No sizes available, using base price: ₹${this.currentProduct.price}`);
        }

        // Load related products
        await this.loadRelatedProducts(mappedProduct.category, productId);

        // Final render with full data
        this.renderProduct(this.currentProduct);
        this.hideLoading();

        // Share product size-price map with cart page
        localStorage.setItem('lastProductSizes', JSON.stringify(this.currentProduct.sizes));

        console.log(`[ProductDetailManager] Product fully loaded: ${this.currentProduct.name} (₹${this.currentProduct.price}) | Stock: ${this.currentProduct.productQuantity}`);

    } catch (error) {
        console.error(`[ProductDetailManager] Failed to load product ${productId}:`, error.message);

        // Fallback to mock on error
        this.currentProduct = this.getMockProduct();
        this.selectedSize = this.currentProduct.sizes?.[0] || null;
        if (this.selectedSize) {
            this.currentProduct.price = this.selectedSize.price;
        }

        this.renderProduct(this.currentProduct, true);
        this.hideLoading();

        // Optional: show user-friendly toast
        this.showNotification?.('Using demo mode – product unavailable', 'warning');
    }
}

   
    async loadAddons() {
        console.log('[ProductDetailManager] Fetching add-ons from API');
        try {
            const response = await fetch('http://localhost:8082/api/addons/get-all-addon-items', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to fetch add-ons`);
            }
            const addons = await response.json();
            console.log('[ProductDetailManager] Add-ons fetched:', addons);
            this.addonsData = addons;
            this.renderAddons();
        } catch (error) {
            console.error('[ProductDetailManager] Error fetching add-ons:', error);
            const addonsContainer = document.querySelector('#addonsSelection .grid');
            if (addonsContainer) {
                addonsContainer.innerHTML = '<p class="text-red-500 text-center">Failed to load add-ons. Please try again later.</p>';
            }
        }
    }


        // =============== REAL-TIME PINCODE CHECKER WITH INDIA POST API ===============
    setupPincodeChecker() {
        const pincodeInput = document.getElementById('pincodeInput');
        const checkBtn = document.getElementById('checkPincodeBtn');
        const resultDiv = document.getElementById('deliveryResult');
        const successDiv = document.getElementById('deliverySuccess');
        const errorDiv = document.getElementById('deliveryError');
        const locationText = document.getElementById('deliveryLocation');
        const chargeText = document.getElementById('deliveryChargeText');

        // Load last valid pincode
        const savedPincode = localStorage.getItem('lastValidPincode');
        if (savedPincode) {
            pincodeInput.value = savedPincode;
            this.checkPincodeRealTime(savedPincode);
        }

        // Only allow digits
        pincodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
        });

        const checkPincode = async () => {
            const pincode = pincodeInput.value.trim();
            if (pincode.length !== 6) {
                this.showNotification('Please enter a valid 6-digit pincode', 'error');
                return;
            }
            checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
            checkBtn.disabled = true;
            await this.checkPincodeRealTime(pincode);
            checkBtn.innerHTML = '<i class="fas fa-search-location"></i> Check';
            checkBtn.disabled = false;
        };

        checkBtn.addEventListener('click', checkPincode);
        pincodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPincode();
        });
    }

    async checkPincodeRealTime(pincode) {
        const resultDiv = document.getElementById('deliveryResult');
        const successDiv = document.getElementById('deliverySuccess');
        const errorDiv = document.getElementById('deliveryError');
        const locationText = document.getElementById('deliveryLocation');
        const chargeText = document.getElementById('deliveryChargeText');

        resultDiv.classList.remove('hidden');

        try {
            const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
            const data = await response.json();

            if (!data || data[0]?.Status !== "Success" || !data[0].PostOffice) {
                this.showDeliveryError("Invalid or undeliverable pincode");
                return;
            }

            const postOffice = data[0].PostOffice[0];
            const district = postOffice.District.toLowerCase();
            const isPuneArea = district.includes('pune');

            if (!isPuneArea) {
                this.showDeliveryError("Currently delivering only in Pune area");
                return;
            }

            // Get coordinates using pincode-to-lat-lng (we use a reliable mapping)
            const coords = this.getCoordinatesFromPincode(pincode);
            if (!coords) {
                this.showDeliveryError("Delivery not available for this pincode");
                return;
            }

            const distance = this.calculateDistance(18.5922, 73.7676, coords.lat, coords.lng); // Shop: 411045

            let charge = '';
            if (distance <= 3) charge = 'Free Delivery';
            else if (distance <= 5) charge = 'Delivery Charge: ₹99';
            else if (distance <= 7) charge = 'Delivery Charge: ₹199';
            else {
                this.showDeliveryError("Outside our 7km delivery radius");
                return;
            }

            // SUCCESS
            successDiv.classList.remove('hidden');
            errorDiv.classList.add('hidden');
            locationText.textContent = `${postOffice.Name}, ${postOffice.District}`;
            chargeText.textContent = charge;
            localStorage.setItem('lastValidPincode', pincode);
            localStorage.setItem('lastDeliveryArea', `${postOffice.Name}, Pune`);

            this.showNotification(`Delivery available! ${charge}`, 'success');

        } catch (err) {
            console.error("Pincode check failed:", err);
            this.showDeliveryError("Network error. Please try again.");
        }
    }

    showDeliveryError(message) {
        const resultDiv = document.getElementById('deliveryResult');
        const successDiv = document.getElementById('deliverySuccess');
        const errorDiv = document.getElementById('deliveryError');

        resultDiv.classList.remove('hidden');
        successDiv.classList.add('hidden');
        errorDiv.classList.remove('hidden');
        errorDiv.querySelector('div > p:last-child').textContent = message;
        localStorage.removeItem('lastValidPincode');
    }

    // Reliable Pune pincode → lat/lng mapping (add more as needed)
    getCoordinatesFromPincode(pincode) {
        const pincodeMap = {
            '411045': { lat: 18.5922, lng: 73.7676 }, // Mahalunge (Shop)
            '411021': { lat: 18.5533, lng: 73.7954 }, // Baner
            '411033': { lat: 18.5581, lng: 73.8059 }, // Hinjewadi
            '411057': { lat: 18.5777, lng: 73.8206 }, // Wakad
            '411027': { lat: 18.5642, lng: 73.7769 }, // Pashan
            '411008': { lat: 18.5308, lng: 73.8475 }, // Kothrud
            '411004': { lat: 18.5018, lng: 73.8526 }, // Deccan
            '411001': { lat: 18.5204, lng: 73.8567 }, // Pune Station
            '411005': { lat: 18.5300, lng: 73.8500 }, // Shivajinagar
            '411007': { lat: 18.5400, lng: 73.8800 }, // Aundh
            '411016': { lat: 18.5000, lng: 73.8200 }, // Viman Nagar
            '411014': { lat: 18.5500, lng: 73.9200 }, // Kharadi
            '411028': { lat: 18.5700, lng: 73.8500 }, // Hadapsar
        };
        return pincodeMap[pincode] || null;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return Math.round(R * c * 10) / 10;
    }
    // =============================================================================

    getMockProduct() {
        console.log(`[ProductDetailManager] Generating mock product data`);
        return {
            id: this.getProductId(),
            name: 'Mock Chocolate Cake',
            category: 'All Cakes',
            foodType: 'Vegetarian',
            price: 999.00,
            originalPrice: 1200.00,
            images: [],
            thumbnails: [],
            highlights: ['Eggless option available', 'Custom message', 'Free delivery'],
            sizes: [
                { label: '500g (Serves 4-6)', value: '500g', price: 499.00, default: false },
                { label: '1kg (Serves 8-10)', value: '1kg', price: 999.00, default: true },
                { label: '2kg (Serves 16-20)', value: '2kg', price: 1899.00, default: false }
            ],
            description: '<p>Delicious mock chocolate cake with rich frosting.</p><p>SKU: CAKE-MOCK-001</p>',
            specifications: {
                'Cake Details': {
                    'Flavor': 'Chocolate',
                    'Shape': 'Round',
                    'Weight': '1 kg',
                    'Layers': '1'
                },
                'Storage & Care': {
                    'Storage': 'Refrigerate after 2 hours',
                    'Shelf Life': '3 days',
                    'Best Served': 'Chilled',
                    'Preparation': '2 hours'
                }
            },
            ingredients: { 'Cake Base': ['Flour', 'Sugar', 'Cocoa Powder', 'Eggs', 'Butter', 'Chocolate'] },
            allergens: 'Contains gluten, eggs, dairy',
            deliveryTime: '2 hours',
            deliveryOffer: 'Free Delivery on orders above ₹500',
            rating: 4.5,
            reviewCount: 125,
            orderCount: '4',
            discountInfo: { freeDelivery: true, offer: '15% OFF' }
        };
    }

    // --- Updated to fix map error ---
    mapApiToProduct(apiProduct) {
        try {
            if (!apiProduct || typeof apiProduct !== 'object') {
                console.error('[ProductDetailManager] Invalid API product data:', apiProduct);
                throw new Error('Invalid API product data');
            }
            console.log(`[ProductDetailManager] Mapping API product data:`, apiProduct);

            const baseImageUrl = apiProduct.productImageUrl ? `${API_BASE_URL_IMG}${apiProduct.productImageUrl}` : '';
            const subImages = Array.isArray(apiProduct.productSubImageUrls) 
                ? apiProduct.productSubImageUrls.map(url => url ? `${API_BASE_URL_IMG}${url}` : '').filter(Boolean)
                : [];
            const images = [baseImageUrl, ...subImages].filter(Boolean);

            let sizes = [];
            try {
                if (Array.isArray(apiProduct.weights) && Array.isArray(apiProduct.weightPrices) && apiProduct.weights.length === apiProduct.weightPrices.length) {
                    sizes = apiProduct.weights.map((weight, index) => ({
                        label: `${weight} (Serves ${apiProduct.serves || '8-10'})`,
                        value: weight,
                        price: apiProduct.weightPrices[index] || apiProduct.productNewPrice || 500,
                        default: weight === apiProduct.defaultWeight
                    }));
                } else {
                    sizes = [{ label: 'Standard (1 kg)', value: '1kg', price: apiProduct.productNewPrice || 500, default: true }];
                }
                console.log(`[ProductDetailManager] Mapped sizes:`, sizes);
            } catch (e) {
                console.warn(`[ProductDetailManager] Sizes mapping failed:`, e);
                sizes = [{ label: 'Standard (1 kg)', value: '1kg', price: apiProduct.productNewPrice || 500, default: true }];
            }

            const highlights = Array.isArray(apiProduct.features) ? apiProduct.features : ['Freshly baked', 'Free delivery'];
            const orderCount = (apiProduct.orderCount || 0) > 500 ? '500+' : apiProduct.orderCount?.toString() || 'New';
            const ingredients = apiProduct.productIngredients ? {
                'Cake Base': apiProduct.productIngredients.split(',').map(i => i.trim()).filter(Boolean)
            } : { 'Cake Base': ['Flour', 'Sugar', 'Butter'] };
            const specifications = {
                'Cake Details': {
                    'Flavor': apiProduct.flavor || 'Chocolate',
                    'Shape': apiProduct.shape || 'Round',
                    'Weight': apiProduct.defaultWeight || '1 kg',
                    'Layers': apiProduct.layers || '2'
                },
                'Storage & Care': {
                    'Storage': apiProduct.storageInstructions || apiProduct.careInstructions || 'Refrigerate',
                    'Shelf Life': apiProduct.shelfLife || '3 days',
                    'Best Served': apiProduct.bestServed || 'Chilled',
                    'Preparation': apiProduct.preparationTime || '2 hours'
                }
            };
            const description = `
                <p class="mb-4">${apiProduct.description || 'A delicious cake baked with love and premium ingredients.'}</p>
           
                <h4 class="text-lg font-semibold text-gray-900 mt-6 mb-3">Occasions</h4>
                <p class="mb-4">Perfect for birthdays, anniversaries, or any celebration.</p>
            `;
            let discountPercent = 0;
            if (apiProduct.productOldPrice && apiProduct.productNewPrice && apiProduct.productOldPrice > apiProduct.productNewPrice) {
                discountPercent = Math.round(((apiProduct.productOldPrice - apiProduct.productNewPrice) / apiProduct.productOldPrice) * 100);
            }

            const mappedProduct = {
                id: apiProduct.productId?.toString() || '',
                name: apiProduct.productName || 'Featured Cake',
                category: apiProduct.productCategory || 'Cakes',
                foodType: apiProduct.productFoodType || 'Vegetarian',
                productQuantity: apiProduct.productQuantity ?? 10,
                price: apiProduct.productNewPrice || 'NA',
                originalPrice: apiProduct.productOldPrice,
                rating: apiProduct.ratings || 4.5,
                reviewCount: apiProduct.reviews || 0,
                orderCount: orderCount,
                images: images.length ? images : [],
                thumbnails: images.length ? images : [],
                highlights: highlights,
                sizes: sizes,
                description: description,
                specifications: specifications,
                ingredients: ingredients,
                allergens: apiProduct.allergenInfo || 'Contains gluten and dairy. May contain nuts.',
                deliveryTime: apiProduct.deliveryTime || 'N/A',
                deliveryOffer: `Free Delivery on orders above ₹${apiProduct.freeDeliveryThreshold || 500}`,
                discountInfo: {
                    freeDelivery: true,
                    offer: apiProduct.productDiscount || (discountPercent ? `${discountPercent}% OFF` : '')
                }
            };
            console.log(`[ProductDetailManager] Successfully mapped product:`, mappedProduct);
            return mappedProduct;
        } catch (error) {
            console.error(`[ProductDetailManager] Mapping failed, using mock fallback:`, error);
            return this.getMockProduct();
        }
    }
    // --- End of changes ---

    async loadRelatedProducts(category, currentId) {
        try {
            console.log(`[ProductDetailManager] Fetching related products for category: ${category}`);
            const response = await fetch(`${API_BASE_URL}/products/category/${encodeURIComponent(category)}?page=0&size=4`);
            console.log(`[ProductDetailManager] Related products API response status: ${response.status}`);
            if (!response.ok) throw new Error('Failed to fetch related products');
            const apiData = await response.json();
            console.log(`[ProductDetailManager] Related products API response data:`, apiData);
            const allProducts = (apiData.data?.content || apiData.content || []).filter(p => p);

            this.relatedProducts = allProducts
                .filter(p => p.productId?.toString() !== currentId && !(p.deleted === true))
                .map(p => ({
                    id: p.productId?.toString() || Math.random().toString(),
                    name: p.productName || 'Related Cake',
                    category: p.productCategory || category,
                    price: p.productNewPrice || 400,
                    rating: p.ratings || 4.0,
                    images: [p.productImageUrl ? `${API_BASE_URL_IMG}${p.productImageUrl}` : ''].filter(Boolean)
                }))
                .slice(0, 4);
            console.log(`[ProductDetailManager] Mapped related products:`, this.relatedProducts);
        } catch (error) {
            console.error(`[ProductDetailManager] Error loading related products:`, error);
            this.relatedProducts = [];
        }
        this.renderRelatedProducts();
    }

    renderProduct(product, isPartial = false) {
        const productToRender = product || this.currentProduct;
        if (!productToRender) {
            console.error(`[ProductDetailManager] No product data to render`);
            return;
        }
        console.log(`[ProductDetailManager] Rendering product${isPartial ? ' (partial)' : ''}:`, productToRender);

        document.title = `${productToRender.name} | The Home Bakery`;
        const pageTitleEl = document.getElementById('pageTitle');
        if (pageTitleEl) pageTitleEl.textContent = `${productToRender.name} | The Home Bakery`;

        const productBreadcrumbEl = document.getElementById('productBreadcrumb');
        if (productBreadcrumbEl) productBreadcrumbEl.textContent = productToRender.name;

        const categoryBreadcrumbEl = document.getElementById('categoryBreadcrumb');
        if (categoryBreadcrumbEl) {
            categoryBreadcrumbEl.textContent = productToRender.category;
            categoryBreadcrumbEl.href = `/CAKES/allcakes.html?category=${encodeURIComponent(productToRender.category.toLowerCase())}`;
        }

        this.renderMainInfo();
        this.renderImages();
        this.renderSizes();
        this.renderAddons();
        this.renderTabs();
        this.updateStockUI();               // <-- Critical stock handling
        if (!isPartial) this.renderRelatedProducts();
        this.markWishlistedHeart();
    }

    renderMainInfo() {
        const product = this.currentProduct;
        if (!product) {
            console.error(`[ProductDetailManager] No current product for main info rendering`);
            return;
        }
        console.log(`[ProductDetailManager] Rendering main info for product: ${product.name}`);

        const currentPrice = (this.selectedSize ? this.selectedSize.price : product.price) * this.currentQuantity;
        let totalAddonsPrice = 0;
        this.selectedAddons.forEach((count, addon) => {
            const addonData = this.addonsData.find(a => a.itemKey === addon);
            if (addonData) {
                totalAddonsPrice += count * addonData.price;
            }
        });
        const totalPrice = currentPrice + totalAddonsPrice;

        const badgeText = product.foodType === 'Vegetarian' ? 'Veg' : 'Non-Veg';
        const badgeClass = product.foodType === 'Vegetarian' ? 'bg-green-500' : 'bg-red-500';
        const badgeEl = document.getElementById('productBadge');
        if (badgeEl) {
            badgeEl.textContent = badgeText;
            badgeEl.className = `px-3 py-1 rounded-full text-xs font-medium mr-2 ${badgeClass} text-white`;
        }

        const orderCountEl = document.getElementById('orderCount');
        if (orderCountEl) orderCountEl.textContent = product.orderCount ? `${product.orderCount} orders` : '';

        const titleEl = document.getElementById('productTitle');
        if (titleEl) titleEl.textContent = product.name;

        const ratingHtml = this.generateRatingStars(product.rating);
        const ratingStarsEl = document.getElementById('ratingStars');
        if (ratingStarsEl) ratingStarsEl.innerHTML = ratingHtml;

        const reviewCountEl = document.getElementById('reviewCount');
        if (reviewCountEl) reviewCountEl.textContent = ``;

        this.updatePriceDisplay(totalPrice);

        const originalPriceEl = document.getElementById('originalPrice');
        if (originalPriceEl && product.originalPrice && product.originalPrice > (this.selectedSize ? this.selectedSize.price : product.price)) {
            originalPriceEl.textContent = `₹${product.originalPrice * this.currentQuantity}`;
            originalPriceEl.classList.remove('hidden');

            const discount = Math.round(((product.originalPrice - (this.selectedSize ? this.selectedSize.price : product.price)) / product.originalPrice) * 100);
            const discountInfoEl = document.getElementById('discountInfo');
            if (discountInfoEl) {
                discountInfoEl.innerHTML = `
                    Save ${discount}% (₹${(product.originalPrice - (this.selectedSize ? this.selectedSize.price : product.price)) * this.currentQuantity})
                `;
            }
        }

        const highlightsEl = document.getElementById('keyHighlights');
        if (highlightsEl && product.highlights) {
            const highlightsHtml = product.highlights.map(highlight => 
                `<li class="flex items-center"><i class="fas fa-check text-primary mr-2"></i>${highlight}</li>`
            ).join('');
            highlightsEl.innerHTML = highlightsHtml;
        }

        const deliveryTimeEl = document.getElementById('deliveryTime');
        if (deliveryTimeEl) deliveryTimeEl.textContent = product.deliveryTime || 'Same day delivery';

        const deliveryOfferEl = document.getElementById('deliveryOffer');
        if (deliveryOfferEl) deliveryOfferEl.textContent = product.deliveryOffer || 'Free delivery available';
    }

    updatePriceDisplay(totalPrice) {
        console.log(`[ProductDetailManager] Updating price display: ₹${totalPrice}`);
        const priceEl = document.getElementById('productPrice');
        if (priceEl) priceEl.textContent = `₹${totalPrice}`;
        const mobilePriceEl = document.getElementById('mobilePrice');
        if (mobilePriceEl) mobilePriceEl.textContent = `₹${totalPrice}`;
    }

    //================== NEW PATCH ADDED ===================//

    updateStockUI() {
    const qty = this.currentProduct?.productQuantity ?? 0;

    const desktopBtn = document.getElementById('addToCartBtn');
    const mobileBtn = document.getElementById('mobileAddToCart');
    const buyNowBtn = document.getElementById('buyNowBtn'); // ← This one was being destroyed!

    // Remove any existing stock badge to prevent duplicates
    document.querySelectorAll('#stockStatusBadge').forEach(el => el.remove());

    // Remove old message if exists
    const oldStatus = document.getElementById('stockStatus');
    if (oldStatus) oldStatus.remove();

    // Create fresh stock status element
    const stockEl = document.createElement('div');
    stockEl.id = 'stockStatus';

    if (qty === 0) {
        // OUT OF STOCK
        stockEl.innerHTML = `<span class="text-red-600 font-bold text-lg">Out of Stock!!</span>`;

        // Only affect Add to Cart buttons — NEVER touch Buy Now
        [desktopBtn, mobileBtn].forEach(btn => {
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Out of Stock';
                btn.classList.remove('floral-btn', 'hover:bg-secondary');
                btn.classList.add('bg-gray-400', 'cursor-not-allowed', 'opacity-60');
            }
        });

        // Buy Now stays untouched or disabled gracefully
        if (buyNowBtn) {
            buyNowBtn.disabled = true;
            buyNowBtn.textContent = 'Out of Stock';
            buyNowBtn.classList.add('opacity-60', 'cursor-not-allowed');
        }

    } else if (qty <= 5) {
        // LOW STOCK – Show animated badge
        stockEl.innerHTML = `
            <div id="stockStatusBadge" class="inline-block animate-pulse bg-orange-100 text-orange-800 
                px-6 py-3 rounded-full font-bold text-sm shadow-lg border border-orange-300">
                <i class="fas fa-fire text-orange-600 mr-2"></i>
                Only ${qty} left – Order Soon!
            </div>`;

        // Restore Add to Cart buttons
        [desktopBtn, mobileBtn].forEach(btn => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-shopping-cart mr-2"></i> Add to Cart';
                btn.classList.add('floral-btn');
                btn.classList.remove('bg-gray-400', 'opacity-60', 'cursor-not-allowed');
            }
        });

        // Buy Now stays normal
        if (buyNowBtn) {
            buyNowBtn.disabled = false;
            buyNowBtn.textContent = 'Buy Now'; // ← Keep original text!
            buyNowBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        }

    } else {
        // IN STOCK – Normal state
        [desktopBtn, mobileBtn].forEach(btn => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-shopping-cart mr-2"></i> Add to Cart';
                btn.classList.add('floral-btn');
                btn.classList.remove('bg-gray-400', 'opacity-60', 'cursor-not-allowed');
            }
        });

        // Buy Now normal
        if (buyNowBtn) {
            buyNowBtn.disabled = false;
            buyNowBtn.textContent = 'Buy Now';
            buyNowBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        }
    }

    // Insert badge ABOVE quantity selector (only if not out of stock)
    const qtySection = document.getElementById('quantity-selector');
    if (qtySection && qty > 0) {
        qtySection.before(stockEl);
    }
}

    renderImages() {
        const product = this.currentProduct;
        if (!product || !product.images || product.images.length === 0) {
            console.warn(`[ProductDetailManager] No valid images to render for product`);
            product.images = [];
            product.thumbnails = [];
        }
        console.log(`[ProductDetailManager] Rendering images for product: ${product.name}`);

        const mainImgEl = document.getElementById('mainProductImage');
        if (mainImgEl && product.images[0]) {
            mainImgEl.src = product.images[0];
            mainImgEl.alt = product.name;
            const mainImageSection = document.getElementById('mainImageSection');
            if (mainImageSection) mainImageSection.classList.remove('hidden');
        }

        const thumbnailsHtml = product.images.map((image, index) => `
            <div class="thumbnail-container rounded-lg overflow-hidden border-2 ${index === 0 ? 'border-primary' : 'border-gray-200'} shadow-sm" 
                 onclick="productManager.changeMainImage(${index})">
                <img src="${image}" alt="${product.name}" class="w-full h-24 object-cover hover:opacity-90 transition-all">
            </div>
        `).join('');
        const thumbnailGalleryEl = document.getElementById('thumbnailGalleryContent');
        if (thumbnailGalleryEl) {
            thumbnailGalleryEl.innerHTML = thumbnailsHtml;
            thumbnailGalleryEl.classList.remove('hidden');
        }
    }


    renderSizes() {
    const product = this.currentProduct;
    const sizeSelectionEl = document.getElementById('sizeSelection');
    if (!product || !product.sizes || product.sizes.length === 0 || !sizeSelectionEl) {
        console.log(`[ProductDetailManager] No sizes to render`);
        if (sizeSelectionEl) sizeSelectionEl.classList.add('hidden');
        return;
    }

    console.log(`[ProductDetailManager] Rendering sizes for: ${product.name}`);
    sizeSelectionEl.classList.remove('hidden');

    const sizesHtml = product.sizes.map(size => `
        <button 
            data-size-value="${size.value}"
            class="size-option p-4 border rounded-lg text-center text-sm transition-all
                   ${this.selectedSize?.value === size.value ? 'floweraura-option-active' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}">
            <div class="font-semibold">${size.label}</div>
            <div class="text-primary font-bold mt-1">₹${size.price}</div>
        </button>
    `).join('');

    const sizeOptionsEl = document.getElementById('sizeOptions');
    if (sizeOptionsEl) {
        sizeOptionsEl.innerHTML = sizesHtml;
    }
}

    renderAddons() {
    console.log(`[ProductDetailManager] Rendering add-ons`);
    const addonsContainer = document.querySelector('#addonsSelection .grid');
    if (!addonsContainer) {
        console.error('[ProductDetailManager] Addons container not found');
        return;
    }

    addonsContainer.innerHTML = '';  // Clear first

    this.addonsData.forEach(addon => {
        const count = this.selectedAddons.get(addon.itemKey) || 0;

        const addonCard = document.createElement('div');
        addonCard.className = `rounded-xl bg-white p-4 border ${count > 0 ? 'border-primary shadow-lg ring-2 ring-primary ring-opacity-20' : 'border-gray-200'} transition-all hover:shadow-md cursor-pointer`;
        addonCard.dataset.item = addon.itemKey;

        addonCard.innerHTML = `
            <img src="${addon.imageUrl || '/IMG/addon-placeholder.png'}" 
                 alt="${addon.name}" 
                 class="w-full h-36 object-cover rounded-lg mb-3"
                 onerror="this.src='/IMG/addon-placeholder.png'">
            <p class="text-sm font-bold text-gray-800 text-center">${addon.name}</p>
            <p class="text-primary font-bold text-center text-lg mt-1">₹${addon.price}</p>

            ${count > 0 ? `
            <div class="flex items-center justify-center mt-4 space-x-4">
                <button type="button" class="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xl minus-btn">−</button>
                <span class="text-2xl font-bold text-primary w-16 text-center">${count}</span>
                <button type="button" class="w-10 h-10 rounded-full bg-primary hover:bg-secondary text-white font-bold text-xl plus-btn">+</button>
            </div>
            ` : `
            <button type="button" class="add-addon-btn mt-4 w-full bg-primary hover:bg-secondary text-white py-3 rounded-lg font-bold text-lg transition">
                Add
            </button>
            `}
        `;

        // Attach event listeners properly (this was missing!)
        addonCard.addEventListener('click', (e) => {
            if (e.target.classList.contains('plus-btn')) {
                this.incrementAddon(addon.itemKey, 1);
            } else if (e.target.classList.contains('minus-btn')) {
                this.incrementAddon(addon.itemKey, -1);
            } else if (e.target.classList.contains('add-addon-btn')) {
                this.incrementAddon(addon.itemKey, 1);
            } else {
                // Click anywhere else on card = add one
                this.incrementAddon(addon.itemKey, 1);
            }
        });

        addonsContainer.appendChild(addonCard);
    });
}

    // NEW: Support multiple quantity for addons (not just 0/1)
incrementAddon(addonId, change) {
    const currentCount = this.selectedAddons.get(addonId) || 0;
    const newCount = Math.max(0, currentCount + change);

    if (newCount === 0) {
        this.selectedAddons.delete(addonId);
    } else {
        this.selectedAddons.set(addonId, newCount);
    }

    this.renderAddons();
    this.renderMainInfo();  // This updates price correctly
}

    renderTabs() {
        const product = this.currentProduct;
        if (!product) {
            console.error(`[ProductDetailManager] No product data for rendering tabs`);
            return;
        }
        console.log(`[ProductDetailManager] Rendering tabs for product: ${product.name}`);

        const productDescriptionEl = document.getElementById('productDescription');
        if (productDescriptionEl) productDescriptionEl.innerHTML = product.description || '';

        const tabReviewCountEl = document.getElementById('tabReviewCount');
        if (tabReviewCountEl) tabReviewCountEl.textContent = product.reviewCount || 0;

        if (product.specifications) {
            const specsHtml = Object.entries(product.specifications).map(([category, specs]) => `
                <div class="bg-gray-50 p-5 rounded-lg">
                    <h4 class="font-semibold text-gray-900 mb-3">${category}</h4>
                    ${Object.entries(specs).map(([key, value]) => `
                        <div class="flex justify-between py-2 border-b border-gray-200 last:border-0">
                            <span class="text-gray-600">${key}</span>
                            <span class="font-medium">${value}</span>
                        </div>
                    `).join('')}
                </div>
            `).join('');
            const productSpecsEl = document.getElementById('productSpecs');
            if (productSpecsEl) productSpecsEl.innerHTML = specsHtml;
        }

        if (product.ingredients) {
            const ingredientsHtml = Object.entries(product.ingredients).map(([category, items]) => `
                <div>
                    <h4 class="font-semibold text-gray-900 mb-3">${category}</h4>
                    <ul class="space-y-2">
                        ${items.map(item => `
                            <li class="flex items-center text-gray-700">
                                <i class="fas fa-leaf text-green-500 mr-2 text-sm"></i>
                                ${item}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `).join('');
            const ingredientsListEl = document.getElementById('ingredientsList');
            if (ingredientsListEl) ingredientsListEl.innerHTML = ingredientsHtml;
        }

        const allergenTextEl = document.getElementById('allergenText');
        if (allergenTextEl && product.allergens) allergenTextEl.textContent = product.allergens;
    }

    renderRelatedProducts() {
        console.log(`[ProductDetailManager] Rendering related products:`, this.relatedProducts);
        const relatedProductsEl = document.getElementById('relatedProducts');
        if (!relatedProductsEl) {
            console.warn(`[ProductDetailManager] No relatedProducts element found`);
            return;
        }
        const relatedHtml = this.relatedProducts.length > 0
            ? this.relatedProducts.map(product => `
                <div class="bg-white rounded-xl shadow-card overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                     onclick="window.location.href='?id=${product.id}'">
                    <div class="relative aspect-square overflow-hidden">
                        <img src="${product.images[0] || ''}" alt="${product.name}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300">
                    </div>
                    <div class="p-4">
                        <h3 class="font-semibold text-gray-900 mb-2 line-clamp-2">${product.name}</h3>
                        <div class="flex items-center justify-between">
                            <span class="text-primary font-bold">₹${product.price}</span>
                            <div class="flex items-center text-yellow-400 text-sm">
                                ${this.generateRatingStars(product.rating)}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')
            : '<p class="text-gray-500 text-center col-span-full">No related products found.</p>';
        relatedProductsEl.innerHTML = relatedHtml;
    }

    async addToCart() {
    if (!this.currentProduct) {
        this.showNotification('No product selected', 'error');
        return;
    }

    const addToCartBtn = document.getElementById('addToCartBtn');
    const mobileAddToCartBtn = document.getElementById('mobileAddToCart');
    if (addToCartBtn) addToCartBtn.disabled = true;
    if (mobileAddToCartBtn) mobileAddToCartBtn.disabled = true;
    if (addToCartBtn) addToCartBtn.innerHTML = 'Adding...';
    if (mobileAddToCartBtn) mobileAddToCartBtn.innerHTML = 'Adding...';

    try {
        const size = this.selectedSize?.value || 'free size';

        // CRITICAL: Build addonIds exactly as backend expects
        const addonIds = Array.from(this.selectedAddons.entries())
            .filter(([_, qty]) => qty > 0)
            .map(([addonItemKey, qty]) => {
                const addon = this.addonsData.find(a => a.itemKey === addonItemKey);
                if (!addon) return null;
                return {
                    id: Number(addon.id),        // This must be Long in backend
                    quantity: qty                // This is the count
                };
            })
            .filter(Boolean);

        console.log('[ADD TO CART] Selected Addons →', addonIds);
        console.log('[ADD TO CART] Full selectedAddons Map →', Object.fromEntries(this.selectedAddons));

       const payload = {
            userId: Number(window.apiService.getUserId()),
            productId: Number(this.currentProduct.id),
            quantity: this.currentQuantity,
            size: size,
            itemType: "PRODUCT",
            addonIds: Array.from(this.selectedAddons.entries())  // ADD-CART EXPECTS "addonIds"
                .filter(([_, qty]) => qty > 0)
                .map(([addonItemKey, qty]) => {
                    const addon = this.addonsData.find(a => a.itemKey === addonItemKey);
                    return { id: Number(addon.id), quantity: qty };
                })
        };

        console.log('[ADD TO CART] Sending →', payload);
        console.log('[ADD TO CART] FINAL PAYLOAD SENT →', JSON.stringify(payload, null, 2));

        if (!window.apiService.getUserId()) {
            this.showNotification('Please login to add to cart', 'error');
            return;
        }

        const response = await fetch(`${window.apiService.baseUrl}/cart/add-cart-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('[ADD TO CART] Backend Response →', result);

        if (!response.ok) {
            throw new Error(result.error || 'Failed to add');
        }

        this.showNotification(`Added! ×${this.currentQuantity} with ${addonIds.length} addon(s)`, 'success');
        window.apiService.updateGlobalCounts();

        // Reset buttons
        setTimeout(() => {
            if (addToCartBtn) {
                addToCartBtn.innerHTML = 'Add to Cart';
                addToCartBtn.disabled = false;
            }
            if (mobileAddToCartBtn) {
                mobileAddToCartBtn.innerHTML = 'Add to Cart';
                mobileAddToCartBtn.disabled = false;
            }
        }, 1500);

    } catch (error) {
        console.error('[ADD TO CART] ERROR →', error);
        this.showNotification('Failed: ' + error.message, 'error');

        if (addToCartBtn) {
            addToCartBtn.innerHTML = 'Add to Cart';
            addToCartBtn.disabled = false;
        }
        if (mobileAddToCartBtn) {
            mobileAddToCartBtn.innerHTML = 'Add to Cart';
            mobileAddToCartBtn.disabled = false;
        }
    }
}

    buyNow() {
        console.log(`[ProductDetailManager] Initiating buy now`);
        this.addToCart();
        window.location.href = 'checkout.html';
    }

    shareProduct() {
        console.log(`[ProductDetailManager] Sharing product: ${this.currentProduct.name}`);
        if (navigator.share) {
            navigator.share({
                title: this.currentProduct.name,
                text: `Check out this amazing ${this.currentProduct.name}!`,
                url: window.location.href
            });
        } else {
            navigator.clipboard.writeText(window.location.href);
            this.showNotification('Product link copied to clipboard!', 'success');
        }
    }

    // showNotification(message, type = 'info') {
    //     console.log(`[ProductDetailManager] Showing notification: ${message} (${type})`);
    //     const notification = document.createElement('div');
    //     notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white ${
    //         type === 'success' ? 'bg-green-500' : 
    //         type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    //     }`;
    //     notification.textContent = message;
    //     document.body.appendChild(notification);
    //     setTimeout(() => {
    //         notification.remove();
    //     }, 3000);
    // }

    showNotification(message, type = 'info') {
    this.showToast(message, type);
}

    showLoading() {
        console.log(`[ProductDetailManager] Showing skeleton loader`);
        const skeletonImage = document.getElementById('skeletonImage');
        const skeletonInfo = document.getElementById('skeletonInfo');
        const productContent = document.getElementById('productContent');
        if (skeletonImage) skeletonImage.classList.remove('hidden');
        if (skeletonInfo) skeletonInfo.classList.remove('hidden');
        if (productContent) productContent.classList.remove('hidden');
        const mainImageSection = document.getElementById('mainImageSection');
        const thumbnailGalleryContent = document.getElementById('thumbnailGalleryContent');
        const productInfoContent = document.getElementById('productInfoContent');
        if (mainImageSection) mainImageSection.classList.add('hidden');
        if (thumbnailGalleryContent) thumbnailGalleryContent.classList.add('hidden');
        if (productInfoContent) productInfoContent.classList.add('hidden');
    }

    hideLoading() {
        console.log(`[ProductDetailManager] Hiding skeleton loader`);
        const skeletonImage = document.getElementById('skeletonImage');
        const skeletonInfo = document.getElementById('skeletonInfo');
        const productInfoContent = document.getElementById('productInfoContent');
        if (skeletonImage) skeletonImage.classList.add('hidden');
        if (skeletonInfo) skeletonInfo.classList.add('hidden');
        if (productInfoContent) productInfoContent.classList.remove('hidden');
    }

    showError(message = 'Failed to load product details. Please try again.') {
        console.error(`[ProductDetailManager] Showing error: ${message}`);
        this.showNotification(message, 'error');
        const errorStateEl = document.getElementById('errorState');
        if (errorStateEl) errorStateEl.classList.remove('hidden');
    }

    updateGlobalCounts() {
        console.log(`[ProductDetailManager] Updating global counts`);
        const wishlistCountEl = document.getElementById('wishlist-count');
        if (wishlistCountEl) {
            const wishlistDetails = JSON.parse(localStorage.getItem('wishlistDetails') || '[]');
            wishlistCountEl.textContent = wishlistDetails.length;
        }

        const cartCountEl = document.getElementById('cart-count');
        if (cartCountEl) {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
            cartCountEl.textContent = totalItems;
        }
    }

    generateRatingStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;
        let starsHtml = '';
        for (let i = 0; i < fullStars; i++) {
            starsHtml += '';
        }
        if (hasHalfStar) {
            starsHtml += '';
        }
        const emptyStars = 5 - Math.ceil(rating);
        for (let i = 0; i < emptyStars; i++) {
            starsHtml += '';
        }
        return starsHtml;
    }

    changeMainImage(index) {
        const product = this.currentProduct;
        if (!product || !product.images[index]) {
            console.error(`[ProductDetailManager] Invalid image index: ${index}`);
            return;
        }
        console.log(`[ProductDetailManager] Changing main image to index: ${index}`);
        const mainImgEl = document.getElementById('mainProductImage');
        if (mainImgEl) mainImgEl.src = product.images[index];

        const thumbnails = document.querySelectorAll('#thumbnailGalleryContent > div');
        thumbnails.forEach((thumb, i) => {
            thumb.classList.toggle('border-primary', i === index);
            thumb.classList.toggle('border-gray-200', i !== index);
        });
        this.currentImageIndex = index;
    }


    selectSize(val) {
        const selected = this.currentProduct.sizes.find(s => s.value === val);
        if (!selected) {
            console.warn(`[ProductDetailManager] Size not found: ${val}`);
            return;
        }

        this.selectedSize = selected;
        this.currentProduct.price = selected.price;

        console.log(`[ProductDetailManager] Size selected: ${selected.label} → ₹${selected.price}`);

        // Force re-render with microtask to avoid race condition
        setTimeout(() => {
            this.renderMainInfo();
            this.renderSizes();
            this.updateStockUI();
        }, 0);
    }



   // ==================== TOASTIFY NOTIFICATION (CLASS KE ANDAR DAAL DE) ====================
showToast(message, type = 'success') {
    let background = '#10b981'; // green
    if (type === 'error') background = '#ef4444';
    if (type === 'warning') background = '#f59e0b';
    if (type === 'info') background = '#3b82f6';

    Toastify({
        text: message,
        duration: 3500,
        close: true,
        gravity: "center",
        position: "center",
        stopOnFocus: true,
        style: {
            background: background,
            borderRadius: "16px",
            padding: "20px 32px",
            fontSize: "18px",
            fontWeight: "bold",
            boxShadow: "0 15px 35px rgba(0,0,0,0.3)",
            textAlign: "center"
        }
    }).showToast();
}

// ==================== BACKEND WISHLIST - FINAL & PERFECT ====================
async toggleWishlistBackend(btn, productId, itemType = 'PRODUCT') {
    event.stopPropagation();

    if (!window.apiService?.getUserId()) {
        this.showToast("Please login to add to wishlist", "warning");
        setTimeout(() => window.location.href = '/login.html', 1500);
        return;
    }

    const isActive = btn.classList.contains('active');

    try {
        if (isActive) {
            // REMOVE — ab sahi tarike se itemType bhej raha hai
            await window.apiService.removeFromWishlist(productId, itemType);

            // UI update
            btn.classList.remove('active');
            btn.innerHTML = `<i class="far fa-heart text-lg"></i>`;
            btn.dataset.wid = '';
            this.showToast('Removed from wishlist', 'success');

            // Optional: force heart refresh
            if (typeof this.markWishlistedHeart === 'function') {
                this.markWishlistedHeart();
            }

        } else {
            // ADD
            await window.apiService.addToWishlist(productId, itemType);

            btn.classList.add('active');
            btn.innerHTML = `<i class="fas fa-heart text-red-500 text-lg"></i>`;
            this.showToast('Added to wishlist', 'success');

            // Get correct wishlistItemId using itemType
            const list = await window.apiService.getWishlist();
            const item = list.find(i => {
                if (itemType === 'CUSTOMIZE_CAKE') return i.customizeCakeId == productId;
                if (itemType === 'SNACK') return i.snackId == productId;
                return i.productId == productId;
            });

            if (item?.wishlistItemId) {
                btn.dataset.wid = item.wishlistItemId;
            }
        }

        await window.apiService.updateWishlistCount();

    } catch (err) {
        console.error('Wishlist error:', err);
        this.showToast('Failed to update wishlist', 'error');
    }
}

// ==================== AUTO MARK HEART RED ON PAGE LOAD & AFTER RENDER ====================
async markWishlistedHeart() {
    if (!window.apiService?.getUserId() || !this.currentProduct) return;

    const btn = document.getElementById('wishlistBtn');
    if (!btn) return;

    try {
        const wishlist = await window.apiService.getWishlist();
        const currentId = Number(this.currentProduct.id);

        // Pehle heart clear kar do (important!)
        btn.classList.remove('active');
        btn.innerHTML = `<i class="far fa-heart text-lg"></i>`;
        btn.dataset.wid = '';
        btn.dataset.type = 'PRODUCT'; // ya jo bhi page hai uske hisaab se

        // Ab check karo ki yeh item wishlist mein hai ya nahi
        const item = wishlist.find(w => {
            return (
                (w.itemType === 'CUSTOMIZE_CAKE' && w.customizeCakeId == currentId) ||
                (w.itemType === 'PRODUCT' && w.productId == currentId) ||
                (w.itemType === 'SNACK' && w.snackId == currentId)
            );
        });

        if (item) {
            btn.classList.add('active');
            btn.innerHTML = `<i class="fas fa-heart text-red-500 text-lg"></i>`;
            btn.dataset.wid = item.wishlistItemId || '';
            console.log('%cHeart marked RED for ID:', 'color: #ef4444; font-weight: bold;', currentId, item.itemType);
        } else {
            console.log('%cHeart remains white for ID:', 'color: #6b7280;', currentId);
        }

    } catch (err) {
        console.warn('Wishlist heart update failed (CORS safe)', err);
        // Fail hone pe bhi UI safe rakho
        btn.innerHTML = `<i class="far fa-heart text-lg"></i>`;
    }
}



    // localToggleWishlist(button, productId) {
    //     console.log(`[ProductDetailManager] Toggling wishlist for product ID: ${productId}`);
    //     let wishlistDetails = JSON.parse(localStorage.getItem('wishlistDetails') || '[]');
    //     const product = this.currentProduct;
    //     const isInWishlist = wishlistDetails.some(item => item.id === productId);

    //     if (isInWishlist) {
    //         wishlistDetails = wishlistDetails.filter(item => item.id !== productId);
    //         if (button) {
    //             button.innerHTML = 'Wishlist';
    //             button.classList.remove('text-red-500');
    //         }
    //         this.showNotification('Removed from wishlist!', 'success');
    //     } else {
    //         wishlistDetails.push({
    //             id: product.id,
    //             name: product.name,
    //             price: product.price,
    //             image: product.images[0] || '',
    //             category: product.category
    //         });
    //         if (button) {
    //             button.innerHTML = 'Remove from Wishlist';
    //             button.classList.add('text-red-500');
    //         }
    //         this.showNotification('Added to wishlist!', 'success');
    //     }

    //     localStorage.setItem('wishlistDetails', JSON.stringify(wishlistDetails));
    //     this.updateGlobalCounts();
    // }

    


    // --- Updated for event delegation ---
    setupEventListeners() {
        console.log(`[ProductDetailManager] Setting up event listeners`);
        const decreaseQtyEl = document.getElementById('decreaseQty');
        if (decreaseQtyEl) {
            decreaseQtyEl.addEventListener('click', () => {
                if (this.currentQuantity > 1) {
                    this.currentQuantity--;
                    console.log(`[ProductDetailManager] Decreased quantity to: ${this.currentQuantity}`);
                    const quantityEl = document.getElementById('quantity');
                    if (quantityEl) quantityEl.textContent = this.currentQuantity;
                    this.renderMainInfo();
                }
            });
        }

        const increaseQtyEl = document.getElementById('increaseQty');
        if (increaseQtyEl) {
            increaseQtyEl.addEventListener('click', () => {
                this.currentQuantity++;
                console.log(`[ProductDetailManager] Increased quantity to: ${this.currentQuantity}`);
                const quantityEl = document.getElementById('quantity');
                if (quantityEl) quantityEl.textContent = this.currentQuantity;
                this.renderMainInfo();
            });
        }

        const addToCartBtnEl = document.getElementById('addToCartBtn');
        if (addToCartBtnEl) addToCartBtnEl.addEventListener('click', () => this.addToCart());

        const mobileAddToCartEl = document.getElementById('mobileAddToCart');
        if (mobileAddToCartEl) mobileAddToCartEl.addEventListener('click', () => this.addToCart());

        const buyNowBtnEl = document.getElementById('buyNowBtn');
        if (buyNowBtnEl) buyNowBtnEl.addEventListener('click', () => this.buyNow());

        const wishlistBtnEl = document.getElementById('wishlistBtn');
        if (wishlistBtnEl) {
            wishlistBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const product = this.currentProduct;
                console.log(`[ProductDetailManager] Toggling wishlist for product ID: ${product.id}`);
               this.toggleWishlistBackend(wishlistBtnEl, product.id, 'PRODUCT');
            });
        }

        const shareBtnEl = document.getElementById('shareBtn');
        if (shareBtnEl) shareBtnEl.addEventListener('click', () => this.shareProduct());

        // Use event delegation for add-on cards
        const addonsContainer = document.querySelector('#addonsSelection .grid');
        if (addonsContainer) {
            addonsContainer.addEventListener('click', (e) => {
                const addonCard = e.target.closest('.addon-card');
                if (addonCard) {
                    const itemId = addonCard.dataset.item;
                    this.incrementAddon(itemId);
                }
            });
        }

        // Add this inside setupEventListeners() — right after other listeners
        const sizeOptionsContainer = document.getElementById('sizeOptions');
        if (sizeOptionsContainer) {
            sizeOptionsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-size-value]');
                if (btn) {
                    const sizeValue = btn.dataset.sizeValue;
                    console.log(`[ProductDetailManager] Size button clicked: ${sizeValue}`);
                    this.selectSize(sizeValue);
                }
            });
        }

        
    }
    // --- End of changes ---
}

function openTab(tabName) {
    console.log(`[Global] Opening tab: ${tabName}`);
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('floweraura-tab-active');
        btn.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    });
    const selectedTabEl = document.getElementById(tabName);
    if (selectedTabEl) selectedTabEl.classList.remove('hidden');
    if (event && event.target) {
        event.target.classList.add('floweraura-tab-active');
        event.target.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('[Global] DOMContentLoaded event fired');
    window.productManager = new ProductDetailManager();
    window.productManager.init();
});