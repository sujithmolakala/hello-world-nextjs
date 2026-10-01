"use client";

import { createClient } from "@/lib/supabase/client";

export default function GoogleLoginButton() {
    const handleLogin = async () => {
        const supabase = createClient();

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: {
                    prompt: "select_account",
                },
            },
        });

        if (error) {
            console.error("Error signing in:", error.message);
        }
    };

    return (
        <button
            onClick={handleLogin}
            style={{
                padding: "10px 16px",
                border: "1px solid #ccc",
                borderRadius: "6px",
                cursor: "pointer",
            }}
        >
            Sign in with Google
        </button>
    );
}