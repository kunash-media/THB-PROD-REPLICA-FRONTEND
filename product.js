// products.js - User-facing product page (SHOWS REAL BACKEND DATA)
class BakeryApiService {
    constructor() {
        this.baseUrl = 'http://localhost:8082/api/v1/products';
    }

    async getAllProducts(page = 0, size = 100) {
        try {
            const url = `${this.baseUrl}/get-all-products?page=${page}&size=${size}`;
            console.log('🔄 Fetching REAL products from:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to fetch products`);
            }

            const result = await response.json();
            console.log('📦 RAW API RESPONSE:', result);
            
            // Ensure data.content exists, fallback to empty
            return result.data && result.data.content ? result.data.content : [];
        } catch (error) {
            console.error('❌ Error fetching products:', error);
            throw error;
        }
    }

    async getProductsByCategory(category, page = 0, size = 100) {
        try {
            const url = `${this.baseUrl}/category/${encodeURIComponent(category)}?page=${page}&size=${size}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch category products: ${response.status}`);
            }

            const result = await response.json();
            // Ensure data.content exists, fallback to empty
            return result.data && result.data.content ? result.data.content : [];
        } catch (error) {
            console.error('Error fetching category products:', error);
            throw error;
        }
    }

    async getProductById(productId) {
        try {
            const url = `${this.baseUrl}/${productId}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch product: ${response.status}`);
            }

            const result = await response.json();
            return result.data; // Extract data from ApiResponse
        } catch (error) {
            console.error('Error fetching product by ID:', error);
            throw error;
        }
    }

    async searchProductsByName(name) {
        try {
            const url = `${this.baseUrl}/search/${encodeURIComponent(name)}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to search products: ${response.status}`);
            }

            const result = await response.json();
            return result.data || []; // Extract data, fallback empty
        } catch (error) {
            console.error('Error searching products by name:', error);
            throw error;
        }
    }

    // Other methods unchanged (e.g., checkProductExists, getProductCount, etc.) – they already handle ApiResponse.data
    async checkProductExists(productId) {
        try {
            const url = `${this.baseUrl}/exists/${productId}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to check product existence: ${response.status}`);
            }

            const result = await response.json();
            return result.data; // Extract boolean from ApiResponse
        } catch (error) {
            console.error('Error checking product existence:', error);
            throw error;
        }
    }

    async getProductCount() {
        try {
            const url = `${this.baseUrl}/count`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch product count: ${response.status}`);
            }

            const result = await response.json();
            return result.data; // Extract count from ApiResponse
        } catch (error) {
            console.error('Error fetching product count:', error);
            throw error;
        }
    }

    async getProductsByFoodType(foodType) {
        try {
            const url = `${this.baseUrl}/food-type/${encodeURIComponent(foodType)}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch products by food type: ${response.status}`);
            }

            const result = await response.json();
            return result.data || []; // Extract list from ApiResponse
        } catch (error) {
            console.error('Error fetching products by food type:', error);
            throw error;
        }
    }

    async getProductImage(productId) {
        try {
            const url = `${this.baseUrl}/${productId}/image`;
            const response = await fetch(url);
            
            if (!response.ok) {
                console.warn(`Image not found for product ${productId}, using backend 404 handling`);
                throw new Error('Image not found'); // Let caller handle
            }

            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('Error fetching product image:', error);
            throw error; // No placeholder – rely on backend
        }
    }

    async getProductSubImage(productId, index) {
        try {
            const url = `${this.baseUrl}/${productId}/subimage/${index}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch product sub-image: ${response.status}`);
            }

            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (error) {
            console.error('Error fetching product sub-image:', error);
            throw error;
        }
    }
}

// Initialize API services
const bakeryApi = new BakeryApiService();

// Global variables
let allProducts = []; // Stores RAW API products
let categories = [];

// Fetch ALL products from backend
async function fetchAllProducts(retryCount = 0) {
    try {
        console.log('🚀 Starting to fetch REAL products from backend...');
        const products = await bakeryApi.getAllProducts(0, 1000); // returns array
        console.log(`✅ Successfully fetched ${products.length} REAL products from backend`);
        console.log('📝 Sample product:', products[0]);
        return products;
    } catch (error) {
        console.error('💥 Error in fetchAllProducts:', error);
        if ((String(error.message || '').includes('404') || String(error.message || '').includes('Failed to fetch')) && retryCount < 1) {
            console.log('Retrying fetchAllProducts...');
            return await fetchAllProducts(retryCount + 1);
        }
        // showNotification('Failed to load products from server', 'error');
        return [];
    }
}

// Extract unique categories from REAL products
function extractCategories(products) {
    if (!products || products.length === 0) {
        console.warn('⚠️ No products found for category extraction');
        return [];
    }
    
    const catSet = new Set();
    
    products.forEach(product => {
        if (product.productCategory) {
            catSet.add(product.productCategory);
        }
    });
    
    const categories = Array.from(catSet).sort();
    console.log('🏷️ Extracted REAL categories:', categories);
    return categories;
}

// Render categories in sidebar
function renderCategories(cats) {
    // Prefer page-specific sidebar if present
    const list = document.getElementById('category-list');
    if (!list) {
        console.warn('⚠️ Category list element not found; skipping category sidebar render');
        return;
    }
    
    if (cats.length === 0) {
        list.innerHTML = '<li class="text-gray-500 px-3 py-2">No categories found</li>';
        return;
    }
    
    list.innerHTML = `
        <li>
            <a href="#" class="block px-3 py-2 text-sm text-gray-800 hover:text-primary hover:bg-gray-50 rounded-md transition-colors duration-200 font-medium" onclick="loadAllProducts(event)">
                <i class="fas fa-th-large mr-2"></i>All Products
            </a>
        </li>
        ${cats.map(cat => `
            <li>
                <a href="#" class="block px-3 py-2 text-sm text-gray-800 hover:text-primary hover:bg-gray-50 rounded-md transition-colors duration-200" onclick="loadCategoryProducts('${cat}', event)">
                    <i class="fas fa-tag mr-2"></i>${cat}
                </a>
            </li>
        `).join('')}
    `;
    
    console.log(`✅ Rendered ${cats.length} REAL categories`);
}

// Map REAL API product to display format
async function mapProduct(apiProduct) {
    console.log('🔄 Mapping API product:', apiProduct); // Debug
    
    // Handle image URL properly using backend endpoint
    let imageUrl;
    try {
        imageUrl = await bakeryApi.getProductImage(apiProduct.productId);
    } catch (error) {
        console.warn('Failed to load product image for', apiProduct.productName, ':', error.message);
        throw error; // Let caller handle no image
    }
    
    const mappedProduct = {
        id: apiProduct.productId,
        name: apiProduct.productName,
        price: apiProduct.productNewPrice,
        rating: apiProduct.ratings || 0,
        image: imageUrl,
        category: apiProduct.productCategory,
        reviewCount: apiProduct.reviews || 0,
        originalPrice: apiProduct.productOldPrice,
        deliveryType: apiProduct.deliveryTime ? `${apiProduct.deliveryTime} Delivery` : null,
        badge: apiProduct.productDiscount ? { 
            text: apiProduct.productDiscount, 
            color: 'bg-red-500' 
        } : null,
        description: apiProduct.description || '',
        foodType: apiProduct.productFoodType || ''
    };
    
    console.log('✅ Mapped product:', mappedProduct); // Debug
    return mappedProduct;
}

// Render REAL products (always maps raw API products inside)
async function renderProducts(rawProducts) {
    // Prefer page-specific grid if present; fallback to generic container
    const container = document.getElementById('product-grid') || document.getElementById('products-container');
    if (!container) {
        console.error('❌ Products container element not found (looked for #product-grid and #products-container)');
        return;
    }
    
    console.log(`🔄 Rendering ${rawProducts.length} REAL products`);
    
    if (rawProducts.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500 text-lg">No products available</p>
                <p class="text-gray-400 text-sm mt-2">Products added in admin will appear here</p>
            </div>
        `;
        return;
    }

    // Map products asynchronously for images
    const mappedProducts = await Promise.all(rawProducts.map(mapProduct));
    
    const cardsHTML = mappedProducts.map(product => `
        <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 relative">
            ${product.badge ? `
                <div class="absolute top-3 left-3 ${product.badge.color} text-white px-3 py-1 rounded-md text-sm font-medium z-10">
                    ${product.badge.text}
                </div>
            ` : ''}
            
            <div class="relative h-48 bg-gray-100 overflow-hidden">
                <img 
                    src="${product.image}" 
                    alt="${product.name}" 
                    class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    onerror="this.onerror=null; this.src='/images/placeholder-product.jpg';" // Fallback only on img error
                >
            </div>
            
            <div class="p-4">
                <div class="flex items-start justify-between mb-2">
                    <h3 class="font-semibold text-gray-800 text-lg flex-1">${product.name}</h3>
                    <span class="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full capitalize">
                        ${product.foodType || 'Bakery'}
                    </span>
                </div>
                
                <p class="text-gray-600 text-sm mb-3 line-clamp-2">${product.description}</p>
                
                <div class="flex items-center mb-2">
                    <span class="text-lg font-bold text-gray-900">₹${product.price}</span>
                    ${product.originalPrice ? `
                        <span class="text-sm text-gray-500 line-through ml-2">₹${product.originalPrice}</span>
                    ` : ''}
                </div>
                
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center">
                        <span class="text-yellow-500 flex items-center">
                            <i class="fas fa-star mr-1"></i>${product.rating}
                        </span>
                        <span class="text-sm text-gray-600 ml-2">(${product.reviewCount} reviews)</span>
                    </div>
                    ${product.deliveryType ? `
                        <span class="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                            <i class="fas fa-shipping-fast mr-1"></i>${product.deliveryType}
                        </span>
                    ` : ''}
                </div>
                
                <div class="flex space-x-2">
                    <button onclick="viewProduct(${product.id})" class="flex-1 bg-primary text-white py-2 px-4 rounded-lg text-sm hover:bg-primary-dark transition-colors duration-200 flex items-center justify-center">
                        <i class="fas fa-eye mr-2"></i>View
                    </button>
                    <button onclick="addToCart(${product.id})" class="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg text-sm hover:bg-green-600 transition-colors duration-200 flex items-center justify-center">
                        <i class="fas fa-shopping-cart mr-2"></i>Order
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = cardsHTML;
    console.log(`✅ Successfully rendered ${rawProducts.length} REAL products`);
}

// Load all REAL products
async function loadAllProducts(event) {
    if (event) event.preventDefault();
    
    console.log('🔄 Loading ALL REAL products...');
    showNotification('Loading latest products...', 'info');
    
    // Show loading state
    const container = document.getElementById('products-container');
    if (container) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p class="text-gray-500 mt-4">Loading fresh products from server...</p>
            </div>
        `;
    }
    
    const rawProducts = await fetchAllProducts();
    allProducts = rawProducts; // Store raw
    renderProducts(rawProducts);
    
    showNotification(`Loaded ${rawProducts.length} fresh products`, 'success');
}

