'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateCaptionForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ id: string; caption: string } | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setSaved(null);
    try {
      const response = await fetch('/api/captions', { method: 'POST', body: new FormData(event.currentTarget) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not generate your caption.');
      setSaved(result); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not generate your caption. Please try again.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} aria-busy={busy}>
    <fieldset disabled={busy}>
      <label htmlFor="image">Image</label><input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby="image-help" onChange={event => { const file = event.target.files?.[0]; setSaved(null); setPreview(file ? URL.createObjectURL(file) : ''); }} /><p id="image-help" className="input-hint">JPEG, PNG, or WebP. Maximum 3 MB.</p>
      {preview && <div className="upload-preview"><Image src={preview} alt="Selected image preview" fill unoptimized /></div>}
      <label htmlFor="prompt">Context</label><textarea id="prompt" name="prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={1000} required rows={4} placeholder="Describe the scene or suggest a Columbia or NYC angle." aria-describedby="prompt-help" /><p id="prompt-help" className="input-hint">{prompt.length}/1,000 characters</p>
      <div className="form-submit"><button className="button" type="submit">{busy ? 'Generating caption…' : 'Generate caption'}</button><p className="muted">Your image, context, and a small sample of recent captions are sent to Gemini. The image and caption will be shared with signed-in members.</p></div>
    </fieldset>
    {error && <p className="error notice" role="alert">{error}</p>}
    {saved && <section className="generation-result" role="status"><p className="muted">Caption saved</p><p>{saved.caption}</p><Link className="text-link" href={`/#caption-${saved.id}`}>View in Feed</Link></section>}
  </form>;
}
