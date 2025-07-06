import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SentenceResult {
  sentence: string;
  hints: string[];
  translation: string;
}

export const POST = async (req: Request) => {
  const { articleText, sentenceCount, articleId } = await req.json();

  const prompt = `\n아래 영어 기사 본문에서, 영어를 배우는 학생이 영작 연습에 도움이 될 만한 문장 ${sentenceCount}개를 추천해줘.\n조건:\n- 문장 구조가 명확하고, 영작하는데 좋은 구조를 가지고 있는 문장. 약간 난이도 있는 문장.\n- 영작 연습에 활용하기 좋은 문장\n\n각 문장별로:\n1. 원문 문장\n2. (힌트) 문장 해석에 핵심이 되는 단어/표현 2~4개\n3. (정답) 문장 전체의 직역/해석\n\n아래와 같은 JSON 형태로 답변해줘:\n[\n  {\n    "sentence": "...",\n    "hints": ["...", "..."],\n    "translation": "..."\n  },\n  ...\n]\n기사 본문:\n${articleText}\n`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    const content = completion.choices[0].message?.content || '';
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']');
    const jsonString = content.substring(jsonStart, jsonEnd + 1);
    const result: SentenceResult[] = JSON.parse(jsonString);

    // DB 저장 (sentences 테이블)
    if (articleId) {
      const inserts = result.map((item) => ({
        article_id: articleId,
        text: item.sentence,
        translation: item.translation,
        hints: item.hints,
      }));
      await supabase.from('sentences').insert(inserts);
    }

    return new Response(JSON.stringify({ result }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: String((error as Error)?.message || error) }), { status: 500 });
  }
}; 