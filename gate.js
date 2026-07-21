/* ==========================================================================
   오늘경리 — 비밀번호 게이트 순수 로직

   Vercel 의존성이 없는 부분만 모아둔다. 브라우저·Edge 양쪽에서 그대로
   돌아가므로 middleware.js 가 쓰는 코드를 그대로 테스트할 수 있다.
   ========================================================================== */

export const COOKIE  = 'ok_gate';
export const MAX_AGE = 60 * 60 * 12;   // 12시간

/** 길이·내용 비교 시간을 일정하게 유지 */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmac(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** "만료시각.서명" 토큰 발급 */
export async function issueToken(secret, now = Date.now()) {
  const exp = String(now + MAX_AGE * 1000);
  return exp + '.' + await hmac(secret, exp);
}

export async function verifyToken(secret, token, now = Date.now()) {
  if (!token) return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp)) return false;
  if (Number(exp) < now) return false;
  return safeEqual(sig, await hmac(secret, exp));
}

export function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** 오픈 리다이렉트 방지 — 같은 사이트 내부 경로만 허용 */
export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store, must-revalidate',
  'x-robots-tag': 'noindex, nofollow',
};

/* ---------------------------------------------------------------------
   화면
   --------------------------------------------------------------------- */
function shell(body, wide) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>오늘경리</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
    background:#F1ECE7;color:#2A2420;
    font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;
    -webkit-font-smoothing:antialiased}
  .card{width:100%;max-width:380px;padding:34px 30px 30px;background:#fff;
    border:1px solid #EFE2DA;border-radius:24px;box-shadow:0 12px 30px rgba(80,60,50,.07)}
  .card.setup{max-width:520px}
  .logo{text-align:center;font-size:20px;font-weight:800;letter-spacing:-.02em;margin-bottom:20px}
  .logo span{color:#E07856}
  .lock{width:52px;height:52px;margin:0 auto 16px;border-radius:16px;background:#FBEDE6;
    display:flex;align-items:center;justify-content:center}
  h1{text-align:center;font-size:19px;font-weight:800;letter-spacing:-.02em;margin-bottom:7px}
  p.lead{text-align:center;font-size:13.5px;color:#6F665E;line-height:1.6;margin-bottom:22px}
  label{display:block;font-size:12.5px;font-weight:700;color:#C9603F;margin-bottom:7px}
  input{width:100%;padding:13px 14px;border:1.5px solid #ECC9B9;border-radius:12px;
    background:#fff;font:inherit;font-size:15px;color:#2A2420;letter-spacing:.08em}
  input::placeholder{color:#BDB2A8;letter-spacing:normal}
  input:focus{outline:none;border-color:#E07856;box-shadow:0 0 0 3px rgba(224,120,86,.15)}
  button{width:100%;margin-top:14px;padding:14px;border:none;border-radius:14px;
    background:#E07856;color:#fff;font:inherit;font-size:15px;font-weight:800;cursor:pointer;
    box-shadow:0 9px 20px rgba(224,120,86,.3)}
  button:hover{background:#C9603F}
  .err{display:flex;align-items:center;gap:7px;margin-bottom:14px;padding:11px 13px;
    background:#FDECEA;border:1px solid #F3C9C2;border-radius:11px;
    font-size:12.5px;font-weight:600;color:#C0392B}
  .note{margin-top:18px;padding-top:16px;border-top:1px solid #F4EEE8;
    font-size:11.5px;color:#A39A91;line-height:1.6;text-align:center}
  .setup h1,.setup p.lead{text-align:left}
  .setup code{display:block;margin:10px 0;padding:12px 14px;background:#FAF6F2;
    border:1px solid #EFE2DA;border-radius:10px;font-size:12.5px;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-all}
  .setup ol{margin:14px 0 0 18px;font-size:13.5px;color:#4A423B;line-height:1.9}
</style>
</head>
<body><div class="card${wide ? ' setup' : ''}">${body}</div></body>
</html>`;
}

export function loginPage(nextPath, failed) {
  return shell(`
    <div class="logo">오늘<span>경리</span></div>
    <div class="lock">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9603F"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="10" width="16" height="11" rx="2.5"></rect>
        <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
      </svg>
    </div>
    <h1>비밀번호를 입력해주세요</h1>
    <p class="lead">아직 공개 전인 사이트예요.<br>전달받으신 비밀번호를 넣어주세요.</p>
    ${failed ? `<div class="err">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"></circle><path d="M12 8v5M12 16.5v.01"></path>
      </svg>
      비밀번호가 맞지 않아요. 다시 확인해주세요.
    </div>` : ''}
    <form method="POST" action="/__gate">
      <input type="hidden" name="next" value="${escapeHtml(nextPath)}">
      <label for="pw">비밀번호</label>
      <input id="pw" name="password" type="password" inputmode="numeric"
             autocomplete="current-password" placeholder="비밀번호 입력" autofocus required>
      <button type="submit">들어가기</button>
    </form>
    <p class="note">문의: albatoday26@gmail.com</p>`, false);
}

/** SITE_PASSWORD 미설정 시 — 열어주지 않고 안내만 한다 */
export function setupPage() {
  return shell(`
    <div class="logo">오늘<span>경리</span></div>
    <h1>비밀번호가 아직 설정되지 않았어요</h1>
    <p class="lead">
      보안을 위해 비밀번호가 없으면 사이트를 열지 않습니다.
      Vercel에서 환경 변수를 설정한 뒤 다시 배포해주세요.
    </p>
    <ol>
      <li>Vercel 프로젝트 → <b>Settings</b> → <b>Environment Variables</b></li>
      <li>아래 변수를 추가 (Production·Preview·Development 모두 체크)</li>
      <code>Name:  SITE_PASSWORD
Value: (원하는 비밀번호)</code>
      <li><b>Deployments</b> 탭 → 최신 배포 → <b>Redeploy</b></li>
    </ol>
    <p class="note">환경 변수는 저장소에 올라가지 않아 GitHub에서 보이지 않습니다.</p>`, true);
}
