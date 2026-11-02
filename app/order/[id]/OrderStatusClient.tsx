"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ChefHat,
  BellRing,
  UtensilsCrossed,
  XCircle,
  Star,
  ArrowLeft,
  Send,
  AlertCircle,
  Sparkles,
  Bell,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { Order, OrderItem } from "@/types";
import {
  notifyDiner,
  playChimeSound,
  requestNotificationPermission,
  getNotificationPermissionStatus,
} from "@/lib/notifications";
import { CallWaiterModal } from "@/components/menu/CallWaiterModal";

interface ExtendedOrder extends Order {
  hotels?: {
    name: string;
    slug: string;
    phone?: string | null;
    address?: string | null;
  } | null;
}

interface OrderStatusClientProps {
  initialOrder: ExtendedOrder;
  items: OrderItem[];
  hasReviewed: boolean;
}

const steps = [
  { key: "pending", label: "Placed", icon: Clock, desc: "Order received by kitchen" },
  { key: "accepted", label: "Accepted", icon: CheckCircle2, desc: "Order accepted by kitchen staff" },
  { key: "preparing", label: "Preparing", icon: ChefHat, desc: "Chef is preparing your fresh meal" },
  { key: "ready", label: "Ready", icon: BellRing, desc: "Order is plated and ready for pickup" },
  { key: "served", label: "Served", icon: UtensilsCrossed, desc: "Delivered to your table" },
];