// Load REAL products by category
async function loadCategoryProducts(category, event) {
    if (event) event.preventDefault();
    
    console.log(`🔄 Loading REAL products for category: ${category}`);
    showNotification(`Loading ${category}...`, 'info');
    
    // Show loading state
    const container = document.getElementById('products-container');
    if (container) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p class="text-gray-500 mt-4">Loading ${category} from server...</p>
            </div>
        `;
    }
    
    const rawProducts = await bakeryApi.getProductsByCategory(category, 0, 1000);
    renderProducts(rawProducts);
    showNotification(`Loaded ${rawProducts.length} ${category} products`, 'success');
}

// View product details
async function viewProduct(id) {
    console.log('👀 Viewing REAL product:', id);
    
    // Optionally fetch full product details
    try {
        const apiProduct = await bakeryApi.getProductById(id);
        if (apiProduct) {
            console.log('Full product details:', apiProduct);
            // Proceed to details page with full data if needed
        }
    } catch (error) {
        console.error('Error fetching product details:', error);
    }
    
    window.location.href = `product-details.html?id=${id}`;
}

// Add to cart function (uses raw productName)
function addToCart(id) {
    console.log('🛒 Adding REAL product to cart:', id);
    const rawProduct = allProducts.find(p => p.productId === id);
    if (rawProduct) {
        showNotification(`Added ${rawProduct.productName} to cart!`, 'success');
    } else {
        showNotification('Product not found in cart', 'error');
    }
}

// Search functionality (integrated with backend search endpoint)
async function performSearch(query) {
    if (!query || query.trim().length === 0) {
        loadAllProducts(); // Load all if empty
        return;
    }
    
    try {
        console.log('🔍 Searching products:', query);
        const rawProducts = await bakeryApi.searchProductsByName(query);
        renderProducts(rawProducts);
        showNotification(`Found ${rawProducts.length} results for "${query}"`, 'success');
        return rawProducts;
    } catch (error) {
        console.error('Error performing search:', error);
        showNotification('Search failed. Please try again.', 'error');
        return [];
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const bgColor = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    }[type] || 'bg-gray-500';
    
    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : type === 'warning' ? 'exclamation-circle' : 'info'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Initialize page with REAL data
async function initializePage(retryCount = 0) {
    console.log('🚀 INITIALIZING USER PRODUCT PAGE WITH REAL BACKEND DATA');
    
    try {
        // showNotification('Connecting to bakery server...', 'info');
        
        const rawProducts = await fetchAllProducts(retryCount);
        allProducts = rawProducts; // Store raw
        categories = extractCategories(rawProducts);
        
        renderCategories(categories);
        renderProducts(rawProducts);
        
        console.log('✅ USER PAGE INITIALIZED WITH REAL DATA');
        // showNotification(`Welcome! Browse ${rawProducts.length} fresh products`, 'success');
        
    } catch (error) {
        console.error('💥 Failed to initialize page:', error);
        // Retry once
        if (retryCount < 1) {
            console.log('Retrying initializePage...');
            return await initializePage(retryCount + 1);
        }
        // showNotification('Failed to load products. Please refresh.');
        renderProducts([]); // Show empty state
    }
}

// Start when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM loaded, starting user product page with REAL data...');
    initializePage();

    // Ensure global counts show on pages that include this file
    if (window.apiService && typeof window.apiService.updateGlobalCounts === 'function') {
        window.apiService.updateGlobalCounts();
    } else {
        // Lazy load api-service if missing, then update counts
        const script = document.createElement('script');
        script.src = '/api-service.js';
        script.async = true;
        script.onload = () => {
            if (window.apiService && typeof window.apiService.updateGlobalCounts === 'function') {
                window.apiService.updateGlobalCounts();
            }
        };
        document.head.appendChild(script);
    }
});

// Make functions global
window.loadAllProducts = loadAllProducts;
window.loadCategoryProducts = loadCategoryProducts;
window.viewProduct = viewProduct;
window.addToCart = addToCart;
window.performSearch = performSearch;