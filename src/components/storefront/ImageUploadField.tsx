// ============================================================================
// JADIJCB: High-Quality Image Upload Field Component
// Supports Drag & Drop, File Picker, Mobile Camera, Live Preview, and Base64/Storage
// ============================================================================

import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { readFileAsDataUrl } from '../../lib/storefrontSlug';

interface ImageUploadFieldProps {
  label: string;
  description?: string;
  value: string | null | undefined;
  onChange: (dataUrl: string) => void;
  onRemove?: () => void;
  aspectRatio?: 'banner' | 'square';
  recommendedDimensions?: string;
  disabled?: boolean;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  description,
  value,
  onChange,
  onRemove,
  aspectRatio = 'banner',
  recommendedDimensions,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string>('');

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP)');
      return;
    }

    setIsLoading(true);
    try {
      setFileName(file.name);
      const dataUrl = await readFileAsDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      console.error('Failed to read image file:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // reset input value so re-selecting same file triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const triggerUpload = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const isSquare = aspectRatio === 'square';

  return (
    <div className="space-y-1.5 text-start">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-steel-700 block">
          {label}
        </label>
        {recommendedDimensions && (
          <span className="text-[10px] text-steel-400 font-mono">
            {recommendedDimensions}
          </span>
        )}
      </div>

      {description && (
        <p className="text-[11px] text-steel-500 leading-snug">
          {description}
        </p>
      )}

      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />

      {/* If an image is selected/exists */}
      {value ? (
        <div
          className={`relative rounded-2xl overflow-hidden border-2 border-steel-200 group bg-steel-900 shadow-sm ${
            isSquare ? 'w-28 h-28 sm:w-32 sm:h-32' : 'w-full h-36 sm:h-44'
          }`}
        >
          <img
            src={value}
            alt={label}
            className="w-full h-full object-cover"
          />

          {/* Hover overlay with action buttons */}
          <div className="absolute inset-0 bg-ink/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
            <button
              type="button"
              onClick={triggerUpload}
              disabled={disabled || isLoading}
              className="px-3 py-1.5 bg-white text-ink text-xs font-bold rounded-xl shadow-md hover:bg-steel-50 flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>تغيير</span>
            </button>

            {onRemove && (
              <button
                type="button"
                onClick={() => {
                  setFileName('');
                  onRemove();
                }}
                disabled={disabled}
                className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer"
                title="حذف الصورة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Badge indicator */}
          <div className="absolute bottom-2 start-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] text-emerald-400 font-bold flex items-center gap-1 pointer-events-none">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>تم التحميل</span>
          </div>
        </div>
      ) : (
        /* Empty Dropzone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerUpload}
          className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            isDragging
              ? 'border-primary bg-amber-50/60 scale-[1.01]'
              : 'border-steel-300 hover:border-primary bg-steel-50/70 hover:bg-white'
          } ${isSquare ? 'w-28 h-28 sm:w-32 sm:h-32' : 'w-full h-32 sm:h-36'}`}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-primary-dark flex items-center justify-center">
            {isLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <UploadCloud className="w-5 h-5" />
            )}
          </div>

          <div className="text-center">
            <span className="text-xs font-bold text-ink block">
              {isLoading ? 'جاري قراءة الصورة...' : 'انقر للرفع أو اسحب الصورة'}
            </span>
            <span className="text-[10px] text-steel-400 block mt-0.5">
              PNG, JPG أو WEBP (بحد أقصى 5MB)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
