// ========================================
// DYNAMIC BANNERS & TOP CAROUSEL — FINAL FIXED (DEC 2025)
// AUTO SCROLL + BUTTONS WORKING + ALL BANNERS WORKING
// ========================================
(async function loadDynamicBanners() {
    const API = "http://localhost:8082/api/banners/get-by-page-name/home";
    const IMAGE_BASE = "http://localhost:8082";
    
    
    const getImageUrl = (path) => {
        if (!path) return null;
        const match = path.match(/^\/api\/banners\/(\d+)\/(slides\/\d+|filetwo|filethree|filefour)$/);
        if (!match) return null;
        const [_, id, type] = match;

        if (type === "filetwo") return `${IMAGE_BASE}/api/banners/get-Banner-File-Two-Image/${id}/filetwo`;
        if (type === "filethree") return `${IMAGE_BASE}/api/banners/get-Banner-File-Three-Image/${id}/filethree`;
        if (type === "filefour") return `${IMAGE_BASE}/api/banners/get-Banner-File-Four-Image/${id}/filefour`;
        return `${IMAGE_BASE}/api/banners/get-Banner-Slide-Image/${id}/${type}`;
    };

    try {
        const res = await fetch(API + "?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) throw new Error("API failed");
        const data = await res.json();

        const fallbackMedia = [
            "https://i.pinimg.com/originals/e3/8b/65/e38b65897bc08b931b873c26a8b49738.gif",
            "https://v1.pinimg.com/videos/mc/720p/11/89/87/118987931a0f57dd984c2926091d32cc.mp4",
            "https://v1.pinimg.com/videos/mc/720p/e4/4e/0b/e44e0b6567237c5c8fc0cdcb7e343896.mp4",
            "https://v1.pinimg.com/videos/mc/720p/4a/e2/0a/4ae20a4041f75ccaf21643adc75c8278.mp4",
            "https://i.pinimg.com/originals/8b/b7/38/8bb73899cd626a2ab1ac9c0a2ead2599.gif",
            "https://v1.pinimg.com/videos/mc/720p/e6/2e/f7/e62ef72f55017d273496ff05f48aaca9.mp4"
        ];

        // TOP CAROUSEL WITH AUTO SCROLL + BUTTONS
        const scrollContainer = document.getElementById('scrollContainer');
        const scrollLeftBtn = document.getElementById('prevBtn');
        const scrollRightBtn = document.getElementById('nextBtn');

        if (scrollContainer && data.bannerFileSlides && data.bannerFileSlides.length > 0) {
            const slides = data.bannerFileSlides.slice(0, 6).map(getImageUrl);

            scrollContainer.innerHTML = slides.map((url, i) => {
                const finalUrl = url || fallbackMedia[i];
                const isVideo = finalUrl.includes('.mp4') || finalUrl.includes('.webm');
                const media = isVideo
                    ? `<video autoplay muted loop playsinline class="w-full h-full object-cover"><source src="${finalUrl}" type="video/mp4"></video>`
                    : `<img src="${finalUrl}" alt="Slide ${i+1}" class="w-full h-full object-cover" onerror="this.src='${fallbackMedia[i]}'">`;

                return `
                <div class="relative overflow-hidden shadow-lg group min-w-[90%] sm:min-w-[85%] md:min-w-[440px] h-[180px] sm:h-[220px] md:h-[270px] snap-start flex-shrink-0 rounded-xl">
                    ${media}
                    <div class="absolute inset-0 flex flex-col justify-center text-left text-white px-4 sm:px-6 md:px-8">
                        <h2 class="text-xl sm:text-2xl md:text-3xl font-extrabold mb-1 sm:mb-2"></h2>
                        <p class="text-xs sm:text-base md:text-lg mb-2 sm:mb-3 md:mb-4 max-w-[85%]"></p>
                        <button onclick="window.location.href='/CAKES/allcakes.html'" class="bg-yellow-400 mt-10 hover:bg-yellow-500 text-black font-bold px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2 rounded-full text-xs sm:text-sm md:text-base shadow-md w-fit">ORDER NOW</button>
                    </div>
                </div>`;
            }).join('');

            // AUTO SCROLL + BUTTONS LOGIC
            let autoScrollInterval;

            const startAutoScroll = () => {
                autoScrollInterval = setInterval(() => {
                    scrollContainer.scrollBy({ left: 460, behavior: 'smooth' });
                    if (scrollContainer.scrollLeft >= scrollContainer.scrollWidth - scrollContainer.clientWidth - 10) {
                        setTimeout(() => scrollContainer.scrollLeft = 0, 800);
                    }
                }, 3500);
            };

            const stopAutoScroll = () => clearInterval(autoScrollInterval);

            scrollLeftBtn?.addEventListener('click', () => {
                stopAutoScroll();
                scrollContainer.scrollBy({ left: -460, behavior: 'smooth' });
                setTimeout(startAutoScroll, 5000);
            });

            scrollRightBtn?.addEventListener('click', () => {
                stopAutoScroll();
                scrollContainer.scrollBy({ left: 460, behavior: 'smooth' });
                setTimeout(startAutoScroll, 5000);
            });

            scrollContainer.addEventListener('mouseenter', stopAutoScroll);
            scrollContainer.addEventListener('mouseleave', startAutoScroll);

            startAutoScroll(); // Start auto-scroll
        }

        // MAIN BANNER (filetwo)
        const mainBanner = document.getElementById('mainBanner');
        if (mainBanner && data.bannerFileTwo) {
            const url = getImageUrl(data.bannerFileTwo);
            if (url) {
                mainBanner.innerHTML = `
                    <img src="${url}" alt="Main Banner" class="w-full h-full object-cover object-center" onerror="this.src='/CAKES/IMG/B4.jpg'">
                    <div class="absolute inset-0 "></div>
                    <div class="absolute inset-0 flex items-center justify-center text-center px-4">
                        <h1 class="text-base sm:text-xl md:text-2xl lg:text-4xl font-bold text-white drop-shadow-lg">
                        </h1>
                    </div>
                `;
            }
        }

        // BOTTOM BANNER (filethree)
        const bottomBanner = document.getElementById('bottomBanner');
        if (bottomBanner && data.bannerFileThree) {
            const url = getImageUrl(data.bannerFileThree);
            if (url) {
                bottomBanner.innerHTML = `
                    <img src="${url}" alt="Bottom Banner" class="w-full h-full object-cover object-center" onerror="this.src='/CAKES/IMG/B4.jpg'">
                    <div class="absolute inset-0 "></div>
                    <div class="absolute inset-0 flex items-center justify-center text-center px-4">
                        <h1 class="text-base sm:text-xl md:text-2xl lg:text-4xl font-bold text-white drop-shadow-lg">
                        </h1>
                    </div>
                `;
            }
        }

        // EXTRA BANNER (filefour)
        const extraBanner = document.getElementById('extraBanner');
        if (extraBanner && data.bannerFileFour) {
            const url = getImageUrl(data.bannerFileFour);
            if (url) {
                extraBanner.innerHTML = `
                    <img src="${url}" alt="Extra Banner" class="w-full h-full object-cover object-center" onerror="this.src='/CAKES/IMG/B4.jpg'">
                    <div class="absolute inset-0 "></div>
                    <div class="absolute inset-0 flex items-center justify-center text-center px-4">
                        <h1 class="text-base sm:text-xl md:text-2xl lg:text-4xl font-bold text-white drop-shadow-lg">
                        </h1>
                    </div>
                `;
            }
        }

    } catch (err) {
        console.log("Dynamic banners failed → Using static fallbacks", err);
    }
})();

// ========================================
// YOUR ORIGINAL CODE — 100% UNTOUCHED & SAFE
// ========================================
(() => {
    'use strict';
    
    let globalSearchProducts = [];

    window.showNotification = function(message, type = "success") {
        if (typeof Toastify !== "undefined") {
            Toastify({
                text: message,
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: type === "error" ? "#ef4444" : "#10b981",
                stopOnFocus: true
            }).showToast();
        } else {
            alert(message);
        }
    };

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    function populateMainBanner() {
        const el = $('#mainBanner');
        if (!el) return;
        el.innerHTML = `
            <img src="/CAKES/IMG/B4.jpg" alt="Banner" class="w-full h-full object-cover object-center">
            <div class="absolute inset-0 bg-black/30"></div>
            <div class="absolute inset-0 flex items-center justify-center text-center px-4">
                <h1 class="text-base sm:text-xl md:text-2xl lg:text-4xl font-bold text-white drop-shadow-lg">
                </h1>
            </div>
        `;
    }

    function populateBottomBanner() {
        const el = $('#bottomBanner');
        if (!el) return;
        el.innerHTML = `
            <img src="/CAKES/IMG/B4.jpg" alt="Banner" class="w-full h-full object-cover object-center">
            <div class="absolute inset-0 bg-black/30"></div>
            <div class="absolute inset-0 flex items-center justify-center text-center px-4">
                <h1 class="text-base sm:text-xl md:text-2xl lg:text-4xl font-bold text-white drop-shadow-lg">
                </h1>
            </div>
        `;
    }

    function isLoggedIn() {
        try {
            const session = localStorage.getItem('userSession');
            if (!session) return false;
            const { expiry } = JSON.parse(session);
            return Date.now() < expiry;
        } catch { return false; }
    }

    function populateDropdown() {
        const dropdowns = $$('.dropdown-content');
        const html = isLoggedIn()
            ? `<a href="/profile.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">My Profile</a>
               <a href="#" onclick="showLogoutModal(); return false;" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Logout</a>`
            : `<a href="/login.html" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Login/Signup</a>`;
        dropdowns.forEach(d => d.innerHTML = html);
    }

    window.showLogoutModal = () => $('#logoutModal')?.classList.remove('hidden');
    window.hideLogoutModal = () => $('#logoutModal')?.classList.add('hidden');
    window.performLogout = () => {
        localStorage.removeItem('userId');
        localStorage.removeItem('userSession');
        populateDropdown();
        hideLogoutModal();
        showNotification('Logged out successfully');
    };

    function initMobileMenu() {
        const toggle = $('#menuToggle');
        const nav = $('#navLinks');
        const icon = toggle?.querySelector('i');
        if (!toggle || !nav) return;
        toggle.addEventListener('click', () => {
            const open = !nav.classList.contains('hidden');
            nav.classList.toggle('hidden');
            icon.classList.toggle('fa-bars', open);
            icon.classList.toggle('fa-times', !open);
            document.body.style.overflow = open ? '' : 'hidden';
        });
        document.addEventListener('click', e => {
            if (!toggle.contains(e.target) && !nav.contains(e.target)) {
                nav.classList.add('hidden');
                icon?.classList.add('fa-bars');
                icon?.classList.remove('fa-times');
                document.body.style.overflow = '';
            }
        });
    }

    const mobileCakesToggle = document.getElementById('mobileCakesToggle');
    const mobileCakesMenu = document.getElementById('mobileCakesMenu');
    const cakesIcon = mobileCakesToggle?.querySelector('i');
    if (mobileCakesToggle && mobileCakesMenu && cakesIcon) {
        mobileCakesToggle.addEventListener('click', () => {
            mobileCakesMenu.classList.toggle('hidden');
            cakesIcon.classList.toggle('rotate-180');
        });
    }

    function initSearch() {
        const input = $('#searchInput');
        const overlay = $('#searchOverlay');
        const suggestions = $('#searchSuggestions');
        const closeBtn = $('#closeSearch');
        const toggleBtns = $$('#searchToggle, #mobileSearchToggle');
        if (!overlay || !suggestions) return;

        toggleBtns.forEach(btn => btn?.addEventListener('click', e => {
            e.preventDefault();
            overlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            input?.focus();

            if (globalSearchProducts.length === 0) {
                loadGlobalSearchData();
            }
            showSuggestions('');
        }));

        closeBtn?.addEventListener('click', () => {
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
            input.value = '';
            suggestions.innerHTML = '';
        });

        overlay?.addEventListener('click', e => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
                document.body.style.overflow = '';
                input.value = '';
                suggestions.innerHTML = '';
            }
        });

        function showSuggestions(query = '') {
            suggestions.innerHTML = '<div class="p-4 text-center text-gray-500">Finding For You...</div>';

            setTimeout(() => {
                const q = query.toLowerCase().trim();
                const results = globalSearchProducts
                    .filter(p => 
                        p.name.toLowerCase().includes(q) || 
                        p.subCategory.toLowerCase().includes(q)
                    )
                    .slice(0, 8);

                if (results.length === 0 && q) {
                    suggestions.innerHTML = '<div class="p-4 text-center text-gray-500">No products found</div>';
                    return;
                }

                suggestions.innerHTML = results.map(p => `
                    <a href="${p.detailUrl}" class="flex items-center p-4 border-b hover:bg-gray-50 transition-colors">
                        <img src="${p.image || '/CAKES/IMG/placeholder-cake.jpg'}" 
                             class="w-12 h-12 object-cover rounded-lg mr-3" 
                             onerror="this.src='/CAKES/IMG/placeholder-cake.jpg'">
                        <div class="flex-1">
                            <div class="font-medium text-gray-800">${highlightText(p.name, q)}</div>
                            <div class="text-sm text-gray-500">₹${p.price.toLocaleString()} • ${p.subCategory}</div>
                        </div>
                        <i class="fas fa-arrow-right text-primary"></i>
                    </a>
                `).join('');

                if (!q && results.length === 0) {
                    suggestions.innerHTML = `
                        <div class="p-3 text-xs font-bold text-gray-600 uppercase border-b">Popular Categories</div>
                        <a href="/CAKES/allcakes.html" class="block px-4 py-3 hover:bg-gray-50">All Cakes</a>
                        <a href="/CUSTOM/custom.html" class="block px-4 py-3 hover:bg-gray-50">Birthday Cakes</a>
                        <a href="/CUSTOM/custom.html" class="block px-4 py-3 hover:bg-gray-50">Anniversary Cakes</a>
                        <a href="/SIDEBY/sideby.html" class="block px-4 py-3 hover:bg-gray-50">Snacks & More</a>
                    `;
                }
            }, globalSearchProducts.length === 0 ? 300 : 0);
        }

        input?.addEventListener('input', e => showSuggestions(e.target.value));
    }

    function initInstagramFeed() {
        const feed = document.getElementById("instaFeed");
        const leftBtn = document.getElementById("scrollLeft");
        const rightBtn = document.getElementById("scrollRight");
        if (!feed) return;

        const posts = [
            { image: "IMG/INSTA 1.png", likes: 243, comments: 32 },
            { image: "IMG/INSTA 2.png", likes: 187, comments: 21 },
            { image: "IMG/INSTA 3.png", likes: 312, comments: 45 },
            { image: "IMG/INSTA 4.png", likes: 198, comments: 28 },
            { image: "IMG/INSTA 5.png", likes: 276, comments: 39 },
            { image: "IMG/INSTA 6.png", likes: 221, comments: 31 },
            { image: "IMG/INSTA 7.png", likes: 334, comments: 52 },
            { image: "IMG/INSTA 8.png", likes: 189, comments: 24 },
            { image: "IMG/INSTA 9.png", likes: 298, comments: 41 },
            { image: "IMG/INSTA 10.png", likes: 156, comments: 18 },
            { image: "IMG/INSTA 11.png", likes: 267, comments: 36 },
            { image: "IMG/INSTA 12.png", likes: 321, comments: 47 }
        ];

        feed.innerHTML = posts.map(p => `
            <div class="group flex-none w-[280px] bg-black rounded-2xl overflow-hidden shadow-lg hover:-translate-y-2 transition-all duration-300">
                <a href="https://instagram.com/the_home_bakery_pune" target="_blank" class="block relative">
                    <img src="${p.image}" class="w-full h-72 object-cover group-hover:scale-105 transition-transform duration-500">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                        <div class="text-white flex gap-4 text-sm">
                            <span><i class="fas fa-heart"></i> ${p.likes}</span>
                            <span><i class="fas fa-comment"></i> ${p.comments}</span>
                        </div>
                    </div>
                </a>
            </div>
        `).join('');

        let scrollInterval;
        const startScroll = () => {
            scrollInterval = setInterval(() => {
                feed.scrollBy({ left: 300, behavior: 'smooth' });
                if (feed.scrollLeft >= feed.scrollWidth - feed.clientWidth - 10) {
                    setTimeout(() => feed.scrollLeft = 0, 600);
                }
            }, 3000);
        };
        leftBtn?.addEventListener('click', () => feed.scrollBy({ left: -300, behavior: 'smooth' }));
        rightBtn?.addEventListener('click', () => feed.scrollBy({ left: 300, behavior: 'smooth' }));
        feed.addEventListener('mouseenter', () => clearInterval(scrollInterval));
        feed.addEventListener('mouseleave', startScroll);
        startScroll();
    }
    
    // GLOBAL SEARCH: NOW INCLUDES CAKES + CUSTOM CAKES + SNACKS
    async function loadGlobalSearchData() {
        if (globalSearchProducts.length > 0) return;

        const API_BASE = "http://localhost:8082";
        const IMG_BASE = "http://localhost:8082";

        try {
            // 1. Regular Cakes
            let page = 0;
            let hasMore = true;
            while (hasMore) {
                const res = await fetch(`${API_BASE}/api/v1/products/category/Cakes?page=${page}&size=50`);
                if (!res.ok) break;
                const json = await res.json();
                if (!json.data?.content || json.data.content.length === 0) break;

                json.data.content.forEach(p => {
                    globalSearchProducts.push({
                        id: p.productId,
                        name: p.productName,
                        subCategory: p.productSubCategory || 'Cake',
                        price: p.productNewPrice,
                        image: p.productImageUrl ? `${IMG_BASE}${p.productImageUrl}` : null,
                        detailUrl: `/CAKES/product-details.html?id=${p.productId}`
                    });
                });
                hasMore = !json.data.last;
                page++;
            }

            // 2. Custom / Designer Cakes
            const customRes = await fetch(`${API_BASE}/api/customize-cakes`);
            if (customRes.ok) {
                const customData = await customRes.json();
                customData.data?.forEach(c => {
                    globalSearchProducts.push({
                        id: `custom-${c.id}`,
                        name: c.title,
                        subCategory: c.category || 'Custom Cake',
                        price: c.newPrices?.[0] || 0,
                        image: `${IMG_BASE}${c.imageUrl}`,
                        detailUrl: `/CUSTOM/custom-details.html?id=${c.id}`
                    });
                });
            }

            // 3. Snacks / Crave Corner
            const snacksRes = await fetch(`${API_BASE}/api/v1/snacks/get-all-snacks`);
            if (snacksRes.ok) {
                const snacksJson = await snacksRes.json();
                snacksJson.content?.forEach(s => {
                    globalSearchProducts.push({
                        id: `snack-${s.snackId}`,
                        name: s.productName,
                        subCategory: s.productSubcategory || s.productCategory || 'Snack',
                        price: s.productNewPrice,
                        image: s.productImageUrl ? `${IMG_BASE}${s.productImageUrl}` : null,
                        detailUrl: `/SIDEBY/snack-details.html?id=${s.snackId}`
                    });
                });
            }

            console.log(`Global search loaded: ${globalSearchProducts.length} products (Cakes + Custom + Snacks)`);
        } catch (err) {
            console.error("Failed to load global search data", err);
        }
    }

    // HIGHLIGHT MATCHED TEXT (NICE UX)
    function highlightText(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query.trim()})`, 'gi');
        return text.replace(regex, '<span class="text-yellow-600 font-bold">$1</span>');
    }

    function initScrollToTop() {
        const btn = $('#scrollToTop');
        if (!btn) return;
        window.addEventListener('scroll', () => {
            btn.classList.toggle('opacity-0', window.scrollY <= 300);
            btn.classList.toggle('invisible', window.scrollY <= 300);
        });
        btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    document.addEventListener('DOMContentLoaded', () => {
        populateMainBanner();
        populateBottomBanner();
        populateDropdown();
        initMobileMenu();
        initSearch();
        loadGlobalSearchData();
        initInstagramFeed();
        initScrollToTop();
        $('#modalCancel')?.addEventListener('click', hideLogoutModal);
        $('#modalConfirm')?.addEventListener('click', performLogout);
        $('#logoutModal')?.addEventListener('click', e => e.target === e.currentTarget && hideLogoutModal());
    });

    window.scrollToCard = window.scrollToCard || (() => {});
    window.createInstagramCards = window.createInstagramCards || (() => {});
})();
    
    
    
    
    