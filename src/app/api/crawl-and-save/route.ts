import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
//import { PostgrestSingleResponse } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import puppeteer from 'puppeteer';

// 1. articles 테이블 타입 선언 (실제 컬럼에 맞게 수정)

// 2. 기사 본문 크롤링 함수
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
      '.article__content', // CNN, BBC 등 다양한 기사 본문 selector
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

// 3. API Route (POST)
export const POST = async (req: Request): Promise<Response> => {
  const supabase = createRouteHandlerClient({ cookies });

  // 요청 값 타입 명시 (TypeScript!)
  const { url, articleId }: { url: string; articleId: number } = await req.json();

  if (!url || !articleId) {
    return new Response(JSON.stringify({ error: 'url, articleId 필요' }), { status: 400 });
  }

  try {
    // 크롤링
    const text = await crawlArticle(url);
    if (!text) return new Response(JSON.stringify({ error: '본문 추출 실패' }), { status: 500 });
    // Supabase update (반환값 타입 안전!)
    const result = await supabase
      .from('articles')
      .update({ text })
      .eq('id', articleId)
      .select()
      .single();

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
};
