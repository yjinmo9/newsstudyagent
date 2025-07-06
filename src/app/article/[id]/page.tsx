"use client";

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Sentence {
  sentence: string;
  hints: string[];
  translation: string;
}

interface WordCandidate {
  word: string;
  meaning: string;
}

export default function ArticleResultPage() {
  // 모든 Hook은 최상단에서!
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [articleText, setArticleText] = useState('');
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [wordCandidates, setWordCandidates] = useState<WordCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOriginal, setShowOriginal] = useState<{ [idx: number]: boolean }>({});
  const [showHints, setShowHints] = useState<{ [idx: number]: boolean }>({});

  // 1. 마운트 체크(하이드레이션 오류 방지)
  useEffect(() => {
    setMounted(true);
    console.log('mounted true!');
  }, []);

  // 2. 데이터 fetch 등 모든 Hook은 최상단에서만!
  useEffect(() => {
    // mounted, id 모두 준비된 뒤에만 실행
    if (!mounted || !id) return;

    setLoading(true);
    setError('');
    supabase
      .from('articles')
      .select('text,round_id')
      .eq('id', id)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data?.text) {
          setError('기사 본문을 불러올 수 없습니다.');
          setLoading(false);
          return;
        }
        setArticleText(data.text);

        try {
          // 추천 문장/단어카드 API 호출
          const [sentRes, wordRes] = await Promise.all([
            fetch('/api/recommend-sent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                articleText: data.text,
                sentenceCount: 5,
                articleId: id,
              }),
            }),
            fetch('/api/recommend-word', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                articleText: data.text,
                wordCount: 10,
                roundId: data.round_id,
                articleId: id,
              }),
            }),
          ]);
          if (!sentRes.ok) {
            const err = await sentRes.json();
            setError('추천 문장 API 에러: ' + err.error);
            setLoading(false);
            return;
          }
          if (!wordRes.ok) {
            const err = await wordRes.json();
            setError('추천 단어카드 API 에러: ' + err.error);
            setLoading(false);
            return;
          }
          const { result: sentencesResult } = await sentRes.json();
          const { result: wordsResult } = await wordRes.json();
          setSentences(sentencesResult);
          setWordCandidates(wordsResult);
        } catch (e) {
          setError('OpenAI 분석에 실패했습니다.');
        }
        setLoading(false);
      });
  }, [mounted, id]); // 의존성 주의!

  // 단어카드 만들러 가기 버튼
  const handleGoToWordCards = async () => {
    if (!wordCandidates.length) {
      setError('추천 단어/숙어가 없습니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // articles에서 round_id 조회
      const { data: articleData, error: articleError } = await supabase.from('articles').select('round_id').eq('id', id).single();
      if (articleError || !articleData?.round_id) {
        setError('round_id를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }
      const roundId = articleData.round_id;
      // draft 데이터가 이미 있는지 확인
      const { data: draftData, error: draftError } = await supabase
        .from('word_cards')
        .select('id')
        .eq('round_id', roundId)
        .eq('status', 'draft');
      if (draftError) {
        setError('draft 데이터 조회 실패');
        setLoading(false);
        return;
      }
      if (!draftData || draftData.length === 0) {
        // 추천 단어/숙어 리스트를 draft로 insert
        const inserts = wordCandidates.map((item) => ({
          round_id: roundId,
          word: item.word,
          meaning: item.meaning,
          part_of_speech: '',
          status: 'draft',
        }));
        const { error: insertError } = await supabase.from('word_cards').insert(inserts);
        if (insertError) {
          setError('단어카드 insert 실패');
          setLoading(false);
          return;
        }
      }
      router.push(`/round/${roundId}/wordcards`);
    } catch (e: any) {
      setError('단어카드 이동 중 오류: ' + (e.message || e));
    }
    setLoading(false);
  };

  // 3. 렌더링에서 조건부 UI 반환
  if (!mounted) return <div>로딩중...</div>;
  console.log('렌더링!');

  return (
    <div style={{
      maxWidth: 800,
      margin: '40px auto',
      padding: 24,
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 2px 8px #eee'
    }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>추천 문장</h2>
      {loading && <div style={{ color: '#888', marginBottom: 12 }}>로딩 중...</div>}
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: 8 }}>해석</th>
            <th style={{ padding: 8 }}>원문</th>
            <th style={{ padding: 8 }}>힌트</th>
          </tr>
        </thead>
        <tbody>
          {sentences.map((s, i) => (
            <tr key={i}>
              <td style={{ padding: 8 }}>{s.translation}</td>
              <td style={{ padding: 8 }}>
                <button onClick={() => setShowOriginal(prev => ({ ...prev, [i]: !prev[i] }))} style={{ marginBottom: 4 }}>
                  {showOriginal[i] ? '숨기기' : '원문 보기'}
                </button>
                {showOriginal[i] && <div style={{ marginTop: 8 }}>{s.sentence}</div>}
              </td>
              <td style={{ padding: 8 }}>
                <button onClick={() => setShowHints(prev => ({ ...prev, [i]: !prev[i] }))} style={{ marginBottom: 4 }}>
                  {showHints[i] ? '숨기기' : '힌트 보기'}
                </button>
                {showHints[i] && <div style={{ marginTop: 8 }}>{s.hints.join(', ')}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '40px 0 16px' }}>추천 단어/숙어 리스트</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: 8 }}>영어 단어/숙어</th>
            <th style={{ padding: 8 }}>한글 뜻</th>
          </tr>
        </thead>
        <tbody>
          {wordCandidates.map((w, i) => (
            <tr key={i}>
              <td style={{ padding: 8 }}>{w.word}</td>
              <td style={{ padding: 8 }}>{w.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        style={{ background: '#0070f3', color: '#fff', borderRadius: 6, padding: '12px 32px', fontWeight: 700, fontSize: 18 }}
        onClick={handleGoToWordCards}
      >
        단어카드 만들러 가기
      </button>
    </div>
  );
}
