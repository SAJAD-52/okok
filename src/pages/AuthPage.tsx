import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, ShieldCheck, Building2, Truck, Wrench, Sparkles } from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Card';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { MOROCCAN_CITIES } from '../data/cities';
import { UserRole } from '../types/database';

export const AuthPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('equipment_owner');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cityId, setCityId] = useState('casablanca');
  const [iceNumber, setIceNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      toast.success(t('common.success'));
      navigate('/app');
    }, 700);
  };

  const handleDemoLogin = (demoRole: UserRole) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success(
        lang === 'fr'
          ? `Connecté en tant que ${demoRole === 'equipment_owner' ? 'Propriétaire' : 'Entreprise BTP'}`
          : `تم تسجيل الدخول بنجاح كـ ${demoRole === 'equipment_owner' ? 'مالك آليات' : 'مقاولة بناء'}`
      );
      navigate('/app');
    }, 400);
  };

  const cityOptions = MOROCCAN_CITIES.map((c) => ({
    value: c.id,
    label: lang === 'fr' ? c.name_fr : c.name_ar,
  }));

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10 sm:py-16">
        <Card className="p-6 sm:p-8 bg-white border border-steel-200 shadow-elevated">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
              {mode === 'login' ? t('auth.login_title') : t('auth.register_title')}
            </h1>
            <p className="text-xs text-steel-500 mt-1">
              {mode === 'login'
                ? t('auth.login_subtitle')
                : t('auth.register_subtitle')}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-steel-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-2 text-xs font-bold rounded-lg transition-all min-h-[38px] cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-steel-600 hover:text-ink'
              }`}
            >
              {t('nav.login')}
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-2 text-xs font-bold rounded-lg transition-all min-h-[38px] cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-steel-600 hover:text-ink'
              }`}
            >
              {t('nav.register')}
            </button>
          </div>

          {/* Registration Role Selection */}
          {mode === 'register' && (
            <div className="mb-6">
              <label className="text-xs font-bold text-steel-700 block mb-2 text-start">
                {t('auth.role_select')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('contractor')}
                  className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all min-h-[64px] cursor-pointer ${
                    role === 'contractor'
                      ? 'border-primary bg-primary-100/50 text-ink font-bold'
                      : 'border-steel-200 text-steel-600 hover:bg-steel-50'
                  }`}
                >
                  <Building2 className="w-5 h-5 text-primary-dark" />
                  <span className="text-[11px] leading-tight">
                    {lang === 'fr' ? 'Entreprise BTP' : 'مقاولة بناء'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('equipment_owner')}
                  className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all min-h-[64px] cursor-pointer ${
                    role === 'equipment_owner'
                      ? 'border-primary bg-primary-100/50 text-ink font-bold'
                      : 'border-steel-200 text-steel-600 hover:bg-steel-50'
                  }`}
                >
                  <Truck className="w-5 h-5 text-primary-dark" />
                  <span className="text-[11px] leading-tight">
                    {lang === 'fr' ? 'Propriétaire' : 'مالك آليات'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('dealer')}
                  className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all min-h-[64px] cursor-pointer ${
                    role === 'dealer'
                      ? 'border-primary bg-primary-100/50 text-ink font-bold'
                      : 'border-steel-200 text-steel-600 hover:bg-steel-50'
                  }`}
                >
                  <Wrench className="w-5 h-5 text-primary-dark" />
                  <span className="text-[11px] leading-tight">
                    {lang === 'fr' ? 'Pièces' : 'قطع الغيار'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Input
                  label={t('auth.full_name')}
                  placeholder={lang === 'fr' ? 'ex. Karim Benjelloun' : 'مثال: كريم بنجلون'}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <Input
                  label={t('auth.company_name')}
                  placeholder={lang === 'fr' ? 'Atlas BTP S.A.R.L.' : 'شركة أطلس للأشغال'}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label={t('auth.city')}
                    options={cityOptions}
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value)}
                  />
                  <Input
                    label={t('auth.ice')}
                    placeholder="001928471000032"
                    value={iceNumber}
                    onChange={(e) => setIceNumber(e.target.value)}
                    hint={lang === 'fr' ? '15 chiffres' : '15 رقماً للشركات'}
                  />
                </div>
              </>
            )}

            <Input
              type="email"
              label={t('auth.email')}
              placeholder="contact@entreprise.ma"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {mode === 'register' && (
              <Input
                type="tel"
                label={t('auth.phone')}
                placeholder="+212 6 61 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                required
              />
            )}

            <Input
              type="password"
              label={t('auth.password')}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center mt-2 font-bold"
              isLoading={isLoading}
            >
              {mode === 'login' ? t('auth.btn_login') : t('auth.btn_register')}
            </Button>
          </form>

          {/* Quick Demo Login (One-click sandbox access) */}
          <div className="pt-6 mt-6 border-t border-steel-200">
            <p className="text-xs text-steel-500 mb-3 text-center">
              {lang === 'fr'
                ? 'Test rapide sans inscription (Mode Démo) :'
                : 'دخول تجريبي سريع بضغطة واحدة:'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDemoLogin('equipment_owner')}
                className="flex-1 justify-center text-xs"
                leftIcon={<Truck className="w-3.5 h-3.5 text-primary-dark" />}
              >
                {lang === 'fr' ? 'Démo Propriétaire JCB' : 'دخول كمالك آليات'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDemoLogin('contractor')}
                className="flex-1 justify-center text-xs"
                leftIcon={<Building2 className="w-3.5 h-3.5 text-steel-600" />}
              >
                {lang === 'fr' ? 'Démo Entreprise BTP' : 'دخول كمقاولة بناء'}
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default AuthPage;
