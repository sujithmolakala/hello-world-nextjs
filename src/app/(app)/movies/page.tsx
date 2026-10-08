import { requireUser } from '@/lib/auth';
export const metadata = { title: 'Movies' };
export default async function MoviesPage() {
  const { supabase } = await requireUser();
  const { data: movies, error } = await supabase.from('movies').select('id,title,year').order('id');
  return <main id="main" className="page-shell"><h1>Movies</h1>{error ? <p role="alert" className="error">Movies could not be loaded. Please try again.</p> : movies?.length ? <ul className="movie-list">{movies.map(movie => <li key={movie.id}><span>{movie.title}</span><span className="muted">{movie.year}</span></li>)}</ul> : <p className="muted">No movies yet.</p>}</main>;
}
