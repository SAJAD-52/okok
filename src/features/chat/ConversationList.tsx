// ============================================================================
// JADIJCB: Real-Time Chat Conversation List (WhatsApp-style)
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Search,
  MessageSquare,
  ShieldCheck,
  Truck,
  Check,
  CheckCheck,
} from 'lucide-react';
import { ChatConversationItem } from '../../types/chat';
import { useLanguage } from '../../hooks/useLanguage';

interface ConversationListProps {
  conversations: ChatConversationItem[];
  activeConversationId: string | null;
  onSelectConversation: (conversation: ChatConversationItem) => void;
  isLoading?: boolean;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  isLoading = false,
}) => {
  const { t, lang } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter conversations by contact name, company name, or machine title
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();

    return conversations.filter((c) => {
      const name = c.other_participant.full_name?.toLowerCase() || '';
      const company = c.other_participant.company_name?.toLowerCase() || '';
      const machineTitle =
        lang === 'fr'
          ? c.machine?.title_fr?.toLowerCase() || ''
          : c.machine?.title_ar?.toLowerCase() || '';

      return (
        name.includes(q) ||
        company.includes(q) ||
        machineTitle.includes(q)
      );
    });
  }, [conversations, searchQuery, lang]);

  // Format short timestamp for conversation item
  const formatTimeSnippet = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();

    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return t('chat.yesterday');
    }

    return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-MA', {
      day: 'numeric',
      month: 'numeric',
    });
  };

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  return (
    <div className="flex flex-col h-full bg-white border-e border-steel-200 select-none">
      {/* 1. List Header & Unread Counter */}
      <div className="p-4 border-b border-steel-200 bg-white space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-ink">
              {t('chat.title')}
            </h2>
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-ink text-xs font-black">
                {totalUnread}
              </span>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-steel-400 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('chat.search_conversations')}
            className="w-full ps-9 pe-4 py-2 text-xs bg-surface border border-steel-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[40px] text-start"
          />
        </div>
      </div>

      {/* 2. Scrollable List of Conversations */}
      <div className="flex-1 overflow-y-auto divide-y divide-steel-100">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-2xl bg-steel-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-steel-200 rounded-md w-3/4" />
                  <div className="h-2.5 bg-steel-100 rounded-md w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-steel-500 my-auto">
            <div className="w-12 h-12 rounded-2xl bg-steel-100 text-steel-400 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-ink">
              {t('chat.no_conversations')}
            </p>
            <p className="text-[11px] text-steel-400 mt-1 max-w-[200px] mx-auto">
              {searchQuery
                ? (lang === 'fr' ? 'Aucun résultat trouvé' : 'لا توجد نتائج مطابقة لبحثك')
                : (lang === 'fr' ? 'Contactez un propriétaire depuis le marketplace' : 'تواصل مع ملاك الآليات مباشرة عبر السوق')}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isSelected = conv.id === activeConversationId;
            const other = conv.other_participant;
            const machineTitle =
              lang === 'fr'
                ? conv.machine?.title_fr
                : conv.machine?.title_ar;

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelectConversation(conv)}
                className={`w-full p-3.5 sm:p-4 flex items-start gap-3 transition-colors text-start cursor-pointer relative ${
                  isSelected
                    ? 'bg-amber-50/60 border-s-4 border-primary'
                    : 'bg-white hover:bg-steel-50/80 border-s-4 border-transparent'
                }`}
              >
                {/* Avatar with Online Status Indicator */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-steel-100 text-ink border border-steel-200 flex items-center justify-center font-black text-xs uppercase shadow-xs">
                    {other.full_name?.slice(0, 2) || 'MA'}
                  </div>
                  <span className="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-black text-xs text-ink truncate">
                        {other.company_name || other.full_name}
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    </div>

                    <span className="text-[10px] text-steel-400 font-mono latin-nums shrink-0">
                      {formatTimeSnippet(conv.last_message_at)}
                    </span>
                  </div>

                  {/* Machine context pill if associated */}
                  {machineTitle && (
                    <div className="flex items-center gap-1 text-[11px] text-primary-dark font-bold truncate mb-1">
                      <Truck className="w-3 h-3 shrink-0" />
                      <span className="truncate">{machineTitle}</span>
                    </div>
                  )}

                  {/* Last Message snippet & Unread count */}
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-xs truncate ${
                        conv.unread_count > 0
                          ? 'font-bold text-ink'
                          : 'text-steel-500 font-normal'
                      }`}
                    >
                      {conv.last_message || t('chat.no_messages')}
                    </p>

                    {conv.unread_count > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-primary text-ink text-[10px] font-black shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ConversationList;
