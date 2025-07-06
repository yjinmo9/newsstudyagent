import { supabase } from '@/lib/supabaseClient';

export default function KakaoLoginButton() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: window.location.origin + '/dashboard',
      },
    });
  };

  return (
    <button
      onClick={handleLogin}
      style={{
        background: '#FEE500',
        color: '#191600',
        borderRadius: 8,
        padding: '12px 24px',
        fontWeight: 700,
      }}
    >
      카카오톡으로 로그인
    </button>
  );
} 