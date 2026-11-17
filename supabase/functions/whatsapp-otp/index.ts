// ============================================================================
// JADIJCB: Supabase Edge Function for Automated WhatsApp OTP & Password Reset
// Supports Meta WhatsApp Cloud API, UltraMsg, and Custom Webhook (Evolution/n8n)
// Deploy with: supabase functions deploy whatsapp-otp
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizeMoroccanPhone(rawInput: string): string {
  let cleaned = String(rawInput || '').trim().replace(/[\s\-\.\(\)\/]/g, '');
  if (cleaned.startsWith('00212')) cleaned = '+212' + cleaned.slice(5);
  else if (cleaned.startsWith('212') && !cleaned.startsWith('+212')) cleaned = '+212' + cleaned.slice(3);
  if ((cleaned.startsWith('06') || cleaned.startsWith('07')) && cleaned.length === 10) {
    cleaned = '+212' + cleaned.slice(1);
  }
  if ((cleaned.startsWith('6') || cleaned.startsWith('7')) && cleaned.length === 9) {
    cleaned = '+212' + cleaned;
  }
  return /^\+212[67]\d{8}$/.test(cleaned) ? cleaned : '';
}

function generateSixDigitOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

function getConfiguredProvider(): 'meta' | 'ultramsg' | 'webhook' | 'none' {
  if (Deno.env.get('WHATSAPP_ACCESS_TOKEN') && Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')) {
    return 'meta';
  }
  if (Deno.env.get('ULTRAMSG_INSTANCE_ID') && Deno.env.get('ULTRAMSG_TOKEN')) {
    return 'ultramsg';
  }
  if (Deno.env.get('WHATSAPP_OTP_WEBHOOK_URL')) {
    return 'webhook';
  }
  return 'none';
}

