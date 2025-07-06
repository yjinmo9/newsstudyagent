"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { User } from '@supabase/supabase-js';

interface Round {
  id: number;
  name: string;
  date: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // SSR 하이드레이션 mismatch 방지
  useEffect(() => {
    setMounted(true);
  }, []);

  // 로그인 체크
  useEffect(() => {
    if (!mounted) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login');
      else setUser(session.user);
    });
  }, [router, mounted]);

  // 회차 리스트 불러오기
  const fetchRounds = async (uid: string) => {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false });
    if (error) setError('회차 불러오기 실패');
    else setRounds((data ?? []) as Round[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchRounds(user.id);
  }, [user]);

  // 회차 생성
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name || !date) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.from('rounds').insert({
      user_id: user?.id,
      name,
      date,
    });
    if (error) setError('회차 생성 실패');
    setShowForm(false);
    setName('');
    setDate('');
    if (user) {
      fetchRounds(user.id);
    }
    setLoading(false);
  };

  // 로그아웃 핸들러
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  // 마운트 안되면 아무것도 렌더 안함(SSR/CSR mismatch 방지)
  if (!mounted) return null;

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #eee' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700 }}>내 학습 회차</h2>
        <button
          onClick={handleLogout}
          style={{ background: '#eee', color: '#222', borderRadius: 6, padding: '6px 16px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          로그아웃
        </button>
      </div>
      <button
        onClick={() => setShowForm((v) => !v)}
        style={{ background: '#0070f3', color: '#fff', borderRadius: 6, padding: '8px 18px', fontWeight: 600, marginBottom: 24 }}
      >
        {showForm ? '닫기' : '생성하기'}
      </button>
      {showForm && (
        <form onSubmit={handleCreate} style={{ marginBottom: 24 }}>
          <input
            type="text"
            placeholder="회차명"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ marginRight: 8, padding: 6 }}
            required
          />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ marginRight: 8, padding: 6 }}
            required
          />
          <button type="submit" style={{ padding: '6px 16px', background: '#222', color: '#fff', borderRadius: 4 }}>저장</button>
        </form>
      )}
      {loading && <div style={{ color: '#888', marginBottom: 12 }}>로딩 중...</div>}
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {rounds.length === 0 && <li style={{ color: '#aaa' }}>아직 생성된 회차가 없습니다.</li>}
        {rounds.map((r) => (
          <li
            key={r.id}
            style={{
              padding: '12px 0',
              borderBottom: '1px solid #eee',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            onClick={async () => {
              setLoading(true);
              // 1. 최종 단어카드(final) 존재 여부 확인
              const { data: finalData } = await supabase
                .from('word_cards')
                .select('id')
                .eq('round_id', r.id)
                .eq('status', 'final');
              if (finalData && finalData.length > 0) {
                setLoading(false);
                router.push(`/round/${r.id}/archive`);
                return;
              }
              // 2. draft(임시) 데이터 존재 여부 확인
              const { data: draftData } = await supabase
                .from('word_cards')
                .select('id')
                .eq('round_id', r.id)
                .eq('status', 'draft');
              setLoading(false);
              if (draftData && draftData.length > 0) {
                router.push(`/round/${r.id}/wordcards`);
              } else {
                router.push(`/round/${r.id}`);
              }
            }}
          >
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span style={{ color: '#888', fontSize: 14 }}>{r.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
