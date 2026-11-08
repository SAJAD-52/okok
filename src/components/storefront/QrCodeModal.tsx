// ============================================================================
// JADIJCB: Storefront QR Code Generator Modal
// High-res QR Code generation for job site stickers, cards and WhatsApp sharing
// ============================================================================

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, QrCode as QrIcon, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { useLanguage } from '../../hooks/useLanguage';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url?: string;
  storeUrl?: string;
  companyName: string;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  url,
  storeUrl,
  companyName,
}) => {
  const { lang } = useLanguage();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const targetUrl = url || storeUrl || window.location.href;

  useEffect(() => {
    if (isOpen && targetUrl) {
      QRCode.toDataURL(targetUrl, {
        width: 360,
        margin: 2,
        color: {
          dark: '#0B1220',
          light: '#FFFFFF',
        },
      })
        .then(setQrDataUrl)
        .catch((err) => console.error('Failed to generate QR:', err));
    }
  }, [isOpen, url]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qrcode_${companyName.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(lang === 'fr' ? 'QR Code téléchargé !' : 'تم تنزيل رمز QR بنجاح!');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(targetUrl);
    setIsCopied(true);
    toast.success(lang === 'fr' ? 'Lien copié !' : 'تم نسخ الرابط!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/75 backdrop-blur-xs text-start"
    >
      <div className="bg-white border border-steel-200 rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden animate-scale-in text-center p-6 space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-steel-100">
          <div className="flex items-center gap-2">
            <QrIcon className="w-5 h-5 text-primary-dark" />
            <h3 className="font-black text-sm text-ink">
              {lang === 'fr' ? 'Code QR de la vitrine' : 'رمز QR لمتجرك العام'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-steel-100 text-steel-500 hover:text-ink flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <h4 className="font-black text-sm text-ink">{companyName}</h4>
          <p className="text-[11px] text-steel-500">
            {lang === 'fr'
              ? 'Imprimez ce QR code sur vos cartes, stickers ou affichez-le sur vos engins en chantier.'
              : 'اطبع رمز QR على ملصقات الآليات أو بطاقات العمل ليمسحها المقاولون بهواتفهم مباشرة في الورش.'}
          </p>
        </div>

        {/* QR Display Frame */}
        <div className="p-4 bg-steel-50 rounded-2xl border border-steel-200 inline-block shadow-inner">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Storefront QR Code" className="w-56 h-56 mx-auto rounded-xl" />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-xs text-steel-400">
              جاري إنشاء الرمز...
            </div>
          )}
        </div>

        {/* URL Pill with Copy */}
        <div className="p-2.5 rounded-xl bg-steel-100 border border-steel-200 flex items-center justify-between text-[11px] font-mono">
          <span className="truncate max-w-[190px] select-all font-bold text-steel-700" dir="ltr">
            {url}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded text-steel-600 hover:text-ink cursor-pointer"
            title="Copier"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleDownload}
            leftIcon={<Download className="w-4 h-4" />}
            className="flex-1 font-black text-xs min-h-[44px]"
          >
            {lang === 'fr' ? 'Télécharger PNG' : 'تنزيل كصورة PNG'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QrCodeModal;