export default function OrderStatusClient({
  initialOrder,
  items,
  hasReviewed: initialHasReviewed,
}: OrderStatusClientProps) {
  const [order, setOrder] = useState<ExtendedOrder>(initialOrder);
  const [hasReviewed, setHasReviewed] = useState(initialHasReviewed);

  // Review state
  const [rating, setRating] = useState(5);
  const [reviewName, setReviewName] = useState(initialOrder.customer_name || "");
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Web Notification State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");
  const [notifToast, setNotifToast] = useState<{ title: string; body: string } | null>(null);
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);

  useEffect(() => {
    setNotifPermission(getNotificationPermissionStatus());
  }, []);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? "granted" : "denied");
    if (granted) {
      playChimeSound("bell");
      setNotifToast({
        title: "Live Alerts Enabled! 🔔",
        body: `You will hear a chime and receive updates whenever your order status changes.`,
      });
      setTimeout(() => setNotifToast(null), 4000);
    }
  };

  // Supabase Realtime Listener (Prompt 6.4)
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`order-updates-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as Order;
            setOrder((prev) => {
              // Trigger live audio & web notification on status progression
              if (prev.status !== updated.status) {
                if (updated.status === "accepted") {
                  notifyDiner(
                    "Order Accepted! 👨‍🍳",
                    `Chef has accepted your order for Table #${updated.table_number}.`,
                    "bell"
                  );
                  setNotifToast({
                    title: "Order Accepted! 👨‍🍳",
                    body: "The kitchen is reviewing your meal.",
                  });
                } else if (updated.status === "preparing") {
                  notifyDiner(
                    "Cooking in Kitchen 🍳",
                    `Your fresh dishes are now being prepared!`,
                    "kitchen"
                  );
                  setNotifToast({
                    title: "Kitchen Update 🍳",
                    body: "Your food is sizzling in the kitchen!",
                  });
                } else if (updated.status === "ready") {
                  notifyDiner(
                    "Food is Ready! 🛎️",
                    `Your dishes are plated! Waiter is bringing them to Table #${updated.table_number}.`,
                    "bell"
                  );
                  setNotifToast({
                    title: "Order Plated & Ready! 🛎️",
                    body: `Waiter is delivering to Table #${updated.table_number}.`,
                  });
                } else if (updated.status === "served") {
                  notifyDiner(
                    "Order Delivered! 🍽️",
                    `Enjoy your meal at Table #${updated.table_number}!`,
                    "served"
                  );
                  setNotifToast({
                    title: "Served at Table! 🍽️",
                    body: "Bon appétit! Enjoy your delicious meal.",
                  });
                }
                setTimeout(() => setNotifToast(null), 5000);
              }
              return {
                ...prev,
                ...updated,
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id]);

  // Determine current step index
  const getStepIndex = (status: string) => {
    switch (status) {
      case "pending":
        return 0;
      case "accepted":
        return 1;
      case "preparing":
        return 2;
      case "ready":
        return 3;
      case "served":
      case "completed":
        return 4;
      default:
        return 0;
    }
  };

  const currentStep = getStepIndex(order.status);
  const isRejected = order.status === "rejected";
  const isCompleted = order.status === "served" || order.status === "completed";

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError(null);
    setSubmittingReview(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("reviews").insert({
        hotel_id: order.hotel_id,
        order_id: order.id,
        customer_name: reviewName.trim() || "Guest Customer",
        rating,
        comment: reviewComment.trim() || null,
      });

      if (error) throw error;

      setReviewSuccess(true);
      setHasReviewed(true);
    } catch (err: unknown) {
      setReviewError(
        err instanceof Error ? err.message : "Review submit karne me error aayi."
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 font-sans relative">
      {/* Floating Live Notification Toast */}
      {notifToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] bg-[#0B192C] text-white border border-[#39ff14]/50 p-4 rounded-2xl shadow-2xl shadow-[#39ff14]/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-xl bg-[#39ff14] text-[#0B192C] flex items-center justify-center shrink-0 font-bold text-sm">
            🔔
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white">{notifToast.title}</p>
            <p className="text-[11px] text-zinc-300 mt-0.5">{notifToast.body}</p>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-zinc-200/80 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            href={`/menu/${order.hotels?.slug || ""}`}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Menu
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCallWaiterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B192C] hover:bg-black text-[#39ff14] border border-[#39ff14]/40 text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
            >
              <Bell className="w-3.5 h-3.5 text-[#39ff14] animate-pulse" />
              <span>Call Waiter</span>
            </button>

            <button
              type="button"
              onClick={() => playChimeSound("bell")}
              title="Test Table Chime Sound"
              aria-label="Test Table Chime Sound"
              className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 cursor-pointer hidden sm:block"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Tracking
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Status Banner */}
        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-[#0B192C] text-[#39ff14] border border-[#39ff14]/30 text-xs font-extrabold mb-2 shadow-2xs">
            Table {order.table_number}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight">
            {isRejected
              ? "Order Cancelled / Declined"
              : isCompleted
              ? "Your Order Has Been Served! 🎉"
              : "Your Meal is Being Prepared..."}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            {order.hotels?.name} • Order #{order.id.slice(0, 8)}
          </p>
        </div>

        {/* Live In-Browser Web Notification Permission Banner */}
        {notifPermission !== "granted" && notifPermission !== "unsupported" && (
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0B192C] text-[#39ff14] border border-[#39ff14]/30 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-900 leading-tight">
                  Enable Live Table Chimes & Web Alerts
                </p>
                <p className="text-[10px] text-zinc-600">
                  Hear audio bells when your food is cooking and delivered
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleEnableNotifications}
              className="bg-[#0B192C] hover:bg-black text-[#39ff14] border border-[#39ff14]/40 font-bold text-xs shrink-0 py-1.5 px-3 cursor-pointer shadow-xs"
            >
              Enable Alerts
            </Button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PROGRESS STEPPER (Prompt 6.3 & 6.4)                           */}
        {/* ------------------------------------------------------------- */}
        <Card className="p-5 sm:p-6">
          {isRejected ? (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-red-900">
                  Order Declined
                </h3>
                <p className="text-xs text-red-700 mt-0.5">
                  Your order was declined by the restaurant staff. Please contact the front counter for assistance.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stepper Progress Bar */}
              <div className="relative flex items-center justify-between">
                <div className="absolute top-4 left-6 right-6 h-1 bg-zinc-200 -z-0">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-[#39ff14] transition-all duration-500"
                    style={{
                      width: `${(currentStep / (steps.length - 1)) * 100}%`,
                    }}
                  />
                </div>

                {steps.map((st, idx) => {
                  const Icon = st.icon;
                  const isPassed = idx < currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <div
                      key={st.key}
                      className="flex flex-col items-center z-10 text-center"
                    >
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center transition-all ${
                          isPassed || isCurrent
                            ? "bg-[#0B192C] text-[#39ff14] border border-[#39ff14]/40 shadow-md shadow-[#39ff14]/20 scale-105"
                            : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                        }`}
                      >
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <span
                        className={`text-[10px] sm:text-xs font-bold mt-2 ${
                          isCurrent
                            ? "text-emerald-700 font-black"
                            : isPassed
                            ? "text-zinc-800"
                            : "text-zinc-400"
                        }`}
                      >
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Current Active Step Banner */}
              <div className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200/60 text-center">
                <p className="text-xs font-semibold text-orange-950">
                  {steps[currentStep]?.desc}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* ------------------------------------------------------------- */}
        {/* ORDER ITEMS & BILL SUMMARY                                    */}
        {/* ------------------------------------------------------------- */}
        <Card className="p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2 flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
            Order Items Details
          </h2>

          <div className="divide-y divide-zinc-100">
            {items.map((item) => (
              <div
                key={item.id}
                className="py-2.5 flex items-center justify-between text-xs sm:text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-emerald-600">
                    {item.quantity}x
                  </span>
                  <span className="font-medium text-zinc-900">
                    {item.item_name}
                  </span>
                </div>
                <span className="font-bold text-zinc-900">
                  ₹{Number(item.price) * item.quantity}
                </span>
              </div>
            ))}
          </div>

          {order.note && (
            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs">
              <span className="font-bold text-zinc-700">Special Instructions:</span>{" "}
              <span className="text-zinc-600">{order.note}</span>
            </div>
          )}

          <div className="pt-3 border-t border-zinc-200 flex items-center justify-between text-base font-black">
            <span>Total Bill Amount</span>
            <span className="text-zinc-950 font-black text-lg">₹{order.total_amount}</span>
          </div>
        </Card>

        {/* ------------------------------------------------------------- */}
        {/* CUSTOMER RATING & REVIEW FORM (Prompt 9.1)                    */}
        {/* ------------------------------------------------------------- */}
        {isCompleted && (
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-black text-zinc-900">
                How Was Your Meal?
              </h2>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Share your feedback and rate your dining experience.
            </p>

            {hasReviewed || reviewSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-xs sm:text-sm text-emerald-800 font-bold">
                  Thank you! Your review has been submitted successfully.
                </p>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                {reviewError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {reviewError}
                  </div>
                )}

                {/* Star Selector */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Rating (1 to 5 Stars)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 hover:scale-110 transition"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            star <= rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-zinc-300"
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-extrabold text-amber-700 ml-2">
                      {rating} Star{rating > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    placeholder="Guest Customer"
                    value={reviewName}
                    onChange={(e) => setReviewName(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#39ff14]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Feedback / Comments
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Food was delicious, service was fast..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-[#39ff14]"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={submittingReview}
                  className="w-full bg-[#0B192C] hover:bg-black text-[#39ff14] border border-[#39ff14]/40 font-bold"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5 text-[#39ff14]" /> Submit Rating
                </Button>
              </form>
            )}
          </Card>
        )}
      </main>

      {/* Call Waiter & Table Service Modal */}
      <CallWaiterModal
        isOpen={isCallWaiterOpen}
        onClose={() => setIsCallWaiterOpen(false)}
        hotelId={order.hotel_id}
        hotelName={order.hotels?.name || "Restaurant"}
        tableNumber={order.table_number}
      />
    </div>
  );
}
