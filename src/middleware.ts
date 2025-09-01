import { NextResponse } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Create response
  const response = NextResponse.next();

  // Content Security Policy (relaxed for dev preview embedding)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: gateway.pinata.cloud ipfs.io cdn.builder.io",
    "connect-src 'self' api.openai.com testnet.storyrpc.io gateway.pinata.cloud",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors *",
    "upgrade-insecure-requests"
  ].join('; ');

  // Security headers
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Remove X-Frame-Options to allow embedding in Builder preview iframe
  response.headers.delete('X-Frame-Options');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=*, microphone=*, geolocation=()');

  // Remove server info
  response.headers.delete('Server');
  response.headers.delete('X-Powered-By');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
