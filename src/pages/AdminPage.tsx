import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  Building2,
  Truck,
  Users,
} from 'lucide-react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { Footer } from '../components/layout/Footer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';

interface VerificationItem {
  id: string;
  company_name: string;
  ice_number: string;
  machine_title: string;
  city: string;
  submission_date: string;
  status: 'pending' | 'approved' | 'rejected';
}

export const AdminPage: React.FC = () => {
  const { t, lang } = useLanguage();

  const [items, setItems] = useState<VerificationItem[]>([
    {
      id: 'vrf_1',
      company_name: 'Détroit BTP & Carrières',
      ice_number: '002891442000019',
      machine_title: 'Caterpillar 320D - 21T',
      city: 'Tanger',
      submission_date: '2026-03-03',
      status: 'pending',
    },
    {
      id: 'vrf_2',
      company_name: 'Sud Aménagement & Voirie',
      ice_number: '001552399000041',
      machine_title: 'Bomag BW 213 D-5',
      city: 'Marrakech',
      submission_date: '2026-03-02',
      status: 'pending',
    },
  ]);

  const handleApprove = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'approved' } : item))
    );
    toast.success(
      lang === 'fr'
        ? 'Engin et documents d\'assurance homologués avec succès'
        : 'تم التحقق من الوثائق واعتماد الآلية بنجاح'
    );
  };

  const handleReject = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'rejected' } : item))
    );
    toast.error(
      lang === 'fr'
        ? 'Dossier rejeté pour pièces justificatives non conformes'
        : 'تم رفض الملف لعدم اكتمال الوثائق'
    );
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <PublicHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 text-start">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-primary-dark font-bold text-xs uppercase mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink">
            {t('admin.title')}
          </h1>
          <p className="text-xs text-steel-500 mt-1">
            {t('admin.subtitle')}
          </p>
        </div>

        {/* Platform Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-5">
            <div className="flex items-center justify-between text-steel-500 mb-2">
              <span className="text-xs font-semibold">{t('admin.total_platform_machines')}</span>
              <Truck className="w-5 h-5 text-primary-dark" />
            </div>
            <div className="text-2xl font-extrabold text-ink font-mono latin-nums">
              1 284
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between text-steel-500 mb-2">
              <span className="text-xs font-semibold">{t('admin.total_users')}</span>
              <Users className="w-5 h-5 text-primary-dark" />
            </div>
            <div className="text-2xl font-extrabold text-ink font-mono latin-nums">
              3 420
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between text-steel-500 mb-2">
              <span className="text-xs font-semibold">Taux de conformité ICE</span>
              <ShieldCheck className="w-5 h-5 text-success" />
            </div>
            <div className="text-2xl font-extrabold text-success font-mono latin-nums">
              99.2%
            </div>
          </Card>
        </div>

        {/* Verification Queue */}
        <Card className="p-6">
          <h2 className="text-base font-bold text-ink mb-4">
            {t('admin.pending_verifications')}
          </h2>

          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-steel-200 bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-ink">{item.machine_title}</span>
                    <Badge
                      variant={
                        item.status === 'approved'
                          ? 'success'
                          : item.status === 'rejected'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {item.status}
                    </Badge>
                  </div>

                  <p className="text-xs text-steel-600">
                    <Building2 className="w-3.5 h-3.5 inline me-1 text-steel-400" />
                    <span>{item.company_name}</span> · <span className="font-mono">ICE: {item.ice_number}</span> · <span>{item.city}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {item.status === 'pending' ? (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(item.id)}
                        leftIcon={<CheckCircle className="w-4 h-4" />}
                        className="font-bold"
                      >
                        {t('admin.verify_action')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(item.id)}
                        leftIcon={<XCircle className="w-4 h-4 text-danger" />}
                      >
                        {lang === 'fr' ? 'Rejeter' : 'رفض'}
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-steel-500">
                      {lang === 'fr' ? 'Dossier traité' : 'تمت المعالجة'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default AdminPage;
