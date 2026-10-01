"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
    const router = useRouter();

    const handleSignOut = async () => {
        const supabase = createClient();

        await supabase.auth.signOut();

        router.push("/");
        router.refresh();
    };

    return (
        <button onClick={handleSignOut}>
            Sign Out
        </button>
    );
}