/**
 * functions/auth/apple-login.ts
 * 发起 Sign in with Apple（authorization code + id_token flow，含 PKCE —— 缺口⑤）
 */

import type { PagesFunctionContext } from '../utils/types';
import { generateCodeVerifier, pkceChallenge } from '../utils/pkce';

interface Env {
  APPLE_CLIENT_ID: string; // Service ID
  APPLE_REDIRECT_URI: string;
  PUBLIC_URL: string;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response> | Response;

export const onRequestGet: Handler = async ({ env }) => {
  const state = crypto.randomUUID();
  const verifier = await generateCodeVerifier();
  const challenge = await pkceChallenge(verifier);

  const params = new URLSearchParams({
    client_id: env.APPLE_CLIENT_ID,
    redirect_uri: env.APPLE_REDIRECT_URI,
    response_type: 'code id_token',
    scope: 'name email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const secure = env.PUBLIC_URL.startsWith('https');
  const cookie = [
    `oauth_state=${state}; Path=/auth/apple/callback; HttpOnly; SameSite=Lax; Max-Age=600`,
    `pkce_verifier=${verifier}; Path=/auth/apple/callback; HttpOnly; SameSite=Lax; Max-Age=600`,
  ]
    .map((c) => (secure ? `${c}; Secure` : c))
    .join('; ');

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://appleid.apple.com/auth/authorize?${params}`,
      'Set-Cookie': cookie,
    },
  });
};
