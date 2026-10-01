import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MembersPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Block anyone who is not logged in
    if (!user) {
        redirect("/");
    }

    return (
        <main>
            <h1>Members Only</h1>

            <p>
                This page is protected. You can only see this content because you are
                logged in.
            </p>

            <p>Logged in as: {user.email}</p>

            <p>
                <a href="/">Back to Home</a>
            </p>
        </main>
    );
}