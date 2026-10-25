"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { TopAppBar } from "../../../components/common/TopAppBar";
import { MarkdownRenderer } from "../../../components/common/MarkdownRenderer";
import { useFinancialStore } from "../../../context/FinancialStore";
import { spendingSummary, useEmailSpending } from "../../../lib/emailSpending";
import {
  Send,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  RotateCcw,
  PlusCircle,
  X,
} from "lucide-react";
import { Button } from "@nera/ui";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  feedback?: "up" | "down" | null;
  copied?: boolean;
}

export default function RecoveryPage() {
  const {
    userName,
    addDebtItem,
  } = useFinancialStore();

  // Chatbot State with introductory message in Indonesian
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_ai_intro",
      role: "assistant",
      content:
        "Halo! 👋 Saya **Nera**, konsultan pemulihan finansialmu di wondr by BNI.\n\nTanyakan apa saja seputar evaluasi pinjaman online, simulasi batas aman cicilan, strategi pelunasan Debt Snowball, atau cara mengamankan uang sakumu. Nera siap membantumu secara objektif, aman, dan bebas stigma!",
      feedback: null,
      copied: false,
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick Add Debt Modal
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [platformName, setPlatformName] = useState("");
  const [principal, setPrincipal] = useState<number>(1000000);
  const [monthlyInstallment, setMonthlyInstallment] = useState<number>(380000);
  const [tenorMonths, setTenorMonths] = useState<number>(3);

  // spending outside BNI from email receipts: aggregates only, never the emails themselves
  const emailSummary = spendingSummary(useEmailSpending());
  const announcedEmail = useRef(false);
  useEffect(() => {
    if (!emailSummary || announcedEmail.current) return;
    announcedEmail.current = true;
    setMessages((prev) => [
      ...prev,
      {
        id: "msg_ai_email_summary",
        role: "assistant",
        content: `Aku juga membaca struk dari emailmu. ${emailSummary} Mau aku bantu cari pos yang bisa dihemat?`,
        feedback: null,
        copied: false,
      },
    ]);
  }, [emailSummary]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Send Message with SSE streaming
  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isStreaming) return;

    const userMsgId = `usr_${Date.now()}`;
    const aiMsgId = `ai_${Date.now()}`;

    const newMessages: ChatMessage[] = [
      ...messages,
      { id: userMsgId, role: "user", content: trimmed },
      { id: aiMsgId, role: "assistant", content: "", isStreaming: true },
    ];

    setMessages(newMessages);
    setInputText("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages
            .filter((m) => m.id !== aiMsgId)
            .map((m) => ({ role: m.role, content: m.content })),
          context: emailSummary ?? undefined,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Gagal menghubungkan ke layanan Nera");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine || !cleanLine.startsWith("data:")) continue;

          const dataContent = cleanLine.replace(/^data:\s*/, "");
          if (dataContent === "[DONE]") {
            break;
          }

          try {
            const parsed = JSON.parse(dataContent);
            if (parsed.text) {
              accumulatedText += parsed.text;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMsgId
                    ? { ...msg, content: accumulatedText, isStreaming: true }
                    : msg
                )
              );
            }
          } catch {
            // Ignore non-JSON chunks
          }
        }
      }

      // Mark streaming done
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMsgId
            ? {
                ...msg,
                content:
                  msg.content ||
                  "Nera siap mendampingimu. Ada pos kewajiban atau pertanyaan finansial lain yang ingin kamu diskusikan?",
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleFeedback = (id: string, type: "up" | "down") => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, feedback: m.feedback === type ? null : type }
          : m
      )
    );
  };

  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!platformName || principal <= 0) return;

    addDebtItem({
      platformName,
      outstandingPrincipal: principal,
      monthlyInstallment,
      interestRateMonthly: 3.5,
      remainingTenorMonths: tenorMonths,
    });

    const addedName = platformName;
    const addedPrincipal = principal;
    const addedInstallment = monthlyInstallment;

    setPlatformName("");
    setPrincipal(1000000);
    setMonthlyInstallment(380000);
    setIsAddDebtOpen(false);

    // Feed to Nera chat automatically
    handleSendMessage(
      `Saya baru saja mencatat pinjaman ${addedName} sebesar Rp${new Intl.NumberFormat("id-ID").format(
        addedPrincipal
      )} dengan cicilan Rp${new Intl.NumberFormat("id-ID").format(
        addedInstallment
      )}/bulan. Bagaimana rekomendasi pelunasan terbaiknya?`
    );
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `ai_${Date.now()}`,
        role: "assistant",
        content:
          "Riwayat chat direset. Halo! Saya **Nera**, konsultan pemulihan finansialmu di wondr by BNI. Ada hal terkait cicilan atau pemulihan keuangan yang ingin kita bahas?",
      },
    ]);
  };

  // Suggestion chips in Indonesian
  const quickChips = [
    {
      icon: "📝",
      label: "Catat Pos Pinjaman",
      action: () => setIsAddDebtOpen(true),
    },
    {
      icon: "🧾",
      label: "Urutan Debt Snowball",
      action: () => {
        handleSendMessage("Bagaimana urutan pelunasan Debt Snowball untuk pinjaman aktif saya saat ini?");
      },
    },
    {
      icon: "❓",
      label: "Simulasi Rasio Utang",
      action: () => {
        handleSendMessage("Berapa batas aman rasio cicilan (DTI) dan bagaimana membuat rencana pemulihan darurat?");
      },
    },
    {
      icon: "📊",
      label: "Atur Anggaran Pemulihan",
      action: () => {
        handleSendMessage("Bagaimana cara membagi uang saku bulanan agar tidak mengalami defisit saat ada cicilan?");
      },
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-screen bg-white">
      {/* 1. TOP APP BAR (Edge to edge, no extra outer padding) */}
      <TopAppBar title="Nera AI Consultant" showBack />

      {/* 2. CHAT MESSAGES FULL AREA (ChatGPT style layout) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Welcome Hero when chat has 1 message */}
        {messages.length <= 1 && (
          <div className="flex flex-col items-center text-center py-6 space-y-2">
            <div className="relative w-16 h-16 rounded-full bg-[#FFF0BD] border-2 border-[#BA8500]/30 flex items-center justify-center shadow-xs">
              <Image
                src="/mascots/mascot-standing.png"
                alt="Nera AI Mascot"
                width={56}
                height={56}
                className="w-14 h-14 object-contain"
                priority
              />
            </div>
            <h2 className="text-base font-bold text-[#2F240E]">
              👋 Halo, {userName || "Sobat Nera"}!
            </h2>
            <p className="text-xs text-[#766D61] max-w-[280px]">
              Tanyakan apa saja seputar evaluasi pinjaman, simulasi cicilan, dan strategi bebas utang.
            </p>
          </div>
        )}

        {/* Message Thread */}
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              {/* If assistant, show small bot avatar row */}
              {msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#76520E] mb-1 pl-1">
                    <div className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-[#FFF0BD]">
                      <Image
                        src="/mascots/mascot-standing.png"
                        alt="Nera AI"
                        width={20}
                        height={24}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <span>Nera</span>
                  </div>
              )}

              {/* Message Bubble */}
              <div
                className={`text-xs leading-relaxed max-w-[88%] ${
                  msg.role === "user"
                    ? "bg-[#2F240E] text-white px-4 py-2.5 rounded-[20px] rounded-tr-xs shadow-xs font-normal whitespace-pre-line"
                    : "bg-[#F7F5F0] border border-[#E9E5DD] text-[#2F240E] px-4 py-3 rounded-[20px] rounded-tl-xs shadow-xs font-normal"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div>
                    <MarkdownRenderer content={msg.content} />
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-[#BA8500] ml-1 animate-pulse align-middle" />
                    )}
                  </div>
                ) : (
                  msg.content
                )}
              </div>

              {/* Assistant Action Bar (Thumbs Down, Thumbs Up, Copy) */}
              {msg.role === "assistant" && msg.content && !msg.isStreaming && (
                <div className="flex items-center gap-3 text-[#736B60] mt-1.5 px-2">
                  <button
                    onClick={() => handleFeedback(msg.id, "down")}
                    className={`hover:text-[#2F240E] transition-colors ${
                      msg.feedback === "down" ? "text-rose-500 font-bold" : ""
                    }`}
                    title="Tidak Membantu"
                    aria-label="Thumbs Down"
                  >
                    <ThumbsDown size={13} />
                  </button>
                  <button
                    onClick={() => handleFeedback(msg.id, "up")}
                    className={`hover:text-[#2F240E] transition-colors ${
                      msg.feedback === "up" ? "text-[#15803D] font-bold" : ""
                    }`}
                    title="Sangat Membantu"
                    aria-label="Thumbs Up"
                  >
                    <ThumbsUp size={13} />
                  </button>
                  <button
                    onClick={() => handleCopyText(msg.id, msg.content)}
                    className="hover:text-[#2F240E] transition-colors relative"
                    title="Salin Saran"
                    aria-label="Salin Saran"
                  >
                    {copiedId === msg.id ? (
                      <Check size={13} className="text-[#15803D]" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 3. CHATGPT-STYLE BOTTOM DOCKED AREA (Chips + Input) */}
      <div className="p-3 bg-white border-t border-[#F0EEE9] space-y-2.5">
        {/* Suggestion Chips (Horizontal scrollable or neat wrap) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={chip.action}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F5F0] hover:bg-[#FFF3D6] active:scale-[0.98] transition-all rounded-full text-xs font-medium text-[#2F240E] border border-[#E9E5DD] hover:border-[#BA8500] shrink-0"
            >
              <span>{chip.icon}</span>
              <span className="whitespace-nowrap">{chip.label}</span>
            </button>
          ))}
          <button
            onClick={handleResetChat}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F7F5F0] hover:bg-slate-200 transition-colors rounded-full text-[11px] text-[#736B60] border border-[#E9E5DD] shrink-0"
            title="Reset Chat"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="relative bg-[#F4F5F7] border border-[#E5E7EB] rounded-full p-1.5 pl-4 flex items-center gap-2 focus-within:border-[#BA8500] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#BA8500] transition-all"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Tanya Nera apa saja..."
            disabled={isStreaming}
            className="flex-1 bg-transparent text-xs text-[#2F240E] placeholder-[#817B70] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isStreaming}
            className="w-8 h-8 rounded-full bg-[#BA8500] hover:bg-[#966600] disabled:bg-[#D8D3C9] active:scale-95 text-white flex items-center justify-center transition-all shadow-xs shrink-0"
            aria-label="Kirim Pesan"
          >
            <Send size={14} className="-ml-0.5" />
          </button>
        </form>
      </div>

      {/* QUICK ADD DEBT MODAL */}
      {isAddDebtOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-sm font-bold text-[#2F240E] flex items-center gap-1.5">
                <PlusCircle size={16} className="text-[#BA8500]" /> Catat Kewajiban / Pinjaman
              </h4>
              <button
                onClick={() => setIsAddDebtOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDebt} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#736B60] block mb-1">
                  Nama Platform
                </label>
                <input
                  type="text"
                  placeholder="Misal: EasyDana / PayLater"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#F7F5F0] border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#BA8500]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-[#736B60] block mb-1">
                    Sisa Pokok (Rp)
                  </label>
                  <input
                    type="number"
                    placeholder="1000000"
                    value={principal}
                    onChange={(e) => setPrincipal(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-[#F7F5F0] border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#BA8500]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#736B60] block mb-1">
                    Cicilan / bln
                  </label>
                  <input
                    type="number"
                    placeholder="380000"
                    value={monthlyInstallment}
                    onChange={(e) => setMonthlyInstallment(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-[#F7F5F0] border border-[#E9E5DD] rounded-xl focus:outline-none focus:border-[#BA8500]"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => setIsAddDebtOpen(false)}
                  className="text-xs h-9 rounded-xl"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  fullWidth
                  className="text-xs h-9 rounded-xl"
                >
                  Simpan & Konsultasikan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
