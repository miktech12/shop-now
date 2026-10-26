
/* ==========================================
   PUMEKA GLOBAL PRODUCT SEARCH
========================================== */

(() => {
    "use strict";

    const input = document.getElementById("search");
    const box = document.querySelector(".search-box");

    if (!input || !box) return;

    /*
      IMPORTANT:
      Update these paths if your actual filenames differ.
      Include every page that contains product cards.
    */
    const SEARCH_PAGES = [
        "index.html",
        "test.html",
        "electronics-page-2.html",
        "FASHION.html"
    ];

    const MAX_RESULTS = 8;
    const cache = new Map();

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

    let searchTimer;
    let requestNumber = 0;
    let activeIndex = -1;
    let currentResults = [];

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

    function makeProductId(product, index) {
        const name = getProductName(product);
        return "pumeka-" + slug(name) + "-" + (index + 1);
    }

    function getProductImage(product, pageURL) {
        const src = product.querySelector(".product-image img")?.getAttribute("src");

        if (!src) return "";

        try {
            return new URL(src, pageURL).href;
        } catch {
            return "";
        }
    }

    function getProductData(product, pageURL, index) {
        const name = getProductName(product);
        const category = getProductCategory(product);
        const price = getProductPrice(product);
        const image = getProductImage(product, pageURL);

        const searchable = normalize([
            name,
            category,
            product.dataset.name,
            product.dataset.category,
            price
        ].join(" "));

        const id = makeProductId(product, index);

        /*
          Use the original page and a stable product anchor.
          The destination page will assign the same anchor IDs.
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

    async function loadPage(path) {
        const pageURL = new URL(path, window.location.href).href;

        if (cache.has(pageURL)) {
            return cache.get(pageURL);
        }

        const response = await fetch(pageURL, {
            credentials: "same-origin"
        });

        if (!response.ok) {
            throw new Error("Could not load " + path);
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const products = Array.from(doc.querySelectorAll(".product"));

        const records = products.map((product, index) =>
            getProductData(product, pageURL, index)
        );

        cache.set(pageURL, records);
        return records;
    }

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
          Avoid duplicate results if the same product appears
          on more than one page.
        */
        const seen = new Set();

        return all.filter(product => {
            const key = product.url;

            if (seen.has(key)) return false;

            seen.add(key);
            return true;
        });
    }

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
            dropdown.querySelectorAll(".pumeka-search-result")
        );

        if (!links.length) return;

        activeIndex = (index + links.length) % links.length;

        links.forEach((link, i) => {
            link.setAttribute(
                "aria-selected",
                String(i === activeIndex)
            );

            if (i === activeIndex) {
                link.scrollIntoView({ block: "nearest" });
            }
        });
    }

    function renderResults(results, query) {
        dropdown.replaceChildren();
        currentResults = results;
        activeIndex = -1;

        const heading = document.createElement("div");
        heading.className = "pumeka-search-heading";
        heading.textContent = "Products matching “" + query + "”";
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
            price.textContent = product.price || "Price on request";

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
        footer.textContent = results.length >= MAX_RESULTS
            ? "Showing top " + MAX_RESULTS + " matches"
            : results.length + " matching product(s)";

        dropdown.appendChild(footer);
        dropdown.hidden = false;
        input.setAttribute("aria-expanded", "true");
    }

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
                .filter(product => product.score === terms.length)
                .sort((a, b) => {
                    const aExact = normalize(a.name) === normalizedQuery ? 1 : 0;
                    const bExact = normalize(b.name) === normalizedQuery ? 1 : 0;

                    return bExact - aExact || b.score - a.score ||
                        a.name.localeCompare(b.name);
                })
                .slice(0, MAX_RESULTS);

            if (thisRequest !== requestNumber) return;

            renderResults(results, query);

        } catch (error) {
            console.error("[PUMEKA SEARCH]", error);

            if (thisRequest === requestNumber) {
                makeMessage(
                    "Search could not load. Please check your connection and try again."
                );
            }
        }
    }

    input.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(search, 180);
    });

    input.addEventListener("keydown", event => {
        const links = dropdown.querySelectorAll(".pumeka-search-result");

        if (event.key === "ArrowDown" && !dropdown.hidden) {
            event.preventDefault();
            setActiveResult(activeIndex + 1);
        } else if (event.key === "ArrowUp" && !dropdown.hidden) {
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

    /*
      On every product page, create the same IDs used by the
      search index. A search result then opens the exact card.
    */
    const productsOnThisPage = document.querySelectorAll(".product");

    productsOnThisPage.forEach((product, index) => {
        product.id = makeProductId(product, index);
        product.style.scrollMarginTop = "110px";
    });

    function focusProductFromHash() {
        const id = decodeURIComponent(window.location.hash.slice(1));

        if (!id.startsWith("pumeka-")) return;

        const product = document.getElementById(id);
        if (!product) return;

        product.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        product.classList.add("pumeka-search-highlight");

        setTimeout(() => {
            product.classList.remove("pumeka-search-highlight");
        }, 3000);
    }

    if (window.location.hash) {
        window.addEventListener("load", focusProductFromHash);
        setTimeout(focusProductFromHash, 300);
    }
})();
