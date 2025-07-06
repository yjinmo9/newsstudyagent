"use client";

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Sentence {
  id?: number;
  article_id?: number;
  text: string;
  translation?: string;
  hints?: string[] | string;
}

export default function SentenceListPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOriginal, setShowOriginal] = useState<{ [idx: number]: boolean }>({});
  const [showHints, setShowHints] = useState<{ [idx: number]: boolean }>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    supabase
      .from('articles')
      .select('id')
      .eq('round_id', id)
      .then(async ({ data: articles, error: articleError }) => {
        if (articleError) {
          setError('기사 정보 불러오기 실패');
          setLoading(false);
          return;
        }
        const articleIds = (articles ?? []).map((a: { id: number }) => a.id);
        if (articleIds.length === 0) {
          setSentences([]);
          setLoading(false);
          return;
        }
        const { data: sentencesData, error: sentenceError } = await supabase
          .from('sentences')
          .select('*')
          .in('article_id', articleIds);
        if (sentenceError) setError('문장 불러오기 실패');
        else setSentences((sentencesData ?? []) as Sentence[]);
        setLoading(false);
      });
  }, [id]);

  // 힌트 출력 유틸
  const renderHints = (hints: string[] | string | null | undefined) => {
    if (Array.isArray(hints) && hints.length > 0) {
      return hints.join(', ');
    }
    if (typeof hints === 'string' && hints.trim() !== '') {
      try {
        const parsed = JSON.parse(hints);
        if (Array.isArray(parsed)) return parsed.join(', ');
        return hints;
      } catch {
        return hints;
      }
    }
    return '힌트가 없습니다';
  };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #eee' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>영작/추천 문장 리스트</h2>
      {loading && <div style={{ color: '#888', marginBottom: 12 }}>로딩 중...</div>}
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      {sentences.length === 0 ? (
        <div style={{ color: '#aaa', textAlign: 'center', margin: '40px 0' }}>아직 영작/문장이 없습니다.</div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {sentences.map((s, i) => (
            <div key={i} style={{ borderBottom: '1px solid #eee', padding: '18px 0' }}>
              <div style={{ fontSize: 17, marginBottom: 8 }}>{s.translation}</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button onClick={() => setShowOriginal(prev => ({ ...prev, [i]: !prev[i] }))}>
                  {showOriginal[i] ? '숨기기' : '원문 보기'}
                </button>
                <button onClick={() => setShowHints(prev => ({ ...prev, [i]: !prev[i] }))}>
                  {showHints[i] ? '숨기기' : '힌트 보기'}
                </button>
              </div>
              {showOriginal[i] && (
                <div style={{ margin: '8px 0', color: '#333' }}>
                  {s.text ? s.text : '원문이 없습니다'}
                </div>
              )}
              {showHints[i] && (
                <div style={{ margin: '8px 0', color: '#0984e3' }}>
                  {renderHints(s.hints)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <button
          style={{ background: '#222', color: '#fff', borderRadius: 6, padding: '10px 24px', fontWeight: 600 }}
          onClick={() => router.push('/dashboard')}
        >
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  );
}
