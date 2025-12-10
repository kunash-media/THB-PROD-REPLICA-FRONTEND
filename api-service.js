class ApiService {
    constructor() {
        this.baseUrl = 'http://localhost:8082/api';
        this.userId = localStorage.getItem('userId') ? Number(localStorage.getItem('userId')) : null;
        console.log('%c[ApiService] Initialized with userId:', 'color: #10b981; font-weight: bold;', this.userId || 'Not logged in');
    }

    getUserId() {
        return this.userId;
    }

    setUserId(userId) {
        this.userId = Number(userId);
        localStorage.setItem('userId', this.userId);
        console.log('%c[ApiService] User ID set:', 'color: #60a5fa; font-weight: bold;', this.userId);
    }

    clearUserId() {
        this.userId = null;
        localStorage.removeItem('userId');
        console.log('%c[ApiService] User ID cleared (logged out)', 'color: #f87171; font-weight: bold;');
    }

    async request(url, options = {}) {
        try {
            console.log('%c→ API Request:', 'color: #a78bfa; font-weight: bold;', url, options);

            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...options.headers
                },
                ...options,
                mode: 'cors',
                credentials: 'include'
            };

            if (options.body && typeof options.body === 'object') {
                config.body = JSON.stringify(options.body);
            }

            const response = await fetch(url, config);
            console.log('%c← Response Status:', 'color: #fbbf24; font-weight: bold;', response.status);

            if (!response.ok) {
                let errorText = '';
                try { errorText = await response.text(); } catch (e) {}
                console.error('%cAPI Error:', 'color: #ef4444; font-weight: bold;', response.status, errorText);

                if (response.status === 401) {
                    this.clearUserId();
                    window.location.href = '/login.html';
                }

                throw new Error(`API Error: ${response.status} - ${errorText || response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                console.log('%cAPI Response Data:', 'color: #34d399; font-weight: bold;', data);
                return data;
            } else {
                console.log('%cAPI Response: Non-JSON', 'color: #94a3b8');
                return null;
            }
        } catch (error) {
            console.error('%cAPI Request Failed:', 'color: #ef4444; font-weight: bold;', error.message);
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                console.warn('%cCORS/Network issue — continuing safely', 'color: #fb923c; font-weight: bold;');
            }
            throw error;
        }
    }

    async getCurrentUser() {
        if (!this.userId) throw new Error('User not logged in');
        return this.request(`${this.baseUrl}/users/${this.userId}`);
    }

    async updateUser(userId, userData) {
        if (!this.userId) throw new Error('User not logged in');
        return this.request(`${this.baseUrl}/users/update/${userId}`, { method: 'PATCH', body: userData });
    }

    async changePassword(userId, oldPassword, newPassword) {
        if (!this.userId) throw new Error('User not logged in');
        return this.request(`${this.baseUrl}/users/change-password/${userId}`, {
            method: 'PATCH',
            body: { oldPassword, newPassword }
        });
    }

    async sendEmailOtp(email) {
        console.log('[ApiService] Sending email OTP to:', email);
        return this.request(`${this.baseUrl}/otp/send-email-body`, { method: 'POST', body: { email } });
    }

    async verifyEmailOtp(email, otp) {
        console.log('[ApiService] Verifying email OTP for:', email);
        return this.request(`${this.baseUrl}/otp/verify-email`, {
            method: 'POST',
            body: { email, otp }
        });
    }

    async resetPasswordWithOtp(email, otp, newPassword) {
        console.log('[ApiService] Resetting password with OTP');
        return this.request(`${this.baseUrl}/users/reset-password`, {
            method: 'POST',
            body: { email, otp, newPassword }
        });
    }

    async getUserAddresses(userId) {
        if (!this.userId) return [];
        try {
            const addresses = await this.request(`${this.baseUrl}/users/${userId}/shipping-addresses`);
            return Array.isArray(addresses) ? addresses : [];
        } catch (error) {
            console.error('[ApiService] Error fetching addresses:', error);
            return [];
        }
    }

    async createAddress(userId, addressData) {
        if (!this.userId) throw new Error('User not logged in');
        return this.request(`${this.baseUrl}/addresses/create-address/${userId}`, {
            method: 'POST',
            body: addressData
        });
    }

    async updateAddress(userId, shippingId, addressData) {
        if (!this.userId) throw new Error('User not logged in');
        return this.request(`${this.baseUrl}/addresses/patch-address/${userId}/${shippingId}`, {
            method: 'PATCH',
            body: addressData
        });
    }

    async deleteAddress(userId, shippingId) {
        if (!this.userId) throw new Error('User not logged in');
        return this.request(`${this.baseUrl}/addresses/delete-address/${userId}/${shippingId}`, {
            method: 'DELETE'
        });
    }

    // ==================== NEW WISHLIST APIs (2025) ====================


    async addToWishlist(productId, itemType = 'PRODUCT', idField = 'productId') {
    if (!this.userId) throw new Error('User not logged in');

    const payload = {
        userId: this.userId,
        [idField]: Number(productId),  // ← Yeh dynamic field ban gaya!
        itemType: itemType.toUpperCase()
    };

    console.log('%cAdding to Wishlist →', 'color: #ec4899; font-weight: bold;', payload);

    const res = await this.request(`${this.baseUrl}/wishlist/add-to-wishlist`, {
        method: 'POST',
        body: payload
    });

    await this.updateWishlistCount();
    return res;
}



    async getWishlist() {
    if (!this.userId) return [];

    try {
        const data = await this.request(`${this.baseUrl}/wishlist/get-wishlisted-items?userId=${this.userId}`);

        if (data.status === 'success' && Array.isArray(data.items)) {
            return data.items.map(item => ({
                wishlistItemId: item.wishlistItemId,
                productId: item.productId || null,
                snackId: item.snackId || null,
                customizeCakeId: item.customizeCakeId || null,
                name: item.name || 'Unknown Item',
                price: item.price || 0,
                image: item.image?.startsWith('http') 
                    ? item.image 
                    : `${this.baseUrl}${item.image || ''}` || '/IMG/placeholder-cake.jpg',
                itemType: item.itemType || 'PRODUCT'
            }));
        }
        return [];
    } catch (error) {
        console.warn('getWishlist failed (CORS safe) → returning []', error.message);
        return [];
    }
}

   



async removeFromWishlist(itemId, itemType = 'PRODUCT') {
    if (!this.userId) throw new Error('User not logged in');

    const payload = {
        userId: this.userId,
        itemType: itemType.toUpperCase()
    };

    if (itemType === 'PRODUCT') payload.productId = Number(itemId);
    else if (itemType === 'SNACK') payload.snackId = Number(itemId);
    else if (itemType === 'CUSTOMIZE_CAKE') payload.customizeCakeId = Number(itemId);

    await this.request(`${this.baseUrl}/wishlist/remove-wishlist-item`, {
        method: 'POST',
        body: payload
    });

    await this.updateWishlistCount();
}

    async clearWishlist() {
        if (!this.userId) return;

        await this.request(`${this.baseUrl}/wishlist/clear-wishlist`, {
            method: 'POST',
            body: { userId: this.userId }
        });

        await this.updateWishlistCount();
    }

    async updateWishlistCount() {
        const el = document.getElementById('wishlist-count');
        if (!el) return;

        if (!this.userId) {
            el.textContent = '0';
            el.style.display = 'none';
            return;
        }

        try {
            const items = await this.getWishlist();
            el.textContent = items.length;
            el.style.display = items.length > 0 ? 'flex' : 'none';
            console.log('%cWishlist badge updated →', 'color: #8b5cf6; font-weight: bold;', items.length);
        } catch (err) {
            el.textContent = '0';
            console.warn('Failed to update wishlist count');
        }
    }

    // ==================== ALL YOUR OLD CART & SYNC CODE (100% PRESERVED) ====================

    async addToCart(payload) {
        console.log('[ApiService] Adding to cart with addon quantities:', payload);
        try {
            const response = await fetch(`${this.baseUrl}/cart/add-cart-items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId || 0,
                    productId: Number(payload.productId),
                    snackId: payload.snackId ? Number(payload.snackId) : null,
                    quantity: Number(payload.quantity) || 1,
                    size: payload.size || '500g',
                    itemType: payload.itemType || 'PRODUCT',
                    addons: (payload.addons || []).map(a => ({
                        id: Number(a.id || a.addonId),
                        quantity: Number(a.quantity) || 1
                    }))
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to add to cart: ${errorText}`);
            }

            const data = await response.json();
            await this.updateGlobalCounts();
            return data;
        } catch (error) {
            console.error('[ApiService] Error adding to cart:', error);
            throw error;
        }
    }

    async getCart() {
        console.log('[ApiService] Fetching cart for userId:', this.userId);
        try {
            const url = this.userId
                ? `${this.baseUrl}/cart/get-cart-items?userId=${this.userId}`
                : `${this.baseUrl}/cart/get-cart-items?userId=0`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch cart');
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('[ApiService] Error fetching cart:', error);
            return [];
        }
    }

    async updateCartItem(productId, quantity, size, itemType = 'PRODUCT') {
        try {
            const cart = await this.getCart();
            const item = cart.find(i =>
                i.productId === Number(productId) &&
                i.size === (size || '500g') &&
                i.itemType === itemType
            );
            const addonIds = item && Array.isArray(item.addons) ? item.addons.map(a => Number(a.id)) : [];

            const response = await fetch(`${this.baseUrl}/cart/update-cart-items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId || 0,
                    productId: itemType === 'PRODUCT' ? Number(productId) : null,
                    snackId: itemType === 'SNACK' ? Number(productId) : null,
                    quantity: Number(quantity),
                    size: size || '500g',
                    itemType,
                    addonIds
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Update failed: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            await this.updateGlobalCounts();
            return data;
        } catch (error) {
            console.error('[ApiService] Error updating cart:', error);
            throw error;
        }
    }

    async removeFromCart(productId, size, itemType = 'PRODUCT') {
        try {
            const response = await fetch(`${this.baseUrl}/cart/remove-cart-items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId || 0,
                    productId: itemType === 'PRODUCT' ? Number(productId) : null,
                    snackId: itemType === 'SNACK' ? Number(productId) : null,
                    size: size || '500g',
                    itemType
                })
            });
            if (!response.ok) throw new Error('Failed to remove item');
            await this.updateGlobalCounts();
            return { success: true };
        } catch (error) {
            console.error('[ApiService] Error removing from cart:', error);
            throw error;
        }
    }

    async clearCart() {
        try {
            const response = await fetch(`${this.baseUrl}/cart/clear-cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.userId || 0 })
            });
            if (!response.ok) throw new Error('Failed to clear cart');
            await this.updateGlobalCounts();
            return await response.json();
        } catch (error) {
            console.error('[ApiService] Error clearing cart:', error);
            throw error;
        }
    }

    async mergeCartItems(items) {
        try {
            const payload = items
                .filter(item => {
                    const itemId = item.id || item.productId || item.snackId;
                    const isValid = itemId && !isNaN(Number(itemId)) &&
                                  item.quantity && !isNaN(Number(item.quantity)) &&
                                  item.size && item.itemType;
                    if (!isValid) console.warn('[ApiService] Skipping invalid item:', item);
                    return isValid;
                })
                .map(item => ({
                    userId: this.userId || 0,
                    productId: item.itemType === 'PRODUCT' ? Number(item.id || item.productId) : null,
                    snackId: item.itemType === 'SNACK' ? Number(item.id || item.snackId) : null,
                    quantity: Number(item.quantity),
                    size: item.size || 'free size',
                    itemType: item.itemType,
                    addons: Array.isArray(item.addons)
                        ? item.addons
                              .filter(a => a && a.id && !isNaN(Number(a.id)))
                              .map(a => ({ id: Number(a.id), quantity: Number(a.quantity) || 1 }))
                        : []
                }));

            if (payload.length === 0) return { success: true };

            const response = await fetch(`${this.baseUrl}/cart/merge-cart-items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Merge failed');
            await this.updateGlobalCounts();
            return await response.json();
        } catch (error) {
            console.error('[ApiService] Error merging cart:', error);
            throw error;
        }
    }

    async getAllAddons() {
        try {
            const response = await fetch(`${this.baseUrl}/addons/get-all-addon-items`);
            if (!response.ok) throw new Error('Failed to fetch addons');
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('[ApiService] Error fetching add-ons:', error);
            return [];
        }
    }

    async syncCart(localCart) {
        if (!localCart || localCart.length === 0) return;
        await this.mergeCartItems(localCart);
        localStorage.removeItem('cart');
    }

    async updateGlobalCounts() {
        try {
            const cartItems = await this.getCart();
            const cartCount = cartItems.length;
            const cartEl = document.getElementById('cart-count');
            if (cartEl) cartEl.textContent = cartCount > 0 ? cartCount : '0';

            if (this.userId) {
                await this.updateWishlistCount();
            }
        } catch (error) {
            console.warn('[ApiService] updateGlobalCounts failed (CORS safe)', error);
        }
    }

    _setCountBadge(id, count) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = count.toString();
            el.style.display = count > 0 ? 'flex' : 'none';
        }
    }
}

// Global instance
window.apiService = new ApiService();

// Safe init — no auto updateGlobalCounts on load (prevents CORS crash)
async function initializeBackendConnection() {
    if (!window.apiService) return;
    // Only sync cart if user is logged in
    if (window.apiService.userId) {
        const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
        if (localCart.length > 0) {
            try {
                await window.apiService.syncCart(localCart);
            } catch (e) {
                console.warn('Cart sync failed:', e);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', initializeBackendConnection);

console.log('%cApiService v2.0 Loaded — Wishlist Backend Ready!', 'color: #10b981; font-size: 16px; font-weight: bold; background: #000; padding: 4px 8px; border-radius: 4px;');













//========================================= PROD LIVE ===========================================//

// class ApiService {
//     constructor() {
//         this.baseUrl = 'http://localhost:8082/api';
//         this.userId = localStorage.getItem('userId') ? Number(localStorage.getItem('userId')) : null;
//         console.log('[ApiService] Initialized with userId:', this.userId);
//     }

//     getUserId() {
//         return this.userId;
//     }

//     setUserId(userId) {
//         this.userId = Number(userId);
//         localStorage.setItem('userId', this.userId);
//         console.log('[ApiService] User ID set:', this.userId);
//     }

//     clearUserId() {
//         this.userId = null;
//         localStorage.removeItem('userId');
//         console.log('[ApiService] User ID cleared');
//     }

//     async request(url, options = {}) {
//         try {
//             console.log('API Request:', url, options);

//             const config = {
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'Accept': 'application/json',
//                     ...options.headers
//                 },
//                 ...options,
//                 mode: 'cors',
//                 credentials: 'include'
//             };

//             if (options.body && typeof options.body === 'object') {
//                 config.body = JSON.stringify(options.body);
//             }

//             const response = await fetch(url, config);
//             console.log('Response Status:', response.status);

//             if (!response.ok) {
//                 let errorText = '';
//                 try { errorText = await response.text(); } catch (e) {}
//                 console.error('API Error:', response.status, errorText);

//                 if (response.status === 401) {
//                     this.clearUserId();
//                     window.location.href = '/login.html';
//                 }

//                 throw new Error(`API Error: ${response.status} - ${errorText || response.statusText}`);
//             }

//             const contentType = response.headers.get('content-type');
//             if (contentType && contentType.includes('application/json')) {
//                 const data = await response.json();
//                 console.log('API Response Data:', data);
//                 return data;
//             } else {
//                 console.log('API Response: Non-JSON');
//                 return null;
//             }
//         } catch (error) {
//             console.error('API Request Failed:', error);
//             if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
//                 throw new Error('Network error. Please check your internet connection.');
//             }
//             throw error;
//         }
//     }

//     async getCurrentUser() {
//         if (!this.userId) throw new Error('User not logged in');
//         return this.request(`${this.baseUrl}/users/${this.userId}`);
//     }

//     async updateUser(userId, userData) {
//         if (!this.userId) throw new Error('User not logged in');
//         return this.request(`${this.baseUrl}/users/update/${userId}`, { method: 'PATCH', body: userData });
//     }

//     async changePassword(userId, oldPassword, newPassword) {
//         if (!this.userId) throw new Error('User not logged in');
//         return this.request(`${this.baseUrl}/users/change-password/${userId}`, {
//             method: 'PATCH',
//             body: { oldPassword, newPassword }
//         });
//     }

//     async sendEmailOtp(email) {
//         console.log('[ApiService] Sending email OTP to:', email);
//         return this.request(`${this.baseUrl}/otp/send-email-body`, { method: 'POST', body: { email } });
//     }

//     async verifyEmailOtp(email, otp) {
//         console.log('[ApiService] Verifying email OTP for:', email);
//         return this.request(`${this.baseUrl}/otp/verify-email`, {
//             method: 'POST',
//             body: { email, otp }
//         });
//     }

//     async resetPasswordWithOtp(email, otp, newPassword) {
//         console.log('[ApiService] Resetting password with OTP');
//         return this.request(`${this.baseUrl}/users/reset-password`, {
//             method: 'POST',
//             body: { email, otp, newPassword }
//         });
//     }

//     async getUserAddresses(userId) {
//         if (!this.userId) return [];
//         try {
//             const addresses = await this.request(`${this.baseUrl}/users/${userId}/shipping-addresses`);
//             return Array.isArray(addresses) ? addresses : [];
//         } catch (error) {
//             console.error('[ApiService] Error fetching addresses:', error);
//             return [];
//         }
//     }

//     async createAddress(userId, addressData) {
//         if (!this.userId) throw new Error('User not logged in');
//         return this.request(`${this.baseUrl}/addresses/create-address/${userId}`, {
//             method: 'POST',
//             body: addressData
//         });
//     }

//     async updateAddress(userId, shippingId, addressData) {
//         if (!this.userId) throw new Error('User not logged in');
//         return this.request(`${this.baseUrl}/addresses/patch-address/${userId}/${shippingId}`, {
//             method: 'PATCH',
//             body: addressData
//         });
//     }

//     async deleteAddress(userId, shippingId) {
//         if (!this.userId) throw new Error('User not logged in');
//         return this.request(`${this.baseUrl}/addresses/delete-address/${userId}/${shippingId}`, {
//             method: 'DELETE'
//         });
//     }

//     async addToWishlist(productId) {
//         if (!this.userId) throw new Error('User not logged in');
//         const res = await this.request(`${this.baseUrl}/wishlist/add-wishlist-items`, {
//             method: 'POST',
//             body: { userId: this.userId, productId: Number(productId) }
//         });
//         await this.updateWishlistCount();
//         return res;
//     }

//     async getWishlist() {
//         if (!this.userId) return [];
//         const data = await this.request(`${this.baseUrl}/wishlist/get-wishlist-items?userId=${this.userId}`);
//         return Array.isArray(data) ? data.map(item => ({
//             id: item.productId?.toString(),
//             name: item.title || `Product ${item.productId}`,
//             price: item.price || 0,
//             image: item.imageUrl || '/IMG/placeholder-cake.jpg',
//             description: item.description || 'Delicious baked goodness',
//             productId: item.productId
//         })) : [];
//     }

//     async removeFromWishlist(productId) {
//         if (!this.userId) throw new Error('User not logged in');
//         await this.request(`${this.baseUrl}/wishlist/remove-wishlist-items`, {
//             method: 'POST',
//             body: { userId: this.userId, productId: Number(productId) }
//         });
//         await this.updateWishlistCount();
//     }

//     async clearWishlist() {
//         if (!this.userId) return;
//         await this.request(`${this.baseUrl}/wishlist/clear-wishlist`, {
//             method: 'POST',
//             body: { userId: this.userId }
//         });
//         await this.updateWishlistCount();
//     }

//     async updateWishlistCount() {
//         try {
//             const items = await this.getWishlist();
//             this._setCountBadge('wishlist-count', items.length);
//         } catch {
//             this._setCountBadge('wishlist-count', 0);
//         }
//     }

//     // FIXED: NOW SENDS ADDON QUANTITY
//     async addToCart(payload) {
//         console.log('[ApiService] Adding to cart with addon quantities:', payload);
//         try {
//             const response = await fetch(`${this.baseUrl}/cart/add-cart-items`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     userId: this.userId || 0,
//                     productId: Number(payload.productId),
//                     snackId: payload.snackId ? Number(payload.snackId) : null,
//                     quantity: Number(payload.quantity) || 1,
//                     size: payload.size || '500g',
//                     itemType: payload.itemType || 'PRODUCT',
//                     addons: (payload.addons || []).map(a => ({
//                         id: Number(a.id || a.addonId),
//                         quantity: Number(a.quantity) || 1
//                     }))
//                 })
//             });

//             if (!response.ok) {
//                 const errorText = await response.text();
//                 throw new Error(`Failed to add to cart: ${errorText}`);
//             }

//             const data = await response.json();
//             await this.updateGlobalCounts();
//             return data;
//         } catch (error) {
//             console.error('[ApiService] Error adding to cart:', error);
//             throw error;
//         }
//     }

//     async getCart() {
//         console.log('[ApiService] Fetching cart for userId:', this.userId);
//         try {
//             const url = this.userId
//                 ? `${this.baseUrl}/cart/get-cart-items?userId=${this.userId}`
//                 : `${this.baseUrl}/cart/get-cart-items?userId=0`;
//             const response = await fetch(url);
//             if (!response.ok) throw new Error('Failed to fetch cart');
//             const data = await response.json();
//             return Array.isArray(data) ? data : [];
//         } catch (error) {
//             console.error('[ApiService] Error fetching cart:', error);
//             return [];
//         }
//     }

//     async updateCartItem(productId, quantity, size, itemType = 'PRODUCT') {
//         try {
//             const cart = await this.getCart();
//             const item = cart.find(i =>
//                 i.productId === Number(productId) &&
//                 i.size === (size || '500g') &&
//                 i.itemType === itemType
//             );
//             const addonIds = item && Array.isArray(item.addons) ? item.addons.map(a => Number(a.id)) : [];

//             const response = await fetch(`${this.baseUrl}/cart/update-cart-items`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     userId: this.userId || 0,
//                     productId: itemType === 'PRODUCT' ? Number(productId) : null,
//                     snackId: itemType === 'SNACK' ? Number(productId) : null,
//                     quantity: Number(quantity),
//                     size: size || '500g',
//                     itemType,
//                     addonIds
//                 })
//             });

//             if (!response.ok) {
//                 const errorText = await response.text();
//                 throw new Error(`Update failed: ${response.status} - ${errorText}`);
//             }
//             const data = await response.json();
//             await this.updateGlobalCounts();
//             return data;
//         } catch (error) {
//             console.error('[ApiService] Error updating cart:', error);
//             throw error;
//         }
//     }

//     async removeFromCart(productId, size, itemType = 'PRODUCT') {
//         try {
//             const response = await fetch(`${this.baseUrl}/cart/remove-cart-items`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     userId: this.userId || 0,
//                     productId: itemType === 'PRODUCT' ? Number(productId) : null,
//                     snackId: itemType === 'SNACK' ? Number(productId) : null,
//                     size: size || '500g',
//                     itemType
//                 })
//             });
//             if (!response.ok) throw new Error('Failed to remove item');
//             await this.updateGlobalCounts();
//             return { success: true };
//         } catch (error) {
//             console.error('[ApiService] Error removing from cart:', error);
//             throw error;
//         }
//     }

//     async clearCart() {
//         try {
//             const response = await fetch(`${this.baseUrl}/cart/clear-cart`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({ userId: this.userId || 0 })
//             });
//             if (!response.ok) throw new Error('Failed to clear cart');
//             await this.updateGlobalCounts();
//             return await response.json();
//         } catch (error) {
//             console.error('[ApiService] Error clearing cart:', error);
//             throw error;
//         }
//     }

//     async mergeCartItems(items) {
//         try {
//             const payload = items
//                 .filter(item => {
//                     const itemId = item.id || item.productId || item.snackId;
//                     const isValid = itemId && !isNaN(Number(itemId)) &&
//                                   item.quantity && !isNaN(Number(item.quantity)) &&
//                                   item.size && item.itemType;
//                     if (!isValid) console.warn('[ApiService] Skipping invalid item:', item);
//                     return isValid;
//                 })
//                 .map(item => ({
//                     userId: this.userId || 0,
//                     productId: item.itemType === 'PRODUCT' ? Number(item.id || item.productId) : null,
//                     snackId: item.itemType === 'SNACK' ? Number(item.id || item.snackId) : null,
//                     quantity: Number(item.quantity),
//                     size: item.size || 'free size',
//                     itemType: item.itemType,
//                     addons: Array.isArray(item.addons)
//                         ? item.addons
//                               .filter(a => a && a.id && !isNaN(Number(a.id)))
//                               .map(a => ({ id: Number(a.id), quantity: Number(a.quantity) || 1 }))
//                         : []
//                 }));

//             if (payload.length === 0) return { success: true };

//             const response = await fetch(`${this.baseUrl}/cart/merge-cart-items`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(payload)
//             });

//             if (!response.ok) throw new Error('Merge failed');
//             await this.updateGlobalCounts();
//             return await response.json();
//         } catch (error) {
//             console.error('[ApiService] Error merging cart:', error);
//             throw error;
//         }
//     }

//     async getAllAddons() {
//         try {
//             const response = await fetch(`${this.baseUrl}/addons/get-all-addon-items`);
//             if (!response.ok) throw new Error('Failed to fetch addons');
//             const data = await response.json();
//             return Array.isArray(data) ? data : [];
//         } catch (error) {
//             console.error('[ApiService] Error fetching add-ons:', error);
//             return [];
//         }
//     }

//     async syncCart(localCart) {
//         if (!localCart || localCart.length === 0) return;
//         await this.mergeCartItems(localCart);
//         localStorage.removeItem('cart');
//     }

//     async syncWishlist(localWishlist) {
//         return this.request(`${this.baseUrl}/wishlist/sync`, {
//             method: 'POST',
//             body: {
//                 userId: this.userId || 0,
//                 items: localWishlist.map(item => ({
//                     productId: Number(item.productId || item.id),
//                     size: item.size || '500g'
//                 }))
//             }
//         });
//     }

//     async updateGlobalCounts() {
//         try {
//             const cartItems = await this.getCart();
//             const cartCount = cartItems.length;
//             const cartEl = document.getElementById('cart-count');
//             if (cartEl) cartEl.textContent = cartCount > 0 ? cartCount : '0';

//             if (this.userId) {
//                 const wishlistItems = await this.getWishlist();
//                 this._setCountBadge('wishlist-count', wishlistItems.length);
//             }
//         } catch (error) {
//             console.error('[ApiService] Error updating counts:', error);
//         }
//     }

//     _setCountBadge(id, count) {
//         const el = document.getElementById(id);
//         if (el) {
//             el.textContent = count.toString();
//             el.style.display = count > 0 ? 'flex' : 'none';
//         }
//     }
// }

// window.apiService = new ApiService();

// document.addEventListener('DOMContentLoaded', () => {
//     if (window.apiService?.updateGlobalCounts) {
//         window.apiService.updateGlobalCounts();
//     }
// });

// async function initializeBackendConnection() {
//     if (!window.apiService) return;
//     await syncLocalDataWithBackend();
// }

// async function syncLocalDataWithBackend() {
//     if (!window.apiService?.userId) return;

//     const localWishlistDetails = JSON.parse(localStorage.getItem('wishlistDetails') || '[]');
//     const localCart = JSON.parse(localStorage.getItem('cart') || '[]');

//     if (localWishlistDetails.length > 0) {
//         try {
//             await window.apiService.syncWishlist(localWishlistDetails);
//             localStorage.removeItem('wishlist');
//             localStorage.removeItem('wishlistDetails');
//         } catch (e) { console.warn('Wishlist sync failed:', e); }
//     }

//     if (localCart.length > 0) {
//         try {
//             await window.apiService.syncCart(localCart);
//         } catch (e) { console.warn('Cart sync failed:', e); }
//     }
// }

// document.addEventListener('DOMContentLoaded', initializeBackendConnection);












//===================== working on produiton ===============//