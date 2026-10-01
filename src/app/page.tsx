import { createClient } from "@/lib/supabase/server";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import ProfileForm from "@/components/ProfileForm";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function Home() {
    const supabase = await createClient();

    // Get currently logged-in user
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Keep movies functionality from Assignment #2
    const { data: movies, error: moviesError } = await supabase
        .from("movies")
        .select("*")
        .order("id");

    if (moviesError) {
        return (
            <main>
                <h1>Error loading movies</h1>
                <p>{moviesError.message}</p>
            </main>
        );
    }

    // Get profile if user is logged in
    let profile = null;

    if (user) {
        const { data } = await supabase
            .from("profiles")
            .select("first_name, last_name, avatar_url")
            .eq("id", user.id)
            .single();

        profile = data;
    }

    const profileIncomplete =
        user &&
        (!profile?.first_name || !profile?.last_name);

    return (
        <main>
            <h1>Mock Humor Study</h1>

            {!user ? (
                <GoogleLoginButton />
            ) : (
                <>
                    <p>Logged in as: {user.email}</p>

                    {profileIncomplete ? (
                        <ProfileForm userId={user.id} />
                    ) : (
                        <>
                            <p>
                                Welcome, {profile?.first_name} {profile?.last_name}!
                            </p>

                            <p>
                                <a href="/profile">Profile</a>
                                {" | "}
                                <a href="/members">Members Only</a>
                            </p>

                            <SignOutButton />
                        </>
                    )}

                    <h2>My Movie List</h2>

                    <ul>
                        {movies?.map((movie) => (
                            <li key={movie.id}>
                                {movie.title} ({movie.year})
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </main>
    );
}