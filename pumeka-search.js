
/* ==========================================
   PUMEKA GLOBAL PRODUCT SEARCH
   Global search + direct product navigation
========================================== */

(() => {
    "use strict";

    const input = document.getElementById("search");
    const box = document.querySelector(".search-box");

    if (!input || !box) return;

    /*
      IMPORTANT:
      Use the exact filenames of your published pages.
      Add every page that contains product cards.
    */
    const SEARCH_PAGES = [
        "index.html",
        "test.html",
        "electronics-page-2.html",
        "FASHION.html"
    ];

    const MAX_RESULTS = 8;
    const cache = new Map();

    let searchTimer;
    let requestNumber = 0;
    let activeIndex = -1;

    const dropdown = document.createElement("div");
    dropdown.className = "pumeka-search-dropdown";
    dropdown.id = "pumekaSearchResults";
    dropdown.hidden = true;
    dropdown.setAttribute("role", "listbox");

    box.appendChild(dropdown);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", dropdown.id);
    input.setAttribute("aria-expanded", "false");

    /* ==========================================
       TEXT HELPERS
    ========================================== */

    function normalize(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function slug(value) {
        return normalize(value).replace(/\s+/g, "-") || "product";
    }

    function getProductName(product) {
        return (
            product.querySelector(".product-name")?.textContent ||
            product.dataset.name ||
            product.querySelector("img")?.alt ||
            "Product"
        ).trim();
    }

    function getProductCategory(product) {
        return (
            product.querySelector(".product-category")?.textContent ||
            product.dataset.category ||
            "Products"
        ).trim();
    }

    function getProductPrice(product) {
        return (
            product.querySelector(".price")?.textContent || ""
        ).trim();
    }

    /*
      IMPORTANT:
      IDs are based on product name and its position.
      Keep product order consistent between search indexing
      and the actual destination page.
    */
    function makeProductId(product, index) {
        return "pumeka-" + slug(getProductName(product)) +
            "-" + (index + 1);
    }

    /* ==========================================
       PRODUCT IMAGE
    ========================================== */

    function getProductImage(product, pageURL) {
        const image = product.querySelector(
            ".product-image img, img"
        );

        const src = image?.getAttribute("src");

        if (!src) return "";

        try {
            return new URL(src, pageURL).href;
        } catch {
            return "";
        }
    }

    /* ==========================================
       PRODUCT DATA
    ========================================== */

    function getProductData(product, pageURL, index) {
        const name = getProductName(product);
        const category = getProductCategory(product);
        const price = getProductPrice(product);
        const image = getProductImage(product, pageURL);
        const id = makeProductId(product, index);

        const searchable = normalize([
            name,
            category,
            product.dataset.name,
            product.dataset.category,
            price
        ].join(" "));

        /*
          Link directly to the product anchor, not just
          to the page containing the product.
        */
        const url = new URL(pageURL);
        url.hash = id;

        return {
            name,
            category,
            price,
            image,
            searchable,
            id,
            url: url.href
        };
    }

    /* ==========================================
       LOAD PRODUCTS FROM A PAGE
    ========================================== */

    async function loadPage(path) {
        const pageURL = new URL(
            path,
            window.location.href
        ).href;

        if (cache.has(pageURL)) {
            return cache.get(pageURL);
        }

        const response = await fetch(pageURL, {
            credentials: "same-origin"
        });

        if (!response.ok) {
            throw new Error(
                "Could not load " + path
            );
        }

        const html = await response.text();

        const doc = new DOMParser().parseFromString(
            html,
            "text/html"
        );

        const products = Array.from(
            doc.querySelectorAll(".product")
        );

        const records = products.map((product, index) =>
            getProductData(product, pageURL, index)
        );

        cache.set(pageURL, records);

        return records;
    }

    /* ==========================================
       LOAD ALL WEBSITE PRODUCTS
    ========================================== */

    async function loadAllProducts() {
        const pages = await Promise.allSettled(
            SEARCH_PAGES.map(loadPage)
        );

        const all = [];

        pages.forEach((result, index) => {
            if (result.status === "fulfilled") {
                all.push(...result.value);
            } else {
                console.warn(
                    "[PUMEKA SEARCH] Could not search:",
                    SEARCH_PAGES[index],
                    result.reason
                );
            }
        });

        /*
          Avoid duplicate results pointing to the
          same product URL.
        */
        const seen = new Set();

        return all.filter(product => {
            if (seen.has(product.url)) {
                return false;
            }

            seen.add(product.url);
            return true;
        });
    }

    /* ==========================================
       DROPDOWN HELPERS
    ========================================== */

    function closeDropdown() {
        dropdown.hidden = true;
        input.setAttribute("aria-expanded", "false");
        activeIndex = -1;
    }

    function makeMessage(message) {
        dropdown.replaceChildren();

        const item = document.createElement("div");
        item.className = "pumeka-search-message";
        item.textContent = message;

        dropdown.appendChild(item);
        dropdown.hidden = false;

        input.setAttribute("aria-expanded", "true");
    }

    function setActiveResult(index) {
        const links = Array.from(
            dropdown.querySelectorAll(
                ".pumeka-search-result"
            )
        );

        if (!links.length) return;

        activeIndex =
            (index + links.length) % links.length;

        links.forEach((link, i) => {
            link.setAttribute(
                "aria-selected",
                String(i === activeIndex)
            );

            if (i === activeIndex) {
                link.scrollIntoView({
                    block: "nearest"
                });
            }
        });
    }

    /* ==========================================
       DISPLAY SEARCH RESULTS
    ========================================== */

    function renderResults(results, query) {
        dropdown.replaceChildren();
        activeIndex = -1;

        const heading = document.createElement("div");
        heading.className = "pumeka-search-heading";
        heading.textContent =
            'Products matching "' + query + '"';

        dropdown.appendChild(heading);

        if (!results.length) {
            const message = document.createElement("div");

            message.className = "pumeka-search-message";
            message.textContent =
                "No matching products found. Try another product name or category.";

            dropdown.appendChild(message);
            dropdown.hidden = false;

            input.setAttribute("aria-expanded", "true");
            return;
        }

        results.forEach((product, index) => {
            const link = document.createElement("a");

            link.className = "pumeka-search-result";
            link.href = product.url;
            link.setAttribute("role", "option");
            link.setAttribute("aria-selected", "false");

            if (product.image) {
                const img = document.createElement("img");

                img.src = product.image;
                img.alt = product.name;
                img.loading = index < 3 ? "eager" : "lazy";

                img.onerror = () => img.remove();

                link.appendChild(img);
            }

            const details = document.createElement("span");
            details.className = "pumeka-search-details";

            const name = document.createElement("span");
            name.className = "pumeka-search-name";
            name.textContent = product.name;

            const category = document.createElement("span");
            category.className = "pumeka-search-category";
            category.textContent = product.category;

            const price = document.createElement("span");
            price.className = "pumeka-search-price";
            price.textContent =
                product.price || "Price on request";

            details.append(name, category, price);

            const arrow = document.createElement("span");
            arrow.className = "pumeka-search-arrow";
            arrow.textContent = "›";
            arrow.setAttribute("aria-hidden", "true");

            link.append(details, arrow);
            dropdown.appendChild(link);
        });

        const footer = document.createElement("div");
        footer.className = "pumeka-search-footer";

        footer.textContent =
            results.length >= MAX_RESULTS
                ? "Showing top " + MAX_RESULTS + " matches"
                : results.length + " matching product(s)";

        dropdown.appendChild(footer);
        dropdown.hidden = false;

        input.setAttribute("aria-expanded", "true");
    }

    /* ==========================================
       SEARCH PRODUCTS
    ========================================== */

    async function search() {
        const query = input.value.trim();
        const normalizedQuery = normalize(query);
        const thisRequest = ++requestNumber;

        if (normalizedQuery.length < 2) {
            closeDropdown();
            return;
        }

        makeMessage("Finding products across Pumeka…");

        try {
            const products = await loadAllProducts();

            if (thisRequest !== requestNumber) return;

            const terms = normalizedQuery.split(/\s+/);

            const results = products
                .map(product => {
                    const matchedTerms = terms.filter(term =>
                        product.searchable.includes(term)
                    );

                    return {
                        ...product,
                        score: matchedTerms.length
                    };
                })
                .filter(product =>
                    product.score === terms.length
                )
                .sort((a, b) => {
                    const aExact =
                        normalize(a.name) === normalizedQuery ? 1 : 0;

                    const bExact =
                        normalize(b.name) === normalizedQuery ? 1 : 0;

                    return (
                        bExact - aExact ||
                        b.score - a.score ||
                        a.name.localeCompare(b.name)
                    );
                })
                .slice(0, MAX_RESULTS);

            if (thisRequest !== requestNumber) return;

            renderResults(results, query);

        } catch (error) {
            console.error(
                "[PUMEKA SEARCH]",
                error
            );

            if (thisRequest === requestNumber) {
                makeMessage(
                    "Search could not load. Please check your connection and try again."
                );
            }
        }
    }

    /* ==========================================
       SEARCH INPUT EVENTS
    ========================================== */

    input.addEventListener("input", () => {
        clearTimeout(searchTimer);

        searchTimer = setTimeout(search, 180);
    });

    input.addEventListener("keydown", event => {
        const links = dropdown.querySelectorAll(
            ".pumeka-search-result"
        );

        if (
            event.key === "ArrowDown" &&
            !dropdown.hidden
        ) {
            event.preventDefault();
            setActiveResult(activeIndex + 1);

        } else if (
            event.key === "ArrowUp" &&
            !dropdown.hidden
        ) {
            event.preventDefault();
            setActiveResult(activeIndex - 1);

        } else if (
            event.key === "Enter" &&
            !dropdown.hidden &&
            activeIndex >= 0 &&
            links[activeIndex]
        ) {
            event.preventDefault();
            window.location.href = links[activeIndex].href;

        } else if (event.key === "Escape") {
            closeDropdown();
        }
    });

    document.addEventListener("click", event => {
        if (!box.contains(event.target)) {
            closeDropdown();
        }
    });

    /* ==========================================
       PRODUCT ANCHORS ON THE CURRENT PAGE
    ========================================== */

    function assignCurrentProductIds() {
        const products = document.querySelectorAll(".product");

        products.forEach((product, index) => {
            product.id = makeProductId(product, index);

            product.style.scrollMarginTop = "110px";
        });
    }

    /* ==========================================
       SCROLL TO THE EXACT SEARCHED PRODUCT
    ========================================== */

    function focusProductFromHash() {
        if (!window.location.hash) return;

        let id;

        try {
            id = decodeURIComponent(
                window.location.hash.slice(1)
            );
        } catch {
            return;
        }

        if (!id.startsWith("pumeka-")) return;

        assignCurrentProductIds();

        const product = document.getElementById(id);

        if (!product) {
            console.warn(
                "[PUMEKA SEARCH] Product anchor not found:",
                id
            );
            return;
        }

        product.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        product.classList.remove(
            "pumeka-search-highlight"
        );

        // Restart the highlight effect
        void product.offsetWidth;

        product.classList.add(
            "pumeka-search-highlight"
        );

        setTimeout(() => {
            product.classList.remove(
                "pumeka-search-highlight"
            );
        }, 3000);
    }

    /* ==========================================
       INITIALIZE PRODUCT IDS AND HASH NAVIGATION
    ========================================== */

    function initializeProductNavigation() {
        assignCurrentProductIds();

        if (window.location.hash) {
            focusProductFromHash();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeProductNavigation
        );
    } else {
        initializeProductNavigation();
    }

    window.addEventListener(
        "load",
        focusProductFromHash
    );

    window.addEventListener(
        "hashchange",
        focusProductFromHash
    );

})();
