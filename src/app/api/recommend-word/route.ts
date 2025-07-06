import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface WordResult {
  word: string;
  meaning: string;
  part_of_speech?: string;
  example?: string;
}

export const POST = async (req: Request): Promise<Response> => {
  // 타입 명시!
  const {
    articleText,
    wordCount,
    roundId,
    articleId,
  }: {
    articleText: string;
    wordCount: number;
    roundId: number;
    articleId: number;
  } = await req.json();

  const prompt = `\n아래 영어 기사 본문에서, 영어 학습자에게 어려울 수 있는 단어나 숙어/표현 ${wordCount}개를 추천해줘.\n각 항목에 대해 (1)영어 단어/숙어, (2)한글 뜻(무조건 한글 뜻이여야해)을 아래와 같은 JSON 배열로 만들어줘:\n\n[\n  {\n    "word": "...",\n    "meaning": "..."\n  },\n  ...\n]\n기사 본문:\n${articleText}\n`;

  try {
    console.log('OpenAI 프롬프트:', prompt);
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    console.log('OpenAI 응답:', completion);

    const content = completion.choices[0].message?.content || '';
    console.log('OpenAI content:', content);

    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']');
    const jsonString = content.substring(jsonStart, jsonEnd + 1);
    console.log('파싱할 JSON:', jsonString);

    const result: WordResult[] = JSON.parse(jsonString);
    console.log('파싱 결과:', result);

    // DB 저장 (word_cards 테이블)
    if (roundId && articleId) {
      const inserts = result.map((item) => ({
        round_id: roundId,
        article_id: articleId,
        word: item.word,
        meaning: item.meaning,
        part_of_speech: item.part_of_speech || null,
        example: item.example || null,
      }));
      const { data, error } = await supabase.from('word_cards').insert(inserts);
      console.log('DB insert result:', { data, error });
    }

    return new Response(JSON.stringify({ result }), { status: 200 });
  } catch (error: unknown) {  // 👈 타입 명시
    console.error('recommend-word API error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack);
    }
    return new Response(
      JSON.stringify({
        error: String(error instanceof Error ? error.message : error),
      }),
      { status: 500 }
    );
  }
};
