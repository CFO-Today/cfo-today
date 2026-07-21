/* ==========================================================================
   오늘경리 — 사이트 전체 비밀번호 게이트 (Vercel Routing Middleware)

   Vercel 내장 Password Protection은 Pro 전용이라 Hobby에서 직접 구현한다.
   미들웨어는 CDN 캐시보다 먼저 실행되므로 HTML뿐 아니라 CSS·JS 등
   정적 파일 요청도 전부 여기서 막힌다.

   비밀번호는 코드에 두지 않는다 — 이 저장소는 공개(public)라서
   하드코딩하면 GitHub에서 그대로 읽힌다. Vercel 환경 변수로만 받는다.

     SITE_PASSWORD  (필수)  접속 비밀번호
     GATE_SECRET    (선택)  쿠키 서명 키. 없으면 SITE_PASSWORD 로 대체

   순수 로직은 gate.js 에 있다 (테스트 가능하도록 분리).
   ========================================================================== */

import { next } from '@vercel/functions';
import {
  COOKIE, MAX_AGE, HTML_HEADERS,
  safeEqual, issueToken, verifyToken, readCookie, safeNext,
  loginPage, setupPage,
} from './gate.js';

export const config = {
  // _vercel 내부 경로만 빼고 전부 가로챈다
  matcher: '/((?!_vercel).*)',
};

const FAIL_DELAY = 400;   // 오입력 시 지연 (무차별 대입 완화)

export default async function middleware(request) {
  const url = new URL(request.url);
  const password = process.env.SITE_PASSWORD;

  // 설정 누락 시 fail closed — 절대 그냥 통과시키지 않는다
  if (!password) {
    return new Response(setupPage(), { status: 503, headers: HTML_HEADERS });
  }

  const secret = process.env.GATE_SECRET || password;

  // 로그인 처리
  if (url.pathname === '/__gate') {
    if (request.method !== 'POST') {
      return new Response(null, { status: 303, headers: { location: '/' } });
    }

    let entered = '';
    let target = '/';
    try {
      const form = await request.formData();
      entered = String(form.get('password') ?? '');
      target = safeNext(String(form.get('next') ?? '/'));
    } catch {
      /* 폼 파싱 실패 → 아래 실패 처리로 넘어간다 */
    }

    if (safeEqual(entered, password)) {
      const token = await issueToken(secret);
      return new Response(null, {
        status: 303,
        headers: {
          location: target,
          'set-cookie':
            `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`,
          'cache-control': 'no-store',
        },
      });
    }

    await new Promise((r) => setTimeout(r, FAIL_DELAY));
    return new Response(loginPage(target, true), { status: 401, headers: HTML_HEADERS });
  }

  // 통과 여부 판정
  const token = readCookie(request.headers.get('cookie'), COOKIE);
  if (await verifyToken(secret, token)) {
    return next();
  }

  return new Response(loginPage(url.pathname + url.search, false), {
    status: 401,
    headers: HTML_HEADERS,
  });
}
