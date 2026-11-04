// ============================================================================
// JADIJCB: Chat Thread Component (WhatsApp-style with Realtime & Read Receipts)
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Phone,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  ShieldCheck,
  User,
  Sparkles,
  Paperclip,
} from 'lucide-react';
import { ChatConversationItem, ChatMessageItem } from '../../types/chat';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { useChatRealtime } from './useChatRealtime';
import { ChatMachineContextCard } from './ChatMachineContextCard';

interface ChatThreadProps {
  conversation: ChatConversationItem;
  onBackToList?: () => void;
}

export const ChatThread: React.FC<ChatThreadProps> = ({
  conversation,
  onBackToList,
}) => {
  const { t, lang, isRTL } = useLanguage();
  const { user, profile } = useAuth();
  const currentUserId = user?.id || profile?.id || 'current-user-demo';

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoadingMessages,
    isPeerTyping,
    sendMessage,
    sendTypingStatus,
  } = useChatRealtime(conversation);

  // Auto-scroll to bottom on messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPeerTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    sendTypingStatus(e.target.value.length > 0);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim()) return;

    sendMessage(inputMessage);
    setInputMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Date Separator Helper
  const formatDateSeparator = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return t('chat.today');
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return t('chat.yesterday');
    }
    return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-MA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const other = conversation.other_participant;

  return (
    <div className="flex flex-col h-full bg-[#EFEAE2]/30 dark:bg-ink relative overflow-hidden">
      {/* 1. WhatsApp-like Header */}
      <header className="p-3.5 bg-white border-b border-steel-200 flex items-center justify-between gap-3 shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Back button on mobile */}
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="md:hidden p-1.5 -ms-1 rounded-xl text-steel-600 hover:text-ink hover:bg-steel-100 transition-colors cursor-pointer"
              aria-label={t('chat.back_to_list')}
            >
              {isRTL ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>
          )}

          {/* Peer Avatar */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-primary text-ink border border-primary-dark/20 flex items-center justify-center font-black text-xs uppercase shadow-sm">
              {other.full_name?.slice(0, 2) || 'MA'}
            </div>
            <span className="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
          </div>

          {/* Peer Info */}
          <div className="min-w-0 text-start">
            <div className="flex items-center gap-1.5">
              <h3 className="font-black text-xs sm:text-sm text-ink truncate">
                {other.company_name || other.full_name}
              </h3>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            </div>

            <p className="text-[11px] text-steel-500 truncate">
              {isPeerTyping ? (
                <span className="text-emerald-700 font-bold animate-pulse">
                  {t('chat.typing')}
                </span>
              ) : (
                <span>
                  {other.city || 'Maroc'} · {t('chat.online')}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Quick Phone Call */}
        {other.phone && (
          <a
            href={`tel:${other.phone}`}
            className="w-9 h-9 rounded-xl bg-steel-100 hover:bg-steel-200 text-steel-700 hover:text-ink flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title={other.phone}
            aria-label="Appeler"
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
      </header>

      {/* 2. Pinned Machine Context Card */}
      {conversation.machine && (
        <ChatMachineContextCard machine={conversation.machine} />
      )}

      {/* 3. Message Thread Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-start">
        {messages.length === 0 && !isLoadingMessages && (
          <div className="p-8 text-center my-auto">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-ink flex items-center justify-center mx-auto mb-2">
              <Sparkles className="w-6 h-6 text-primary-dark" />
            </div>
            <p className="text-xs text-steel-600 max-w-sm mx-auto leading-relaxed">
              {t('chat.no_messages')}
            </p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isSender = msg.sender_id === currentUserId;
          const showDateSeparator =
            index === 0 ||
            new Date(msg.created_at).toDateString() !==
              new Date(messages[index - 1].created_at).toDateString();

          const isRead = Boolean(msg.read_at);

          return (
            <React.Fragment key={msg.id}>
              {/* Date Separator Pill */}
              {showDateSeparator && (
                <div className="flex items-center justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-white/80 border border-steel-200 text-steel-600 text-[10px] font-bold shadow-xs">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}

              {/* Message Bubble Row */}
              <div
                className={`flex w-full ${
                  isSender ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2.5 rounded-2xl shadow-xs text-start relative space-y-1 transition-all ${
                    isSender
                      ? 'bg-amber-100/90 text-ink border border-amber-300/80 rounded-ee-xs'
                      : 'bg-white text-ink border border-steel-200 rounded-es-xs'
                  }`}
                >
                  {/* Message Body */}
                  <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed select-text">
                    {msg.body}
                  </p>

                  {/* Metadata: Timestamp & Read Receipts */}
                  <div
                    className={`flex items-center gap-1 text-[10px] ${
                      isSender ? 'justify-end text-steel-600' : 'justify-start text-steel-400'
                    }`}
                  >
                    <span className="font-mono latin-nums">
                      {formatTime(msg.created_at)}
                    </span>

                    {/* Sender Receipts: Single vs Double Checkmarks */}
                    {isSender && (
                      <span className="ms-0.5">
                        {msg.is_optimistic ? (
                          <Clock className="w-3 h-3 text-steel-400 animate-spin" />
                        ) : isRead ? (
                          <span title="Lu">
                            <CheckCheck className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
                          </span>
                        ) : (
                          <span title="Délivré">
                            <CheckCheck className="w-3.5 h-3.5 text-steel-500" />
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Realtime Typing Indicator Bubble */}
        {isPeerTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-steel-200 px-4 py-2.5 rounded-2xl rounded-es-xs shadow-xs flex items-center gap-1.5 text-xs text-steel-600">
              <span className="w-1.5 h-1.5 rounded-full bg-steel-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-steel-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-steel-400 animate-bounce [animation-delay:0.4s]" />
              <span className="ms-1 font-bold text-[11px] text-steel-500">
                {t('chat.typing')}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. WhatsApp-style Input Footer */}
      <footer className="p-3 bg-white border-t border-steel-200 shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm bg-surface border border-steel-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          />

          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="w-11 h-11 rounded-2xl bg-primary hover:bg-primary-dark text-ink flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0 cursor-pointer"
            aria-label={t('chat.send')}
          >
            <Send className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
        </form>
      </footer>
    </div>
  );
};

export default ChatThread;
