// ============================================================================
// JADIJCB: Supplier Request Preview Modal ("ألق نظرة على الطلب")
// Shows complete Owner search campaign details (machine or spare part,
// fleet machine photo thumbnail if linked, customs/import prefs, location)
// with a primary "ابدأ محادثة" action to open direct Owner <-> Supplier chat.
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Truck,
  Wrench,
  Ship,
  MapPin,
  Phone,
  MessageSquare,
  Globe,
  Navigation,
  FileCheck2,
  Hash,
  Loader2,
  Building2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { DispatchNotification } from '../../types/database';
import {
  SupplierOpenRequestItem,
  startSupplierChatWithOwner,
} from '../../lib/dispatchService';
import { getImportCountryLabel } from '../../data/supplierOptions';
import { formatDistanceKm } from '../../lib/geoUtils';
import { formatPriceMAD } from '../../data/rentalTerms';

export type RequestPreviewPayload =
  | (Partial<SupplierOpenRequestItem> & Partial<DispatchNotification> & {
      campaign_id: string;
      contractor_id: string;
      company_name: string;
      machine_name: string;
      site_name: string;
    });

interface RequestDetailsModalProps {
  isOpen: boolean;
  request: RequestPreviewPayload | null;
  onClose: () => void;
  onOpenQuoteForm?: (req: RequestPreviewPayload) => void;
}