async function dispatchWhatsAppOtp(
  phoneE164: string,
  otpCode: string,
  purpose: 'register' | 'reset_password',
  lang: 'ar' | 'fr'
): Promise<{ sent: boolean; provider: string; error?: string }> {
  const provider = getConfiguredProvider();
  if (provider === 'none') {
    return { sent: false, provider: 'none', error: 'GATEWAY_NOT_CONFIGURED' };
  }

  const digits = phoneE164.replace(/\D/g, '');
  const message =
    lang === 'fr'
      ? purpose === 'reset_password'
        ? `🔐 JADIJCB — Votre code de réinitialisation du mot de passe est : *${otpCode}*\nValable pendant 10 minutes. Ne le partagez avec personne.`
        : `✅ JADIJCB — Votre code d'activation de compte est : *${otpCode}*\nValable pendant 10 minutes.`
      : purpose === 'reset_password'
      ? `🔐 منصة JADIJCB — كود إعادة تعيين كلمة المرور الخاص بك هو: *${otpCode}*\nصالح لمدة 10 دقائق. لا تشاركه مع أي شخص.`
      : `✅ منصة JADIJCB — كود تفعيل حسابك هو: *${otpCode}*\nصالح لمدة 10 دقائق.`;

  if (provider === 'meta') {
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
    const templateName = (Deno.env.get('WHATSAPP_OTP_TEMPLATE_NAME') || '').trim();
    const templateLang = (Deno.env.get('WHATSAPP_OTP_TEMPLATE_LANG') || 'ar').trim();

    const bodyPayload = templateName
      ? {
          messaging_product: 'whatsapp',
          to: digits,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: otpCode }] },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: otpCode }],
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: digits,
          type: 'text',
          text: { preview_url: false, body: message },
        };

    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });
    if (!resp.ok) {
      const errTxt = await resp.text();
      return { sent: false, provider: 'meta', error: errTxt };
    }
    return { sent: true, provider: 'meta' };
  }

  if (provider === 'ultramsg') {
    const instanceId = Deno.env.get('ULTRAMSG_INSTANCE_ID')!;
    const token = Deno.env.get('ULTRAMSG_TOKEN')!;
    const resp = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        to: phoneE164,
        body: message,
      }),
    });
    if (!resp.ok) {
      const errTxt = await resp.text();
      return { sent: false, provider: 'ultramsg', error: errTxt };
    }
    return { sent: true, provider: 'ultramsg' };
  }

  const webhookUrl = Deno.env.get('WHATSAPP_OTP_WEBHOOK_URL')!;
  const webhookSecret = Deno.env.get('WHATSAPP_OTP_WEBHOOK_SECRET') || '';
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(webhookSecret ? { Authorization: `Bearer ${webhookSecret}` } : {}),
    },
    body: JSON.stringify({
      phone: phoneE164,
      digits,
      code: otpCode,
      purpose,
      lang,
      message,
    }),
  });
  if (!resp.ok) {
    const errTxt = await resp.text();
    return { sent: false, provider: 'webhook', error: errTxt };
  }
  return { sent: true, provider: 'webhook' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'SUPABASE_NOT_CONFIGURED' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status');

    if (action === 'status') {
      const provider = getConfiguredProvider();
      return new Response(
        JSON.stringify({
          success: true,
          gatewayConfigured: provider !== 'none',
          provider,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phone = normalizeMoroccanPhone(body.phone || '');
    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'INVALID_PHONE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send') {
      const purpose = body.purpose === 'reset_password' ? 'reset_password' : 'register';
      const lang = body.lang === 'fr' ? 'fr' : 'ar';

      const { data: exists } = await admin.rpc('check_phone_registered', { p_phone: phone });
      if (purpose === 'register' && exists) {
        return new Response(
          JSON.stringify({ success: false, error: 'PHONE_ALREADY_REGISTERED' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (purpose === 'reset_password' && !exists) {
        return new Response(
          JSON.stringify({ success: false, error: 'ACCOUNT_NOT_FOUND' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const provider = getConfiguredProvider();
      if (provider === 'none') {
        return new Response(
          JSON.stringify({
            success: true,
            delivery: 'gateway_not_configured',
            gatewayConfigured: false,
            provider: 'none',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const otpCode = generateSixDigitOtp();
      const { data: storeRes, error: storeErr } = await admin.rpc('store_whatsapp_otp', {
        p_phone: phone,
        p_purpose: purpose,
        p_code: otpCode,
        p_ttl_seconds: 600,
      });

      if (storeErr || !storeRes?.success) {
        return new Response(
          JSON.stringify({ success: false, error: storeRes?.error || storeErr?.message || 'OTP_STORE_FAILED' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const dispatch = await dispatchWhatsAppOtp(phone, otpCode, purpose, lang);
      if (!dispatch.sent) {
        return new Response(
          JSON.stringify({ success: false, error: 'WHATSAPP_SEND_FAILED', detail: dispatch.error }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          delivery: 'whatsapp',
          gatewayConfigured: true,
          provider: dispatch.provider,
          expiresInSeconds: 600,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify') {
      const purpose = body.purpose === 'reset_password' ? 'reset_password' : 'register';
      const { data: verRes, error: verErr } = await admin.rpc('verify_whatsapp_otp_code', {
        p_phone: phone,
        p_purpose: purpose,
        p_code: String(body.code || ''),
      });
      if (verErr || !verRes?.success) {
        return new Response(
          JSON.stringify({ success: false, error: verRes?.error || verErr?.message || 'INVALID_OTP' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ success: true, verified: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset_password') {
      const { data: resetRes, error: resetErr } = await admin.rpc('reset_password_with_whatsapp_otp', {
        p_phone: phone,
        p_code: String(body.code || ''),
        p_new_password: String(body.newPassword || ''),
      });
      if (resetErr || !resetRes?.success) {
        return new Response(
          JSON.stringify({ success: false, error: resetRes?.error || resetErr?.message || 'RESET_FAILED' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: 'UNKNOWN_ACTION' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
