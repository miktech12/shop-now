```javascript
const SUPABASE_URL = "https://dawbweoeilojcrnbvnjz.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_OT_KESJmwBFXiDcd--lnxw_IO7Nzf61";

const rememberAdapter = {
    getItem(key) {
        if (localStorage.getItem("shopnow_remember") === "false") {
            return sessionStorage.getItem(key);
        }

        return localStorage.getItem(key) ?? sessionStorage.getItem(key);
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
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    }
};

const shopNowSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            storage: rememberAdapter,
            storageKey: "shopnow-auth",
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);

window.shopNowSupabase = shopNowSupabase;

async function updateAuthButton() {
    const button = document.getElementById("authButton");
    if (!button) return;

    const { data: { session } } =
        await shopNowSupabase.auth.getSession();

    const dropdown = document.getElementById("accountDropdown");
    const displayName = document.getElementById("accountDisplayName");
    const accountEmail = document.getElementById("accountEmail");

    if (!session) {
        button.textContent = "👤 Login / Sign Up";
        button.href = "auth.html";
        button.onclick = null;

        if (dropdown) dropdown.hidden = true;
        button.setAttribute("aria-expanded", "false");
        return;
    }

    const user = session.user;

    let username =
        user.user_metadata?.username ||
        user.email?.split("@")[0] ||
        "My Account";

    let phone = user.user_metadata?.phone || "";

    const { data: profile } = await shopNowSupabase
        .from("profiles")
        .select("username, phone, email")
        .eq("id", user.id)
        .maybeSingle();

    if (profile?.username) username = profile.username;
    if (profile?.phone) phone = profile.phone;

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
            (profile?.email || user.email || "") +
            (phone ? "\nPhone: " + phone : "");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateAuthButton();

    document.addEventListener("click", event => {
        const menu = document.getElementById("accountMenu");
        const dropdown = document.getElementById("accountDropdown");
        const button = document.getElementById("authButton");

        if (
            menu &&
            dropdown &&
            !menu.contains(event.target)
        ) {
            dropdown.hidden = true;
            button?.setAttribute("aria-expanded", "false");
        }
    });

    const logoutButton = document.getElementById("accountLogout");

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            const { error } = await shopNowSupabase.auth.signOut();

            if (error) {
                alert("Logout failed. Please try again.");
                return;
            }

            window.location.href = "index.html";
        });
    }
});

shopNowSupabase.auth.onAuthStateChange(() => {
    setTimeout(updateAuthButton, 0);
});
```