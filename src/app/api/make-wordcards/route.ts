import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface WordCardResult {
  word: string;
  part_of_speech: string;
  meaning: string;
  example: string;
}

// POST 핸들러 타입 명확히!
export const POST = async (req: Request): Promise<Response> => {
  // req.json() 타입 명시
  const { words }: { words: { word: string; meaning: string }[] } = await req.json();
  const wordList = words.map((w) => w.word).join(', ');

  const prompt = `\n아래 단어/숙어 리스트에 대해, 각 항목별로 (1)단어, (2)품사, (3)뜻(반드시 한국어로), (4)예문을 아래와 같은 JSON 배열로 만들어줘:\n\n[\n  {\n    "word": "...",\n    "part_of_speech": "...",\n    "meaning": "...",\n    "example": "..."\n  },\n  ...\n]\n단어/숙어 리스트:\n${wordList}\n`;

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
    const result: WordCardResult[] = JSON.parse(jsonString);
    return new Response(JSON.stringify({ result }), { status: 200 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
};
