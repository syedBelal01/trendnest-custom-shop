import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface Props { children: React.ReactNode; }

export default function AdminGuard({ children }: Props) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin-auth') === '1');
  const [pass, setPass] = useState('');

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    if (pass === 'admin123') {
      sessionStorage.setItem('admin-auth', '1');
      setAuthed(true);
    }
  };

  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={login} className="border rounded-xl p-8 max-w-sm w-full space-y-4 bg-card shadow-lg">
        <div className="text-center">
          <Lock className="h-8 w-8 mx-auto text-primary mb-2" />
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Enter password to continue</p>
        </div>
        <Input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password" />
        <Button type="submit" className="w-full">Login</Button>
        <p className="text-xs text-muted-foreground text-center">Hint: admin123</p>
      </form>
    </div>
  );
}
