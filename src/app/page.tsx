import { supabase } from "@/lib/supabase";

export default async function Home() {
    const { data: movies, error } = await supabase
        .from("movies")
        .select("*")
        .order("id");

    if (error) {
        return (
            <main>
                <h1>Error loading movies</h1>
                <p>{error.message}</p>
            </main>
        );
    }

    return (
        <main>
            <h1>My Movie List</h1>

            <ul>
                {movies?.map((movie) => (
                    <li key={movie.id}>
                        {movie.title} ({movie.year})
                    </li>
                ))}
            </ul>
        </main>
    );
}