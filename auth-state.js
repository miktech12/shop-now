/* =====================================================
   SHOP NOW — auth-state.js
   Shared Supabase client + header account dropdown
   Bulletproof session reading (matches any storage key)
===================================================== */

const SUPABASE_URL =
    "https://dawbweoeilojcrnbvnjz.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_OT_KESJmwBFXiDcd--lnxw_IO7Nzf61";

const PROJECT_REF = "dawbweoeilojcrnbvnjz";

/* -----------------------------------------------------
   Storage adapter — reads from every possible key
   Supabase might have used for the session.
----------------------------------------------------- */

const storageAdapter = {
    getItem(key) {
        const candidateKeys = [
            key,
            "shopnow-auth",
            `sb-${PROJECT_REF}-auth-token`
        ];

        for (const k of candidateKeys) {
            const value =
                localStorage.getItem(k) ??
                sessionStorage.getItem(k);
            if (value) return value;
        }
        return null;
    },

    setItem(key, value) {
        if (localStorage.getItem("shopnow_remember") === "false") {
            sessionStorage.setItem(key, value);
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, value);
            sessionStorage.removeItem(key);
        }
    },

    removeItem(key) {
        [key, "shopnow-auth", `sb-${PROJECT_REF}-auth-token`]
            .forEach((k) => {
                localStorage.removeItem(k);
                sessionStorage.removeItem(k);
            });
    }
};

/* -----------------------------------------------------
   Shared Supabase client
----------------------------------------------------- */

const shopNowSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            storage: storageAdapter,
            storageKey: "shopnow-auth",
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);

window.shopNowSupabase = shopNowSupabase;

/* -----------------------------------------------------
   Update the header button
----------------------------------------------------- */

async function updateAuthButton() {
    const button = document.getElementById("authButton");
    if (!button) return;

    const { data: { session } } =
        await shopNowSupabase.auth.getSession();

    const dropdown     = document.getElementById("accountDropdown");
    const displayName  = document.getElementById("accountDisplayName");
    const accountEmail = document.getElementById("accountEmail");

    /* ---------- Logged OUT ---------- */
    if (!session) {
        button.textContent = "👤 Login / Sign Up";
        button.href = "auth.html";
        button.onclick = null;
        button.setAttribute("aria-expanded", "false");
        if (dropdown) dropdown.hidden = true;
        return;
    }

    /* ---------- Logged IN ---------- */
    const user = session.user;

    let username =
        user.user_metadata?.username ||
        user.email?.split("@")[0] ||
        "My Account";

    let phone = user.user_metadata?.phone || "";
    let email = user.email || "";

    try {
        const { data: profile } = await shopNowSupabase
            .from("profiles")
            .select("username, phone, email")
            .eq("id", user.id)
            .maybeSingle();

        if (profile?.username) username = profile.username;
        if (profile?.phone)    phone    = profile.phone;
        if (profile?.email)    email    = profile.email;
    } catch (err) {
        console.warn("[SHOP NOW] Profile fetch failed:", err);
    }

    button.textContent = "👤 " + username;
    button.href = "#";
    button.onclick = function (event) {
        event.preventDefault();
        if (!dropdown) return;
        dropdown.hidden = !dropdown.hidden;
        button.setAttribute(
            "aria-expanded",
            String(!dropdown.hidden)
        );
    };

    if (displayName) displayName.textContent = username;
    if (accountEmail) {
        accountEmail.textContent =
            email + (phone ? "\nPhone: " + phone : "");
    }
}

/* -----------------------------------------------------
   Wire up events
----------------------------------------------------- */

function setupAccountMenu() {
    updateAuthButton();

    document.addEventListener("click", (event) => {
        const menu     = document.getElementById("accountMenu");
        const dropdown = document.getElementById("accountDropdown");
        const button   = document.getElementById("authButton");

        if (menu && dropdown && !menu.contains(event.target)) {
            dropdown.hidden = true;
            button?.setAttribute("aria-expanded", "false");
        }
    });

    const logoutButton = document.getElementById("accountLogout");
    if (logoutButton && !logoutButton.dataset.bound) {
        logoutButton.dataset.bound = "true";
        logoutButton.addEventListener("click", async () => {
            const { error } = await shopNowSupabase.auth.signOut();
            if (error) {
                alert("Logout failed. Please try again.");
                return;
            }
            window.location.href = "index.html";
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAccountMenu);
} else {
    setupAccountMenu();
}

/* -----------------------------------------------------
   React to auth changes
----------------------------------------------------- */

shopNowSupabase.auth.onAuthStateChange((event, session) => {
    console.log("[SHOP NOW] auth event:", event, session?.user?.email);
    setTimeout(updateAuthButton, 0);
});

/* -----------------------------------------------------
   Safety net retries (in case session restore is slow)
----------------------------------------------------- */

[100, 400, 1000, 2000, 4000].forEach((delay) => {
    setTimeout(updateAuthButton, delay);
});