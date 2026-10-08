'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main id="main" className="page-shell"><p className="error" role="alert">This page could not be loaded.</p><button className="button" onClick={reset}>Try again</button></main>; }
