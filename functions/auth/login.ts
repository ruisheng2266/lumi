/**
 * functions/auth/login.ts
 * 发起 Google OAuth 登录（含 PKCE —— 缺口④）
 */

import type { PagesFunctionContext } from '../utils/types';
import { generateCodeVerifier, pkceChallenge } from '../utils/pkce';

interface Env {
  GOOGLE_CLIENT_ID: string;
  PUBLIC_URL: string;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response> | Response;

export const onRequestGet: Handler = async ({ env }) => {
  const state = crypto.randomUUID();
  const verifier = await generateCodeVerifier();
  const challenge = await pkceChallenge(verifier);

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.PUBLIC_URL}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const secure = env.PUBLIC_URL.startsWith('https');
  const makeCookie = (value: string) =>
    (secure ? `${value}; Secure` : value);

  const headers = new Headers({
    Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  });
  headers.append('Set-Cookie', makeCookie(`oauth_state=${state}; Path=/auth/callback; HttpOnly; SameSite=Lax; Max-Age=600`));
  headers.append('Set-Cookie', makeCookie(`pkce_verifier=${verifier}; Path=/auth/callback; HttpOnly; SameSite=Lax; Max-Age=600`));

  return new Response(null, {
    status: 302,
    headers,
  });
};
