import React, { useState } from 'react';
import { Send, User, CheckCheck, Clock, Building2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useLanguage } from '../hooks/useLanguage';
import { MOCK_MESSAGES } from '../data/mockData';
import { ChatMessage } from '../types/database';

export const MessagesPage: React.FC = () => {
  const { t, lang, isRTL } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      conversation_id: 'conv_1',
      sender_id: 'user_1',
      receiver_id: 'user_6',
      content: newMessage.trim(),
      is_read: false,
      created_at: new Date().toISOString(),
    };

    setMessages([...messages, newMsg]);
    setNewMessage('');
  };

  return (
    <div className="h-[calc(100vh-140px)] min-h-[500px] flex flex-col md:flex-row bg-white rounded-2xl border border-steel-200 shadow-soft overflow-hidden text-start">
      {/* Conversations List (Sidebar) */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-e border-steel-200 flex flex-col bg-surface shrink-0">
        <div className="p-4 border-b border-steel-200">
          <h2 className="text-sm font-bold text-ink">
            {t('chat.title')}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-steel-100">
          <button
            type="button"
            className="w-full p-4 flex items-start gap-3 bg-white hover:bg-steel-50 transition-colors text-start cursor-pointer border-s-4 border-primary"
          >
            <div className="w-10 h-10 rounded-xl bg-ink text-primary flex items-center justify-center font-bold text-xs shrink-0">
              YA
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-ink truncate">
                  Youssef El Alami
                </span>
                <span className="text-[10px] text-steel-400 font-mono latin-nums">
                  10:28
                </span>
              </div>
              <p className="text-[11px] text-steel-500 truncate mt-0.5">
                BTP Maroc Construction · JCB 3CX
              </p>
              <p className="text-xs text-steel-700 truncate mt-1 font-medium">
                {messages[messages.length - 1].content}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Active Conversation View */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat Header */}
        <div className="p-4 border-b border-steel-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-ink flex items-center justify-center font-bold text-xs">
              YA
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink">
                Youssef El Alami
              </h3>
              <p className="text-[11px] text-steel-500">
                BTP Maroc Construction S.A. · Casablanca
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-success flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span>{lang === 'fr' ? 'En ligne' : 'متصل الآن'}</span>
          </span>
        </div>

        {/* Message Bubble History */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3 bg-surface/50">
          {messages.map((msg) => {
            const isMe = msg.sender_id === 'user_1';

            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] sm:max-w-md p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                    isMe
                      ? 'bg-ink text-white rounded-te-none'
                      : 'bg-white text-ink border border-steel-200 rounded-ts-none'
                  }`}
                >
                  <p>{msg.content}</p>
                  <div
                    className={`flex items-center gap-1 mt-1 text-[10px] ${
                      isMe ? 'text-steel-400 justify-end' : 'text-steel-400 justify-start'
                    }`}
                  >
                    <span className="font-mono latin-nums">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isMe && <CheckCheck className="w-3.5 h-3.5 text-primary" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message Composer */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 sm:p-4 border-t border-steel-200 bg-white flex items-center gap-2"
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('chat.placeholder')}
            className="flex-1 bg-surface border border-steel-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="shrink-0 font-bold"
            rightIcon={<Send className="w-4 h-4" />}
          >
            {t('chat.send')}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default MessagesPage;
