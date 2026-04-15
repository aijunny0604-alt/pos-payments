import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Lock, Eye, EyeOff } from 'lucide-react';

// 단순 SHA-256 해싱 (브라우저 내장)
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const TOKEN_KEY = 'pos-payments-auth-token';
const TOKEN_TTL_HOURS = 24;

export async function checkAuth(settings) {
  if (!settings?.pin_required) return true;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return false;
    const { ts, hash } = JSON.parse(raw);
    if (Date.now() - ts > TOKEN_TTL_HOURS * 3600 * 1000) return false;
    return hash === settings.pin_hash;
  } catch { return false; }
}

export default function AuthPage({ onAuthed }) {
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!pin.trim()) { setError('비밀번호를 입력하세요'); return; }
    setLoading(true); setError('');
    try {
      const settings = await supabase.getSettings();
      if (!settings) { setError('설정을 불러올 수 없습니다'); setLoading(false); return; }
      const hash = await sha256(pin);
      if (hash !== settings.pin_hash) {
        setError('비밀번호가 틀렸습니다');
        setPin('');
        setLoading(false);
        return;
      }
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ ts: Date.now(), hash }));
      onAuthed?.();
    } catch (e) {
      setError(e.message || '인증 실패');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-xl font-bold">MOVE 결제 관리</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">접속을 위해 비밀번호를 입력하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
          <label className="block">
            <span className="flex items-center gap-1.5 text-xs font-semibold mb-1.5">
              <Lock className="w-3.5 h-3.5" /> 비밀번호
            </span>
            <div className="relative">
              <input
                ref={inputRef}
                type={show ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-3 pr-10 rounded-lg border border-[var(--border)] bg-[var(--background)] text-base font-bold tracking-widest text-center"
                style={{ fontSize: '18px' }}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--muted-foreground)]"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[var(--primary)] text-white font-bold disabled:opacity-50"
          >
            {loading ? '확인 중...' : '접속'}
          </button>

          <p className="text-[10px] text-[var(--muted-foreground)] text-center mt-2">
            세션 24시간 유지 · 같은 브라우저만
          </p>
        </form>
      </div>
    </div>
  );
}
