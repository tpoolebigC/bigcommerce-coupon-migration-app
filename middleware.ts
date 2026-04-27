export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);

  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').filter(Boolean).map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );

  if (cookies['hive-auth'] === 'authenticated') return;

  if (url.searchParams.get('password') === 'hive2026') {
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.pathname,
        'Set-Cookie': 'hive-auth=authenticated; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800',
      },
    });
  }

  const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Protected</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:hsl(220,30%,12%);color:#e0e0e0;min-height:100vh;display:flex;align-items:center;justify-content:center}
.g{text-align:center;max-width:360px;padding:2rem}
h1{font-size:2rem;margin-bottom:.5rem}
p{color:#888;margin-bottom:1.5rem;font-size:.9rem}
form{display:flex;gap:.5rem}
input{flex:1;padding:.7rem 1rem;border-radius:8px;border:1px solid #333;background:hsl(220,28%,15%);color:#fff;font-size:.95rem;outline:none}
input:focus{border-color:hsl(235,80%,60%)}
button{padding:.7rem 1.5rem;border-radius:8px;border:none;background:hsl(235,80%,60%);color:#fff;font-weight:600;cursor:pointer;font-size:.95rem}
</style></head><body>
<div class="g"><h1>Protected</h1><p>This deployment is password protected.</p>
<form method="GET"><input type="password" name="password" placeholder="Enter password" autofocus/>
<button type="submit">Enter</button></form></div></body></html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
}
