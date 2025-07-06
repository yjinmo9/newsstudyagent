"use client";

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface WordCard {
  id?: number;
  word: string;
  part_of_speech: string;
  meaning: string;
  example?: string;
  status?: string; // draft/final 구분 위해 추가
}

export default function WordCardArchivePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [wordCards, setWordCards] = useState<WordCard[]>([]);
  const [flipped, setFlipped] = useState<{ [key: number]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    supabase
      .from('word_cards')
      .select('*')
      .eq('round_id', id)
      .then(({ data, error }) => {
        if (error) setError('단어카드 불러오기 실패');
        else {
          setWordCards((data ?? []) as WordCard[]);
          // draft가 있으면 저장 가능, final만 있으면 저장 완료
          const hasDraft = ((data ?? []) as WordCard[]).some(card => card.status === 'draft');
          setSaved(!hasDraft);
        }
        setLoading(false);
      });
  }, [id]);

  const handleFlip = (cardId: number) => {
    setFlipped((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  // 저장하기 버튼 클릭 시 draft를 final로 업데이트
  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await supabase
        .from('word_cards')
        .update({ status: 'final' })
        .eq('round_id', id)
        .eq('status', 'draft');
      setSaved(true);
      // 저장 후 다시 불러오기
      const { data } = await supabase.from('word_cards').select('*').eq('round_id', id);
      setWordCards((data ?? []) as WordCard[]);
    } catch (_) {
      setError('저장 실패');
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #eee' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32 }}>회차별 단어카드 아카이브/복습</h2>
      {loading && <div style={{ color: '#888', marginBottom: 12 }}>로딩 중...</div>}
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      {/* 저장하기 버튼: draft가 있을 때만 노출, 저장 완료 시 메시지와 대시보드 버튼만 노출 */}
      {!saved ? (
        <button
          style={{ background: '#0070f3', color: '#fff', borderRadius: 6, padding: '10px 24px', fontWeight: 600, marginBottom: 24 }}
          onClick={handleSave}
        >
          저장하기
        </button>
      ) : (
        <>
          <div style={{ color: '#0070f3', fontWeight: 600, marginBottom: 16 }}>저장 완료!</div>
          <button
            style={{ background: '#222', color: '#fff', borderRadius: 6, padding: '10px 24px', fontWeight: 600, marginBottom: 32 }}
            onClick={() => router.push('/dashboard')}
          >
            대시보드로 돌아가기
          </button>
        </>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
        {wordCards.map((card) => (
          <div
            key={card.id}
            onClick={() => handleFlip(card.id!)}
            style={{
              perspective: 800,
              cursor: 'pointer',
              minHeight: 160,
            }}
          >
            <div
              style={{
                transition: 'transform 0.5s',
                transformStyle: 'preserve-3d',
                position: 'relative',
                width: '100%',
                height: 160,
                transform: flipped[card.id!] ? 'rotateY(180deg)' : 'none',
              }}
            >
              {/* 앞면 */}
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  background: '#f5f7fa',
                  border: '1px solid #eee',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 22,
                }}
              >
                {card.word} <span style={{ color: '#888', fontSize: 15, fontWeight: 400 }}>{card.part_of_speech}</span>
              </div>
              {/* 뒷면 */}
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  background: '#fff',
                  border: '1px solid #eee',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 500,
                  fontSize: 18,
                  color: '#222',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div style={{ marginBottom: 8 }}>뜻: <span style={{ color: '#0070f3', fontWeight: 700 }}>{card.meaning}</span></div>
                <div style={{ fontSize: 15, color: '#555' }}>예문: {card.example}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* 영작 보러가기 버튼 추가 */}
      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <button
          style={{ background: '#0984e3', color: '#fff', borderRadius: 6, padding: '12px 32px', fontWeight: 700, fontSize: 18 }}
          onClick={() => router.push(`/round/${id}/sentences`)}
        >
          영작 보러가기
        </button>
      </div>
    </div>
  );
}
