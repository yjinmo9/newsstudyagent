"use client";

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Round {
  id: number;
  name: string;
  date: string;
  // 필요한 필드 추가 가능
}

export default function RoundDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // hydration 오류 방지용 마운트 체크!
  const [mounted, setMounted] = useState(false);

  const [round, setRound] = useState<Round | null>(null);
  const [url, setUrl] = useState('');
  const [sentenceCount, setSentenceCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. 마운트 감지 (CSR에서만 true로 바뀜)
  useEffect(() => {
    setMounted(true);
  }, []);

  // 2. 회차 정보 불러오기
  useEffect(() => {
    if (!id) return;
    supabase
      .from('rounds')
      .select('*')
      .eq('id', id)
      .single<Round>()
      .then(({ data }) => {
        setRound(data ?? null);
      });
  }, [id]);

  // 기사 등록 및 분석 요청
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // 1. articles 테이블에 text 없이 저장
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다');

      const { data, error } = await supabase.from('articles').insert({
        user_id: user.id,
        round_id: id,
        url,
      }).select('id').single<{ id: number }>();
      if (error || !data) throw new Error('기사 저장 실패');

      // 2. 크롤링 API 호출
      const res = await fetch('/api/crawl-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, articleId: data.id }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || '크롤링 실패');

      // 3. 성공 시 다음 단계로 이동
      router.push(`/article/${data.id}`);
    } catch {
      setError('기사 저장 또는 분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // --------------- hydration 오류 방지 포인트 ---------------

  // 마운트 전에는 null만 반환 → SSR/CSR 항상 일치!
  if (!mounted) return null;

  // round가 아직 불러와지지 않은 상태에서는 "로딩중" 출력
  if (!round) return <div style={{ padding: 40 }}>로딩 중...</div>;

  // ---------------- 실제 렌더링 ----------------------
  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #eee' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{round.name}</h2>
      <div style={{ color: '#888', marginBottom: 24 }}>{round.date}</div>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>기사 URL</label>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com/news"
          style={{ width: '100%', padding: 8, marginBottom: 16, borderRadius: 4, border: '1px solid #ccc' }}
          required
        />
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>추천 문장 개수</label>
        <input
          type="number"
          value={sentenceCount}
          onChange={e => setSentenceCount(Number(e.target.value))}
          min={1}
          max={10}
          style={{ width: 80, padding: 6, marginBottom: 16, borderRadius: 4, border: '1px solid #ccc' }}
          required
        />
        <button
          type="submit"
          disabled={loading}
          style={{ background: '#0070f3', color: '#fff', borderRadius: 6, padding: '10px 24px', fontWeight: 600 }}
        >
          {loading ? '분석 중...' : '기사 등록/분석하기'}
        </button>
      </form>
      {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
    </div>
  );
}