export const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({
  isOpen,
  request,
  onClose,
  onOpenQuoteForm,
}) => {
  const { lang } = useLanguage();
  const { user, profile, isImpersonating } = useAuth();
  const navigate = useNavigate();
  const [isStartingChat, setIsStartingChat] = useState(false);

  if (!isOpen || !request) return null;

  const supplierId = (isImpersonating ? profile?.id : user?.id || profile?.id) || '';
  const supplierName =
    profile?.company_name?.trim() ||
    profile?.full_name?.trim() ||
    (lang === 'fr' ? 'Fournisseur JADIJCB' : 'مورد معتمد');

  const isSpare =
    request.campaign_type === 'spare_part' || Boolean(request.part_reference);
  const isPurchase = request.campaign_type === 'machine_purchase';

  const handleStartChat = async () => {
    if (!supplierId || isStartingChat) return;
    setIsStartingChat(true);
    try {
      const { conversationId } = await startSupplierChatWithOwner({
        supplierId,
        supplierName,
        request: {
          campaign_id: request.campaign_id,
          notification_id: request.notification_id || request.id,
          contractor_id: request.contractor_id,
          company_name: request.company_name,
          campaign_type: request.campaign_type,
          machine_category: request.machine_category,
          machine_name: request.machine_name,
          part_reference: request.part_reference,
          part_category: request.part_category,
          budget_mad: request.budget_mad ?? null,
          import_allowed: request.import_allowed,
          preferred_origin: request.preferred_origin,
          desired_condition: request.desired_condition,
          desired_model: request.desired_model,
          customs_clearance: request.customs_clearance,
          has_fleet_machine: request.has_fleet_machine,
          fleet_machine_id: request.fleet_machine_id,
          fleet_machine_title: request.fleet_machine_title,
          fleet_machine_image: request.fleet_machine_image,
          fleet_machine_brand: request.fleet_machine_brand,
          fleet_machine_model: request.fleet_machine_model,
          fleet_machine_year: request.fleet_machine_year ?? null,
          site_name: request.site_name,
          site_city: request.site_city,
          site_lat: request.site_lat,
          site_lng: request.site_lng,
          site_phone: request.site_phone,
          distance_km: request.distance_km ?? null,
          is_nationwide: request.is_nationwide,
          notes: request.notes,
          matched_machine_id: request.matched_machine_id || request.machine_id,
          matched_machine_title: request.matched_machine_title,
        },
      });
      onClose();
      const targetMachine = request.matched_machine_id || request.machine_id || '';
      if (conversationId) {
        navigate(
          `/supplier/messages?conv=${encodeURIComponent(conversationId)}&campaign=${encodeURIComponent(
            request.campaign_id
          )}`
        );
      } else {
        navigate(
          `/supplier/messages?target=${encodeURIComponent(
            request.contractor_id
          )}&machine=${encodeURIComponent(targetMachine)}&campaign=${encodeURIComponent(
            request.campaign_id
          )}`
        );
      }
    } finally {
      setIsStartingChat(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-steel-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-ink text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary text-ink flex items-center justify-center shrink-0">
              {isSpare ? (
                <Wrench className="w-5 h-5" />
              ) : isPurchase && request.import_allowed ? (
                <Ship className="w-5 h-5" />
              ) : (
                <Truck className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-primary block">
                {isSpare
                  ? lang === 'fr'
                    ? 'Demande de pièce détachée'
                    : 'تفاصيل طلب قطعة غيار'
                  : lang === 'fr'
                  ? 'Demande d’achat / importation d’engin'
                  : 'تفاصيل طلب شراء / استيراد آلية'}
              </span>
              <h2 className="text-sm sm:text-base font-black text-white truncate">
                {request.machine_name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl text-steel-300 hover:text-white hover:bg-steel-800 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-start">
          {/* Linked Fleet Machine Card (if owner picked from fleet) */}
          {(request.fleet_machine_title || request.fleet_machine_image) && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-steel-50 border border-steel-200">
              {request.fleet_machine_image ? (
                <img
                  src={request.fleet_machine_image}
                  alt={request.fleet_machine_title || request.machine_name}
                  className="w-14 h-14 rounded-xl object-cover border border-steel-200 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-white border border-steel-200 text-steel-500 flex items-center justify-center shrink-0">
                  <Truck className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[11px] font-black text-steel-500 block">
                  {lang === 'fr' ? 'Pour l’engin du propriétaire :' : 'قطعة غيار خاصة بهذه الآلية في أسطول المالك :'}
                </span>
                <span className="text-sm font-black text-ink block truncate">
                  {request.fleet_machine_title}
                </span>
                {(request.fleet_machine_brand || request.fleet_machine_model || request.fleet_machine_year) && (
                  <span className="text-xs text-steel-600 block">
                    {[
                      request.fleet_machine_brand,
                      request.fleet_machine_model,
                      request.fleet_machine_year,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Structured Specs Table */}
          <div className="border border-steel-200 rounded-2xl divide-y divide-steel-100 text-xs">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-steel-500 font-bold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Propriétaire / Demandeur' : 'مالك الآلية / الطالب'}</span>
              </span>
              <span className="font-black text-ink text-end">{request.company_name}</span>
            </div>

            {request.part_reference && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-steel-500 font-bold flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" />
                  <span>{lang === 'fr' ? 'Référence (Réf)' : 'الرقم المرجعي (Réf)'}</span>
                </span>
                <span dir="ltr" className="font-mono font-black text-primary-dark">
                  {request.part_reference}
                </span>
              </div>
            )}

            {request.desired_model && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-steel-500 font-bold">
                  {lang === 'fr' ? 'Modèle / Année' : 'الموديل المطلوب'}
                </span>
                <span className="font-black text-ink">{request.desired_model}</span>
              </div>
            )}

            {isPurchase && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-steel-500 font-bold flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>{lang === 'fr' ? 'Dédouanement' : 'الديوانة والتخليص الجمركي'}</span>
                </span>
                <span className="font-black text-ink">
                  {request.customs_clearance
                    ? lang === 'fr'
                      ? 'Dédouané au Maroc'
                      : 'مع الديوانة (مُعشّرة بالمغرب)'
                    : lang === 'fr'
                    ? 'Hors douane / Libre'
                    : 'بدون ديوانة / تسليم حر'}
                </span>
              </div>
            )}

            {request.preferred_origin && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-steel-500 font-bold">
                  {lang === 'fr' ? 'Origine souhaitée' : 'بلد الاستيراد المفضل'}
                </span>
                <span className="font-black text-ink">
                  {getImportCountryLabel(request.preferred_origin, lang)}
                </span>
              </div>
            )}

            {request.budget_mad ? (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-steel-500 font-bold">
                  {lang === 'fr' ? 'Budget estimatif' : 'الميزانية التقديرية'}
                </span>
                <span dir="ltr" className="font-mono font-black tabular-nums text-ink">
                  {formatPriceMAD(request.budget_mad)}
                </span>
              </div>
            ) : null}

            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-steel-500 font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Localisation' : 'المدينة / التسليم'}</span>
              </span>
              <span className="font-black text-ink flex items-center gap-1.5">
                <span>{request.site_city || request.site_name}</span>
                {request.is_nationwide ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary-dark">
                    · <Globe className="w-3 h-3" /> {lang === 'fr' ? 'Maroc' : 'المغرب'}
                  </span>
                ) : request.distance_km != null ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 tabular-nums">
                    · <Navigation className="w-3 h-3" /> {formatDistanceKm(request.distance_km, lang)}
                  </span>
                ) : null}
              </span>
            </div>
          </div>

          {request.notes && (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-ink space-y-1">
              <span className="font-black block text-amber-900">
                {lang === 'fr' ? 'Détails & notes du propriétaire :' : 'تفاصيل وملاحظات إضافية :'}
              </span>
              <p className="leading-relaxed text-steel-700">{request.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-4 bg-steel-50 border-t border-steel-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            {request.site_phone && (
              <a
                href={`tel:${request.site_phone}`}
                className="min-h-[44px] px-3.5 rounded-xl bg-white border border-steel-300 text-ink font-black text-xs inline-flex items-center gap-1.5 hover:bg-steel-100"
              >
                <Phone className="w-4 h-4 text-emerald-700" />
                <span>{lang === 'fr' ? 'Appeler' : 'اتصال'}</span>
              </a>
            )}
            {onOpenQuoteForm && (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  onClose();
                  onOpenQuoteForm(request);
                }}
                className="min-h-[44px] font-black bg-white"
              >
                {lang === 'fr' ? 'Devis chiffré' : 'إرسال تسعيرة'}
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isStartingChat}
            onClick={handleStartChat}
            leftIcon={
              isStartingChat ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )
            }
            className="min-h-[44px] font-black flex-1 sm:flex-initial justify-center"
          >
            {lang === 'fr' ? 'Démarrer la discussion' : 'ابدأ محادثة مع المالك'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RequestDetailsModal;
