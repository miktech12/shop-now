const SUPABASE_URL = "https://dawbweoeilojcrnbvnjz.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_OT_KESJmwBFXiDcd--lnxw_IO7Nzf61";

const shopNowSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

window.shopNowSupabase = shopNowSupabase;

async function updateAuthButton() {
    const button = document.getElementById("authButton");

    if (!button) return;

    const {
        data: { session }
    } = await shopNowSupabase.auth.getSession();

    if (!session) {
        button.textContent = "👤 Login / Sign Up";
        button.href = "auth.html";
        return;
    }

    let username =
        session.user.user_metadata?.username ||
        session.user.email?.split("@")[0] ||
        "Account";

    const { data: profile } = await shopNowSupabase
        .from("profiles")
        .select("username")
        .eq("id", session.user.id)
        .maybeSingle();

    if (profile?.username) {
        username = profile.username;
    }

    button.textContent = "👤 " + username;
    button.href = "auth.html";
}

document.addEventListener("DOMContentLoaded", updateAuthButton);

shopNowSupabase.auth.onAuthStateChange(() => {
    setTimeout(updateAuthButton, 0);
});