"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

interface WordCandidate {
  word: string;
  meaning: string;
}

interface WordCard {
  id?: number;
  word: string;
  part_of_speech: string;
  meaning: string;
}

export default function WordCardEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [candidates, setCandidates] = useState<WordCandidate[]>([]);
  const [customWord, setCustomWord] = useState('');
  const [customMeaning, setCustomMeaning] = useState('');
  const [finalCards, setFinalCards] = useState<WordCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'edit' | 'final'>('edit');
  const [saved, setSaved] = useState(false);
  const [articleId, setArticleId] = useState<number | null>(null);

  // 데이터 로딩
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    // article_id 조회
    supabase
      .from('articles')
      .select('id')
      .eq('round_id', Number(id))
      .then(({ data: articles }) => {
        if (articles && articles.length > 0) setArticleId(articles[0].id);
      });

    // 최종본 먼저
    supabase
      .from('word_cards')
      .select('*')
      .eq('round_id', Number(id))
      .eq('status', 'final')
      .then(({ data: finalData, error: finalError }) => {
        if (finalError) setError('단어카드 불러오기 실패');
        else if (finalData && finalData.length > 0) {
          setFinalCards(finalData as WordCard[]);
          setStep('final');
          setSaved(true);
          setLoading(false);
        } else {
          // draft(임시) 데이터
          supabase
            .from('word_cards')
            .select('*')
            .eq('round_id', Number(id))
            .eq('status', 'draft')
            .then(({ data: draftData, error: draftError }) => {
              if (draftError) setError('단어카드 불러오기 실패');
              else {
                setCandidates((draftData ?? []).map(({ word, meaning }) => ({ word, meaning })));
                setFinalCards((draftData ?? []) as WordCard[]);
                setStep('edit');
                setSaved(false);
              }
              setLoading(false);
            });
        }
      });
  }, [id]);

  // 단어 추가
  const handleAdd = () => {
    if (!customWord.trim()) return;
    // 뜻은 한글만
    if (!/^[가-힣ㄱ-ㅎㅏ-ㅣ\s]+$/.test(customMeaning.trim())) {
      setError('뜻은 반드시 한글로 입력해야 합니다.');
      return;
    }
    setCandidates(prev => [...prev, { word: customWord, meaning: customMeaning }]);
    setCustomWord('');
    setCustomMeaning('');
    setError('');
  };

  // 단어 삭제
  const handleDelete = (idx: number) => {
    setCandidates(prev => prev.filter((_, i) => i !== idx));
  };

  // 저장하기: candidates 전체를 draft로 DB 저장 + draft→final 변환
  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await supabase.from('word_cards').delete().eq('round_id', Number(id)).eq('status', 'draft');
      if (candidates.length > 0 && articleId) {
        const inserts = candidates.map(item => ({
          round_id: Number(id),
          article_id: articleId,
          word: item.word,
          meaning: item.meaning,
          part_of_speech: '',
          status: 'draft',
        }));
        await supabase.from('word_cards').insert(inserts);
      }
      // draft → final로 업데이트
      await supabase
        .from('word_cards')
        .update({ status: 'final' })
        .eq('round_id', Number(id))
        .eq('status', 'draft');
      setSaved(true);
      setStep('final');
      const { data } = await supabase
        .from('word_cards')
        .select('*')
        .eq('round_id', Number(id))
        .eq('status', 'final');
      setFinalCards((data ?? []) as WordCard[]);
    } catch (e) {
      setError('저장 실패');
    }
    setLoading(false);
  };

  // (OpenAI 기반 최종 표 만들기)
  const handleMakeFinal = async () => {
    setLoading(true);
    setError('');
    try {
      if (!articleId) {
        setError('article_id를 찾을 수 없습니다.');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/make-wordcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: candidates.map(item => ({
          word: item.word,
          meaning: item.meaning,
          part_of_speech: '',
          article_id: articleId,
        })) }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError('API 에러: ' + (err.error || res.statusText));
        setLoading(false);
        return;
      }
      const { result } = await res.json();
      setFinalCards(
        (result as WordCard[]).map((item: WordCard) => ({
          word: item.word,
          part_of_speech: item.part_of_speech,
          meaning: item.meaning,
        }))
      );
      // draft → final로 업데이트
      await supabase
        .from('word_cards')
        .update({ status: 'final' })
        .eq('round_id', Number(id))
        .eq('status', 'draft');
      const { data: finalCardsData } = await supabase
        .from('word_cards')
        .select('*')
        .eq('round_id', Number(id))
        .eq('status', 'final');
      setFinalCards((finalCardsData ?? []) as WordCard[]);
      setStep('final');
      setSaved(true);
    } catch (error) {
      setError('단어카드 표 생성 실패: ' + (error instanceof Error ? error.message : String(error)));
    }
    setLoading(false);
  };

  // 렌더링
  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #eee' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>단어카드 만들기</h2>
      {loading && <div style={{ color: '#888', marginBottom: 12 }}>로딩 중...</div>}
      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
      {step === 'edit' && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th>영어 단어/숙어</th>
                <th>한글 뜻</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ color: '#aaa', textAlign: 'center' }}>추천 단어/숙어가 없습니다. 직접 추가해보세요!</td>
                </tr>
              ) : (
                candidates.map((w, i) => (
                  <tr key={i}>
                    <td>{w.word}</td>
                    <td>{w.meaning}</td>
                    <td>
                      <button onClick={() => handleDelete(i)} style={{ color: 'red' }}>삭제</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <input
              value={customWord}
              onChange={e => setCustomWord(e.target.value)}
              placeholder='추가할 단어/숙어'
              style={{ flex: 1, padding: 6 }}
            />
            <input
              value={customMeaning}
              onChange={e => setCustomMeaning(e.target.value)}
              placeholder='뜻(한글만)'
              style={{ flex: 1, padding: 6 }}
            />
            <button onClick={handleAdd} style={{ padding: '6px 16px' }}>추가</button>
          </div>
          {!saved && (
            <button
              style={{ background: '#0070f3', color: '#fff', borderRadius: 6, padding: '10px 24px', fontWeight: 600 }}
              onClick={handleSave}
            >
              저장하기
            </button>
          )}
          {saved && (
            <>
              <div style={{ color: '#0070f3', fontWeight: 600, margin: '24px 0 16px' }}>저장 완료!</div>
              <button
                style={{ background: '#222', color: '#fff', borderRadius: 6, padding: '10px 24px', fontWeight: 600, marginBottom: 32 }}
                onClick={() => router.push(`/round/${id}/archive`)}
              >
                단어카드 보러가기
              </button>
            </>
          )}
        </>
      )}
      {step === 'final' && (
        <>
          <h3 style={{ fontSize: 20, fontWeight: 700, margin: '32px 0 16px' }}>최종 단어카드 표</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th>영어 단어/숙어</th>
                <th>품사</th>
                <th>한글 뜻</th>
              </tr>
            </thead>
            <tbody>
              {finalCards.map((w, i) => (
                <tr key={i}>
                  <td>{w.word}</td>
                  <td>{w.part_of_speech}</td>
                  <td>{w.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ color: '#0070f3', fontWeight: 600, marginBottom: 16 }}>저장 완료!</div>
          <button
            style={{ background: '#222', color: '#fff', borderRadius: 6, padding: '10px 24px', fontWeight: 600, marginBottom: 32 }}
            onClick={() => router.push(`/round/${id}/archive`)}
          >
            단어카드 보러가기
          </button>
        </>
      )}
    </div>
  );
}
