"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import KakaoLoginButton from '@/components/auth/KakaoLoginButton';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace("/dashboard");
      }
    });
  }, [router, supabase]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', justifyContent: 'center', background: '#fafafa' }}>
      <h1 style={{ fontSize: 32, marginBottom: 32, fontWeight: 800 }}>영어 기사 스터디</h1>
      <p style={{ marginBottom: 40, color: '#555', fontSize: 18 }}>
        카카오톡으로 간편하게 로그인하고
        <br />
        영어 기사 학습을 시작하세요!
      </p>
      <KakaoLoginButton />
    </div>
  );
}