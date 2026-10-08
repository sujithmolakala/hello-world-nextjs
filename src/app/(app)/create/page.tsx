import { requireUser } from '@/lib/auth';
import CreateCaptionForm from '@/components/CreateCaptionForm';
export const metadata = { title: 'Create caption' };
export default async function CreatePage() {
  await requireUser();
  return <main id="main" className="page-shell form-page"><h1>Create caption</h1><CreateCaptionForm /></main>;
}
