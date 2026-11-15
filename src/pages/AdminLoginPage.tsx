// ============================================================================
// JADIJCB: Dedicated Super Admin Login Portal
// Strictly for Platform Commander (said.cpge24@gmail.com)
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth, SUPER_ADMIN_EMAIL } from '../hooks/useAuth';

export const AdminLoginPage: React.FC = () => {
  const { lang, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { loginWithEmail } = useAuth();

  const [email, setEmail] = useState<string>(SUPER_ADMIN_EMAIL);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error(
        lang === 'fr'
          ? 'Veuillez saisir votre mot de passe administrateur'
          : 'يرجى إدخال كلمة مرور المشرف العام'
      );
      return;
    }

    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase().replace('٠', '0');

    try {
      const res = await loginWithEmail(cleanEmail, password);
      setIsLoading(false);

      if (res.success) {
        toast.success(
          lang === 'fr'
            ? 'Bienvenue dans la tour de contrôle Super Admin !'
            : 'مرحباً بك في لوحة التحكم العليا لمنصة JADIJCB!'
        );
        navigate('/admin');
      } else {
        toast.error(
          lang === 'fr'
            ? 'Identifiants invalides ou mot de passe incorrect'
            : 'بيانات الدخول غير صحيحة، يرجى التحقق من البريد الإلكتروني وكلمة المرور'
        );
      }
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err?.message || 'Erreur d\'authentification');
    }
  };

  return (
    <div className="min-h-screen bg-ink text-white flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background radial effects */}
      <div className="absolute top-0 start-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-primary/15 via-yellow-500/5 to-transparent pointer-events-none blur-3xl" />
      <div className="absolute bottom-0 end-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <header className="p-6 relative z-10 flex items-center justify-between border-b border-steel-800/80">
        <Logo variant="light" size="md" />
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-steel-400 hover:text-white transition-colors cursor-pointer"
        >
          <span>{lang === 'fr' ? 'Retour au site public' : 'الرجوع للموقع العام'}</span>
          {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </header>

      {/* Main Login Box */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10 my-8">
        <Card className="max-w-md w-full bg-steel-900/90 border border-steel-700/80 shadow-2xl rounded-3xl p-6 sm:p-8 backdrop-blur-xl text-start">
          {/* Top SuperAdmin Badge */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-amber-500 p-0.5 mx-auto mb-3 shadow-lg shadow-primary/20 flex items-center justify-center">
              <div className="w-full h-full bg-ink rounded-[14px] flex items-center justify-center text-primary">
                <ShieldAlert className="w-8 h-8" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-black uppercase tracking-wider mb-2 border border-primary/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'fr' ? 'Super Admin Portal' : 'قمة هرم المنصة · SUPER ADMIN'}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white">
              {lang === 'fr' ? 'Tour de Contrôle & Supervision' : 'تسجيل دخول المشرف العام'}
            </h1>
            <p className="text-xs text-steel-400 mt-1 max-w-xs mx-auto">
              {lang === 'fr'
                ? 'Accès réservé exclusivement au superviseur de la plateforme JADIJCB'
                : 'مراقبة كاملة وسلطة عليا على كافة حسابات الملاك والمقاولات في المغرب'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="text-xs font-bold text-steel-300 block mb-1.5 flex items-center justify-between">
                <span>{lang === 'fr' ? 'Adresse E-mail Super Admin' : 'البريد الإلكتروني المعتمد للسوبر أدمن'}</span>
                <span className="text-[10px] text-primary font-mono font-bold">Autorisé</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="said.cpge24@gmail.com"
                  className="w-full ps-10 pe-4 py-3 rounded-xl bg-steel-800 border border-steel-600 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all min-h-[48px]"
                  required
                />
                <Mail className="w-4 h-4 text-steel-400 absolute start-3.5 top-3.5" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="text-xs font-bold text-steel-300 block mb-1.5">
                {lang === 'fr' ? 'Mot de passe sécurisé' : 'كلمة المرور'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  minLength={6}
                  className="w-full ps-10 pe-11 py-3 rounded-xl bg-steel-800 border border-steel-600 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all min-h-[48px]"
                />
                <Lock className="w-4 h-4 text-steel-400 absolute start-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 end-3.5 flex items-center text-steel-400 hover:text-white cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Standard Login Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center font-black min-h-[48px] shadow-lg shadow-primary/20 text-xs"
              isLoading={isLoading}
              leftIcon={<KeyRound className="w-4 h-4" />}
            >
              {lang === 'fr' ? 'Se connecter en tant que Super Admin' : 'دخول المشرف العام بكلمة المرور'}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-steel-800 text-center">
            <span className="text-[11px] text-steel-400 block">
              {lang === 'fr'
                ? 'Authentification chiffrée requise via Supabase Auth'
                : 'دخول محمي ومشفر بكلمة المرور عبر نظام المصادقة الرسمي'}
            </span>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-[11px] text-steel-500 border-t border-steel-800/60 relative z-10">
        JADIJCB Security Architecture · SuperAdmin Access Gateway · Maroc
      </footer>
    </div>
  );
};

export default AdminLoginPage;
