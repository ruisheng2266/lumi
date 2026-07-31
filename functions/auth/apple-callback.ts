/**
 * functions/auth/apple-callback.ts
 * Sign in with Apple 回调：PKCE 校验 + code 换 token + 验 id_token + 完成登录（缺口⑤）
 *
 * 兼容：隐私中继邮箱（@privaterelay.appleid.com）、首次授权才返回 name（后续为空）。
 */

import type { PagesFunctionContext, D1Database } from '../utils/types';
import { completeOAuthLogin } from '../utils/oauth';
import {
  getOAuthStateFromCookie,
  getPkceVerifierFromCookie,
} from '../utils/session';
import { pkceChallenge } from '../utils/pkce';
import { generateAppleClientSecret, verifyAppleIdToken } from '../utils/apple-jwt';

interface Env {
  APPLE_CLIENT_ID: string; // Service ID
  APPLE_TEAM_ID: string;
  APPLE_KEY_ID: string;
  APPLE_P8: string; // p8 私钥内容（secret）
  APPLE_REDIRECT_URI: string;
  PUBLIC_URL: string;
  DB: D1Database;
}

interface AppleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
}

type Handler = (context: PagesFunctionContext<Env>) => Promise<Response> | Response;

export const onRequestPost: Handler = async (context) => {
  const { request, env } = context;
  const secure = env.PUBLIC_URL.startsWith('https');
  const fail = (reason: string) =>
    Response.redirect(`${env.PUBLIC_URL}/?auth_error=${encodeURIComponent(reason)}`, 302);

  const form = await request.formData();
  const code = (form.get('code') as string | null) || new URL(request.url).searchParams.get('code');
  const state = (form.get('state') as string | null) || new URL(request.url).searchParams.get('state');
  const idToken = (form.get('id_token') as string | null) || undefined;
  const codeChallenge =
    (form.get('code_challenge') as string | null) || new URL(request.url).searchParams.get('code_challenge');
  const userRaw = form.get('user') as string | null; // 首次授权才返回

  if (!code || !state) return fail('missing_params');

  // 1. state 校验
  const cookieState = getOAuthStateFromCookie(request);
  if (!cookieState || cookieState !== state) {
    return new Response('State mismatch (CSRF protection)', { status: 400 });
  }

  // 2. PKCE 校验
  const verifier = getPkceVerifierFromCookie(request);
  if (!verifier) return new Response('Missing PKCE verifier', { status: 400 });
  if (!codeChallenge || (await pkceChallenge(verifier)) !== codeChallenge) {
    return new Response('PKCE verification failed', { status: 400 });
  }

  try {
    // 3. 用 code 换 token（client_secret 为 p8 签发的 JWT）
    const clientSecret = await generateAppleClientSecret(
      env.APPLE_TEAM_ID,
      env.APPLE_CLIENT_ID,
      env.APPLE_KEY_ID,
      env.APPLE_P8,
    );
    const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: env.APPLE_CLIENT_ID,
        client_secret: clientSecret,
        redirect_uri: env.APPLE_REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    if (!tokenRes.ok) return fail('apple_token_failed');
    const tokens = (await tokenRes.json()) as AppleTokenResponse;

    // 4. 校验 id_token（签名 + iss/aud/exp），拿到 sub 与 email
    const idt = tokens.id_token ?? idToken;
    if (!idt) return fail('missing_id_token');
    const payload = await verifyAppleIdToken(idt, env.APPLE_CLIENT_ID);

    let name: string | null = null;
    if (userRaw) {
      try {
        const u = JSON.parse(userRaw) as { name?: { firstName?: string; lastName?: string } };
        if (u.name) {
          const parts = [u.name.firstName, u.name.lastName].filter(Boolean);
          if (parts.length) name = parts.join(' ');
        }
      } catch {
        // 忽略异常的 user 字段
      }
    }

    return await completeOAuthLogin(
      env.DB,
      {
        provider: 'apple',
        sub: payload.sub,
        email: payload.email ?? '',
        name,
        picture: null,
      },
      secure,
    );
  } catch (err) {
    console.error('Apple callback error:', err);
    return fail('internal_error');
  }
};

// Apple 同时支持 GET（部分回调场景）与 POST（form POST）
export const onRequestGet: Handler = async (context) => onRequestPost(context);
