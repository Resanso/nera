"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { TopAppBar } from "../../../components/common/TopAppBar";
import { useFinancialStore } from "../../../context/FinancialStore";
import { spendingSummary, useEmailSpending } from "../../../lib/emailSpending";
import { Card, Button } from "@nera/ui";
import { maiaClient } from "@nera/ai";
import {
  BotMessageSquare,
  Send,
  Sparkles,
  User,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

export default function CoachPage() {
  const { userName, campus, state, score } = useFinancialStore();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg_1",
      sender: "ai",
      text: `Halo ${userName}! Saya NerAI, konsultan kecerdasan finansialmu di wondr by BNI. Status finansialmu saat ini ${state} (Skor: ${score}). Ada yang ingin kamu tanyakan seputar pengelolaan uang saku atau perencanaan tabungan hari ini?`,
    },
  ]);
  const [inputText, setInputText] = useState("");

  // receipts imported from email: aggregates only, never the emails themselves
  const emailSummary = spendingSummary(useEmailSpending());
  const announcedEmail = useRef(false);
  useEffect(() => {
    if (!emailSummary || announcedEmail.current) return;
    announcedEmail.current = true;
    setMessages((prev) => [
      ...prev,
      {
        id: "msg_email_summary",
        sender: "ai",
        text: `Aku juga membaca struk dari emailmu. ${emailSummary} Mau aku bantu cari pos yang bisa dihemat?`,
      },
    ]);
  }, [emailSummary]);
  const [isLoading, setIsLoading] = useState(false);

  const quickPrompts = [
    "Bagaimana cara membagi uang saku bulanan?",
    "Apakah aman ambil cicilan laptop saat ini?",
    "Kapan saya bisa mulai investasi Reksa Dana?",
  ];

  const handleSendMessage = async (userText: string) => {
    if (!userText.trim()) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const chatHistory = messages.map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));

      const reply = await maiaClient.generateChatResponse([
        ...(emailSummary ? [{ role: "system" as const, content: emailSummary }] : []),
        ...chatHistory,
        { role: "user", content: userText },
      ]);

      const aiMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: "ai",
        text: reply,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: "ai",
          text: "Maaf, terjadi kendala saat memproses jawaban. Selalu pastikan pengeluaran harianmu sesuai batas aman ya!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <TopAppBar title="NerAI Safety Coach" showBack />

      <main className="flex-1 px-4 py-3 flex flex-col justify-between space-y-3">
        {/* CHAT BUBBLES CONTAINER */}
        <div className="space-y-3 flex-1 overflow-y-auto max-h-[58vh] pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.sender === "ai" && (
                <div className="w-7 h-7 rounded-xl bg-[#FFF0BD] flex items-center justify-center text-[#76520E] shrink-0 mt-1">
                  <BotMessageSquare size={16} />
                </div>
              )}

              <div
                className={`p-3.5 rounded-[18px] text-xs leading-relaxed max-w-[82%] ${
                  msg.sender === "user"
                    ? "bg-[#FFF0BD] text-[#2F240E] rounded-tr-xs"
                    : "bg-white border border-[#E9E5DD] text-[#2F240E] rounded-tl-xs"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-[#736B60] pl-9">
              <span className="inline-block w-2 h-2 rounded-full bg-[#76520E] animate-ping" />
              NerAI sedang menyusun saran terbaik...
            </div>
          )}
        </div>

        {/* QUICK PROMPTS */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-[#736B60] font-semibold">
            <Sparkles size={12} className="text-[#76520E]" /> Saran Topik Cepat:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(prompt)}
                className="text-[11px] bg-white border border-[#E9E5DD] text-[#2F240E] px-2.5 py-1.5 rounded-full hover:border-[#BA8500] transition-colors text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* INPUT BAR */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="flex items-center gap-2 pt-2 border-t border-[#E9E5DD]"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Tanyakan sesuatu pada NerAI..."
            className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-[#E9E5DD] rounded-full focus:outline-none focus:border-[#76520E]"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!inputText.trim() || isLoading}
            className="rounded-full w-9 h-9 p-0 shrink-0"
          >
            <Send size={14} />
          </Button>
        </form>
      </main>
    </div>
  );
}
