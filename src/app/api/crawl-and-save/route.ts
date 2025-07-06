import { createClient, PostgrestError } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
// 크롤링 함수
async function crawlArticle(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const selectors = [
      'section[name="articleBody"]',
      '.ssrcss-uf6wea-RichTextComponentWrapper',
      'article',
      '.article-body',
      '#articleBodyContents',
      '.story-body__inner',
      '.article__content', // ← CNN 등 실제 본문 selector 추가
    ];
    let content = '';
    for (const selector of selectors) {
      const exists = await page.$(selector);
      if (exists) {
        content = await page.$eval(selector, el => (el as HTMLElement).innerText);
        if (content && content.length > 100) break;
      }
    }
    await browser.close();
    return content.trim();
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// API Route (POST)
export const POST = async (req: Request): Promise<Response> => {
  // 타입 명확히 지정
  const { url, articleId }: { url: string; articleId: number } = await req.json();

  if (!url || !articleId) {
    return new Response(JSON.stringify({ error: 'url, articleId 필요' }), { status: 400 });
  }
  try {
    const text = await crawlArticle(url);
    if (!text) return new Response(JSON.stringify({ error: '본문 추출 실패' }), { status: 500 });

    // Supabase 반환값 타입 명확화
    const { error }: { error: PostgrestError | null } = await supabase
      .from('articles')
      .update({ text })
      .eq('id', articleId);

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
};
