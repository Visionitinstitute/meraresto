"use client";

import { useState } from "react";
import {
  Bell,
  CheckCircle2,
  Droplets,
  Receipt,
  Utensils,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Hash,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { playChimeSound } from "@/lib/notifications";
import { getStoredDinerIdentity } from "@/lib/dinerSession";
import { createClient } from "@/lib/supabase/client";

export type ServiceOptionId =
  | "call_waiter"
  | "water"
  | "bill"
  | "cutlery"
  | "clean"
  | "other";

interface ServiceOption {
  id: ServiceOptionId;
  label: string;
  desc: string;
  icon: typeof Bell;
  badge?: string;
}

const SERVICE_OPTIONS: ServiceOption[] = [
  {
    id: "call_waiter",
    label: "Call Waiter",
    desc: "Need waiter assistance at table",
    icon: Bell,
  },
  {
    id: "water",
    label: "Drinking Water",
    desc: "Bring fresh water glasses or bottle",
    icon: Droplets,
  },
  {
    id: "bill",
    label: "Request Final Bill",
    desc: "Ready for payment / check",
    icon: Receipt,
    badge: "Fast Check",
  },
  {
    id: "cutlery",
    label: "Extra Cutlery & Tissues",
    desc: "Forks, spoons, napkins, extra plates",
    icon: Utensils,
  },
  {
    id: "clean",
    label: "Clean Table",
    desc: "Clear used plates or wipe table",
    icon: Sparkles,
  },
  {
    id: "other",
    label: "Other Request",
    desc: "Type custom note for staff",
    icon: MessageSquare,
  },
];

interface CallWaiterModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotelId: string;
  hotelName: string;
  tableNumber: number;
  onSuccess?: (type: ServiceOptionId) => void;
}

export function CallWaiterModal({
  isOpen,
  onClose,
  hotelId,
  hotelName,
  tableNumber: initialTableNumber,
  onSuccess,
}: CallWaiterModalProps) {
  const [selectedType, setSelectedType] = useState<ServiceOptionId>("call_waiter");
  const [tableInput, setTableInput] = useState<string>(
    initialTableNumber > 0 ? initialTableNumber.toString() : "1"
  );
  const [customNote, setCustomNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsedTable = parseInt(tableInput, 10);
    if (!parsedTable || parsedTable <= 0) {
      setErrorMessage("Please enter a valid table number.");
      return;
    }

    setIsSubmitting(true);
    const stored = getStoredDinerIdentity();
    const dinerHandle = stored?.username ? `@${stored.username}` : undefined;

    try {
      // 1. Post to API route
      const res = await fetch("/api/service-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_id: hotelId,
          table_number: parsedTable,
          request_type: selectedType,
          diner_name: dinerHandle,
          note: customNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to notify staff");
      }

      // 2. Broadcast via Supabase Realtime channel
      try {
        const supabase = createClient();
        const channel = supabase.channel(`hotel-orders-${hotelId}`);
        await channel.send({
          type: "broadcast",
          event: "service_request",
          payload: {
            id: data.request?.id || `req_${Date.now()}`,
            hotel_id: hotelId,
            table_number: parsedTable,
            request_type: selectedType,
            diner_name: dinerHandle,
            note: customNote.trim() || null,
            created_at: new Date().toISOString(),
          },
        });
      } catch {
        // Fallback if websocket temporarily reconnecting
      }

      // 3. Play pleasant confirmation chime on guest phone
      playChimeSound("bell");

      setIsSuccess(true);
      if (onSuccess) onSuccess(selectedType);

      // Reset and auto close
      setTimeout(() => {
        setIsSuccess(false);
        setCustomNote("");
        onClose();
      }, 2600);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Could not send request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Table Service & Assistance" maxWidth="md">
      {isSuccess ? (
        <div className="py-8 px-4 text-center space-y-4 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-3xl bg-[#0B192C] text-[#39ff14] border-2 border-[#39ff14]/50 flex items-center justify-center mx-auto shadow-xl shadow-[#39ff14]/20 animate-bounce">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <h3 className="text-xl font-black text-zinc-950">Staff Notified!</h3>
            <p className="text-xs text-zinc-600 mt-1 max-w-xs mx-auto">
              Your request for <strong className="text-zinc-900">Table #{tableInput}</strong> has been sent to the kitchen and waitstaff. Someone will assist you in a moment.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-ping" />
            <span>Service Chime Sent to Counter</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-200/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-zinc-900 block">{hotelName}</span>
              <span className="text-[11px] text-zinc-500">Fast digital table assistance</span>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="modalTableInput" className="text-xs font-bold text-zinc-700">
                Table:
              </label>
              <div className="relative w-16">
                <Input
                  id="modalTableInput"
                  type="number"
                  min="1"
                  value={tableInput}
                  onChange={(e) => setTableInput(e.target.value)}
                  className="h-8 text-xs font-bold text-center pl-1 pr-1 bg-white"
                  required
                />
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-2">
              What do you need?
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {SERVICE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedType(opt.id)}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? "bg-[#0B192C] text-white border-[#39ff14] shadow-md shadow-[#39ff14]/15 ring-2 ring-[#39ff14]/20"
                        : "bg-white border-zinc-200/90 text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50/70"
                    }`}
                  >
                    {opt.badge && (
                      <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-wider bg-[#39ff14] text-[#0B192C] px-1.5 py-0.5 rounded-md">
                        {opt.badge}
                      </span>
                    )}

                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-[#39ff14] text-[#0B192C]"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold leading-tight">{opt.label}</span>
                    </div>

                    <p
                      className={`text-[10px] leading-tight ${
                        isSelected ? "text-zinc-300" : "text-zinc-500"
                      }`}
                    >
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="serviceCustomNote"
              className="block text-xs font-bold text-zinc-700 mb-1"
            >
              Additional Note (Optional):
            </label>
            <Input
              id="serviceCustomNote"
              type="text"
              placeholder="e.g. Warm water please / Need 2 extra spoons"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="w-1/3 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="w-2/3 bg-[#0B192C] hover:bg-black text-[#39ff14] border border-[#39ff14]/40 font-bold text-xs shadow-md shadow-[#39ff14]/15"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              <span>Call Waiter Now</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

