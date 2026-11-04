import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  FileText,
  Building2,
  Phone,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useLanguage } from '../hooks/useLanguage';
import { MOCK_BOOKINGS } from '../data/mockData';
import { formatPriceMAD } from '../data/rentalTerms';
import { BookingStatus, Booking } from '../types/database';

export const BookingsPage: React.FC = () => {
  const { t, lang } = useLanguage();
  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS);
  const [selectedTab, setSelectedTab] = useState<BookingStatus | 'all'>('all');

  const filteredBookings = bookings.filter((b) => {
    if (selectedTab === 'all') return true;
    return b.status === selectedTab;
  });

  const handleUpdateStatus = (id: string, newStatus: BookingStatus) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    );
    toast.success(
      lang === 'fr'
        ? `Statut de la réservation mis à jour: ${newStatus}`
        : `تم تحديث حالة الحجز بنجاح إلى: ${newStatus}`
    );
  };

  const handleGenerateContract = (booking: Booking) => {
    toast.info(
      lang === 'fr'
        ? `Contrat B2B généré avec succès pour le chantier ${booking.site_address}`
        : `تم إصدار العقد التجاري الرقمي لورش ${booking.site_address}`
    );
  };

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
          {t('bookings.title')}
        </h1>
        <p className="text-xs text-steel-500 mt-1">
          {lang === 'fr'
            ? 'Supervisez les demandes de location, les bons de mise à disposition et les acomptes'
            : 'متابعة وتأكيد طلبات كراء الآليات، وصولات التسليم وعقود الورش'}
        </p>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-steel-200">
        {[
          { key: 'all', label: t('bookings.tab_all') },
          { key: 'pending', label: t('bookings.tab_pending') },
          { key: 'active', label: t('bookings.tab_active') },
          { key: 'completed', label: t('bookings.tab_completed') },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors min-h-[44px] cursor-pointer ${
              selectedTab === tab.key
                ? 'bg-ink text-white shadow-sm'
                : 'bg-white text-steel-600 hover:text-ink hover:bg-steel-50 border border-steel-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <Card className="p-10 text-center">
            <Clock className="w-8 h-8 text-steel-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-ink">
              {lang === 'fr' ? 'Aucune réservation dans cette catégorie' : 'لا توجد طلبات في هذا القسم حالياً'}
            </p>
          </Card>
        ) : (
          filteredBookings.map((b) => (
            <Card key={b.id} className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-steel-100">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-steel-400 uppercase">
                      #{b.id}
                    </span>
                    <Badge
                      variant={
                        b.status === 'active'
                          ? 'success'
                          : b.status === 'pending'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {b.status === 'pending'
                        ? t('bookings.tab_pending')
                        : b.status === 'active'
                        ? t('bookings.tab_active')
                        : t('bookings.tab_completed')}
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-ink">
                    {lang === 'fr' ? b.machine?.title_fr : b.machine?.title_ar}
                  </h3>
                </div>

                <div className="flex items-center gap-4 text-start">
                  <div>
                    <span className="text-[11px] text-steel-500 block">
                      {t('bookings.deposit')}
                    </span>
                    <span className="font-mono latin-nums font-bold text-xs text-steel-700">
                      {formatPriceMAD(b.deposit_amount, lang)}
                    </span>
                  </div>
                  <div className="ps-4 border-s border-steel-200">
                    <span className="text-[11px] text-steel-500 block">
                      {t('bookings.total')}
                    </span>
                    <span className="font-mono latin-nums font-extrabold text-base text-ink">
                      {formatPriceMAD(b.total_price, lang)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Renter & Site Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 text-xs">
                <div>
                  <span className="text-steel-400 block mb-1 font-semibold">
                    {lang === 'fr' ? 'Entreprise locataire' : 'المقاولة المستأجرة'}
                  </span>
                  <p className="font-bold text-ink flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary-dark" />
                    <span>{b.renter?.company_name || b.renter?.full_name}</span>
                  </p>
                  {b.renter?.ice_number && (
                    <p className="text-[11px] font-mono text-steel-500 mt-0.5">
                      ICE : {b.renter.ice_number}
                    </p>
                  )}
                </div>

                <div>
                  <span className="text-steel-400 block mb-1 font-semibold">
                    {t('bookings.dates')}
                  </span>
                  <p className="font-medium text-ink flex items-center gap-1.5 font-mono latin-nums">
                    <Calendar className="w-3.5 h-3.5 text-primary-dark" />
                    <span>
                      {b.start_date} → {b.end_date} ({b.duration_units}{' '}
                      {lang === 'fr' ? 'j' : 'أيام'})
                    </span>
                  </p>
                </div>

                <div>
                  <span className="text-steel-400 block mb-1 font-semibold">
                    {t('bookings.site')}
                  </span>
                  <p className="font-medium text-ink flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary-dark shrink-0" />
                    <span>{b.site_address}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-steel-100 flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateContract(b)}
                  leftIcon={<FileText className="w-3.5 h-3.5 text-primary-dark" />}
                >
                  {lang === 'fr' ? 'Bon de commande / Contrat PDF' : 'تنزيل العقد ووصل التسليم'}
                </Button>

                <div className="flex items-center gap-2">
                  {b.status === 'pending' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        className="font-bold"
                      >
                        {t('bookings.action_accept')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus(b.id, 'cancelled')}
                        leftIcon={<XCircle className="w-3.5 h-3.5 text-danger" />}
                      >
                        {t('bookings.action_reject')}
                      </Button>
                    </>
                  )}

                  {b.status === 'active' && (
                    <Button
                      variant="dark"
                      size="sm"
                      onClick={() => handleUpdateStatus(b.id, 'completed')}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                    >
                      {t('bookings.action_complete')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default BookingsPage;
