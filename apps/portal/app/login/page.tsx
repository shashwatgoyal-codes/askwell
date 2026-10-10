import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/session';
import { Mark } from '../Mark';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  if (await isAdmin()) redirect('/');
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[380px] flex-col justify-center gap-8 px-4">
      <div className="flex items-center gap-2.5">
        <Mark />
        <span className="text-[15px] font-medium">Askwell portal</span>
      </div>
      <h1 className="text-[32px] leading-tight font-medium tracking-tight">
        Sign in. <span className="text-faint">Owner only.</span>
      </h1>
      <LoginForm />
    </main>
  );
}
