// ============================================================================
// JADIJCB: Application Entry Point & Supabase Config Guard
// ============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n'; // Initialize i18next & apply HTML dir/lang
import { AlertTriangle, Database, Key, Terminal, ExternalLink } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.trim() !== '' &&
  supabaseAnonKey.trim() !== ''
);

// Full-screen bilingual configuration error screen
const ConfigurationErrorScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0B1220] text-white flex items-center justify-center p-4 sm:p-6 lg:p-8 antialiased selection:bg-[#FFB400] selection:text-[#0B1220]">
      <div className="max-w-3xl w-full bg-[#111A2E] border border-slate-700/80 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
        {/* Brand & Alert Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FFB400] text-[#0B1220] flex items-center justify-center font-black text-xl shadow-md shrink-0">
              JCB
            </div>
            <div>
              <span className="text-xs font-bold text-[#FFB400] tracking-wider uppercase">
                JADIJCB B2B Platform
              </span>
              <h1 className="text-lg font-black text-white">
                إعدادات الربط مع Supabase غير مكتملة
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>Missing Environment Variables</span>
          </div>
        </div>

        {/* Bilingual Explanations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-start">
          {/* Arabic (RTL) */}
          <div dir="rtl" className="space-y-3 bg-[#0B1220]/60 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-[#FFB400] font-black text-sm">
              <Database className="w-4 h-4" />
              <span>إعدادات قاعدة البيانات والمصادقة</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              لتشغيل منصة JADIJCB وتفعيل تسجيل الدخول برقم الهاتف وإدارة الآليات، يلزم توفير متغيرات البيئة الخاصة بمشروع Supabase في ملف <code className="text-[#FFB400] bg-slate-800 px-1.5 py-0.5 rounded font-mono">.env</code>.
            </p>
            <ol className="text-[11px] text-slate-400 space-y-1.5 list-decimal list-inside pr-1">
              <li>انسخ ملف <span className="text-white font-mono">.env.example</span> إلى <span className="text-white font-mono">.env</span>.</li>
              <li>أضف رابط المشروع <span className="text-white font-mono">URL</span> ومفتاح <span className="text-white font-mono">anon key</span>.</li>
              <li>أعد تشغيل الخادم المحلي عبر <span className="text-white font-mono">npm run dev</span>.</li>
            </ol>
          </div>

          {/* French (LTR) */}
          <div dir="ltr" className="space-y-3 bg-[#0B1220]/60 p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-[#FFB400] font-black text-sm">
              <Key className="w-4 h-4" />
              <span>Configuration Supabase requise</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Pour exécuter l'application JADIJCB et activer l'authentification et les données en temps réel, vous devez configurer les clés de votre projet Supabase dans le fichier <code className="text-[#FFB400] bg-slate-800 px-1.5 py-0.5 rounded font-mono">.env</code>.
            </p>
            <ol className="text-[11px] text-slate-400 space-y-1.5 list-decimal list-inside pl-1">
              <li>Copiez <span className="text-white font-mono">.env.example</span> vers <span className="text-white font-mono">.env</span>.</li>
              <li>Renseignez vos clés <span className="text-white font-mono">VITE_SUPABASE_URL</span> et <span className="text-white font-mono">ANON_KEY</span>.</li>
              <li>Redémarrez le serveur via <span className="text-white font-mono">npm run dev</span>.</li>
            </ol>
          </div>
        </div>

        {/* Example .env Snippet */}
        <div dir="ltr" className="space-y-2 text-start">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2 font-mono">
              <Terminal className="w-3.5 h-3.5 text-[#FFB400]" />
              .env
            </span>
            <span className="text-[10px] text-slate-500">Root Directory</span>
          </div>

          <div className="bg-[#070B14] border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-200 overflow-x-auto space-y-1">
            <p className="text-slate-500"># Supabase Project Credentials</p>
            <p>
              <span className="text-[#FFB400]">VITE_SUPABASE_URL</span>=
              <span className="text-emerald-400">https://your-project.supabase.co</span>
            </p>
            <p>
              <span className="text-[#FFB400]">VITE_SUPABASE_ANON_KEY</span>=
              <span className="text-emerald-400">eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</span>
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <span>JADIJCB Moroccan Heavy Machinery Platform</span>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[#FFB400] hover:underline font-bold"
          >
            <span>Supabase Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {isSupabaseConfigured ? <App /> : <ConfigurationErrorScreen />}
  </React.StrictMode>
);
