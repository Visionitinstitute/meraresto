"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  XCircle,
  ChefHat,
  BellRing,
  Store,
  Phone,
  FileText,
  Volume2,
  VolumeX,
  Lock,
  ArrowRight,
  Sparkles,
  Bell,
  Droplets,
  Receipt,
  Utensils,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase/client";
import { Order, OrderItem, Hotel, OrderStatus } from "@/types";
import {
  getStoredSubscription,
  UserSubscription,
  SUBSCRIPTION_PLANS,
} from "@/lib/subscription";
import { PlanUpgradeModal } from "@/components/dashboard/PlanUpgradeModal";

interface OrderWithItems extends Order {
  order_items?: OrderItem[];
}

export interface TableServiceCall {
  id: string;
  hotel_id: string;
  table_number: number;
  request_type: "call_waiter" | "water" | "bill" | "cutlery" | "clean" | "other";
  diner_name?: string | null;
  note?: string | null;
  status: "active" | "attended" | "cancelled";
  created_at: string;
}

export default function ManagerOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [serviceRequests, setServiceRequests] = useState<TableServiceCall[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "active" | "completed" | "all">("pending");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const activePlan = subscription?.plan || SUBSCRIPTION_PLANS.starter;
  const isKdsEnabled = activePlan.kdsEnabled;

  // Play synthetic web audio bell chime on new order (only if enabled on plan)
  const playNewOrderBeep = useCallback(() => {
    if (!soundEnabled || !isKdsEnabled || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch {
      // Audio context fallback
    }
  }, [soundEnabled, isKdsEnabled]);

  // Load initial orders
  useEffect(() => {
    async function loadHotelAndOrders() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: hotelData } = await supabase
            .from("hotels")
            .select("*")
            .eq("owner_id", user.id)
            .maybeSingle();

          const sub = getStoredSubscription(user, hotelData?.id);
          setSubscription(sub);

          if (hotelData) {
            setHotel(hotelData);

            const { data: ordersData } = await supabase
              .from("orders")
              .select("*, order_items (*)")
              .eq("hotel_id", hotelData.id)
              .order("created_at", { ascending: false });

            setOrders(ordersData || []);

            // Load active table service requests
            try {
              const sRes = await fetch(`/api/service-request?hotel_id=${hotelData.id}`);
              const sData = await sRes.json();
              if (sData.requests) {
                setServiceRequests(sData.requests);
              }
            } catch {
              // Service request fetch fallback
            }
          }
        }
      } catch (err) {
        console.error("Error loading manager orders:", err);
      } finally {
        setLoading(false);
      }
    }

    loadHotelAndOrders();
  }, []);

  // Supabase Realtime Subscription
  useEffect(() => {
    if (!hotel) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`hotel-orders-${hotel.id}`)
      .on(
        "broadcast",
        { event: "service_request" },
        (payload) => {
          if (payload.payload) {
            const newReq = payload.payload as TableServiceCall;
            setServiceRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)]);
            playNewOrderBeep();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `hotel_id=eq.${hotel.id}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newOrder = payload.new as Order;
            const { data: items } = await supabase
              .from("order_items")
              .select("*")
              .eq("order_id", newOrder.id);

            setOrders((prev) => [{ ...newOrder, order_items: items || [] }, ...prev]);
            playNewOrderBeep();
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Order;
            setOrders((prev) =>
              prev.map((o) =>
                o.id === updated.id
                  ? { ...o, ...updated, order_items: o.order_items }
                  : o
              )
            );
          } else if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id: string }).id;
            setOrders((prev) => prev.filter((o) => o.id !== oldId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hotel, playNewOrderBeep]);

  // Tab Filtering
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (activeTab === "pending") return order.status === "pending";
      if (activeTab === "active")
        return ["accepted", "preparing", "ready"].includes(order.status);
      if (activeTab === "completed")
        return ["served", "completed", "rejected"].includes(order.status);
      return true;
    });
  }, [orders, activeTab]);

  const counts = useMemo(() => {
    return {
      pending: orders.filter((o) => o.status === "pending").length,
      active: orders.filter((o) => ["accepted", "preparing", "ready"].includes(o.status)).length,
      completed: orders.filter((o) => ["served", "completed", "rejected"].includes(o.status)).length,
    };
  }, [orders]);

  // Status Update Handler
  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    setActionLoadingId(orderId);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("orders")
        .update({ status: nextStatus })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
    } catch (err) {
      console.error("Error updating order status:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAttended = async (requestId: string) => {
    if (!hotel) return;
    setServiceRequests((prev) => prev.filter((r) => r.id !== requestId));
    try {
      await fetch("/api/service-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          hotel_id: hotel.id,
          status: "attended",
        }),
      });
    } catch (err) {
      console.error("Error marking request attended:", err);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Accepted
          </span>
        );
      case "preparing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-50 text-orange-800 border border-orange-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            Cooking
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Ready
          </span>
        );
      case "served":
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            Served
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Rejected
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-2">
        <Spinner size="md" />
        <p className="text-xs font-medium text-zinc-500">Loading live orders...</p>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="p-6 text-center bg-white rounded-xl border border-zinc-200">
        <Store className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
        <h2 className="text-base font-bold text-zinc-900">Please set up your restaurant first</h2>
        <Link href="/dashboard" className="mt-3 inline-block">
          <Button size="sm">Go to Dashboard Overview</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plan Upgrade Modal */}
      <PlanUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        currentPlanId={subscription?.planId}
        onPlanUpdated={(newSub) => setSubscription(newSub)}
        highlightFeature="Live Kitchen Display System (KDS)"
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
            <span>Live Kitchen Orders</span>
            {isKdsEnabled && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#0B192C] text-[#39ff14] border border-[#39ff14]/30">
                KDS Active
              </span>
            )}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Monitor real-time incoming orders and update kitchen fulfillment status instantly.
          </p>
        </div>

        {/* Sound toggle */}
        {isKdsEnabled ? (
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              soundEnabled
                ? "bg-white text-zinc-800 border-zinc-300 shadow-2xs hover:border-zinc-400"
                : "bg-zinc-50 text-zinc-400 border-zinc-200 hover:text-zinc-600"
            }`}
            title="Toggle kitchen notification sound"
          >
            {soundEnabled ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Volume2 className="w-4 h-4 text-emerald-700" />
                <span>Audio Chimes ON</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-zinc-300" />
                <VolumeX className="w-4 h-4 text-zinc-400" />
                <span>Muted</span>
              </>
            )}
          </button>
        ) : (
          <Button
            size="sm"
            onClick={() => setIsUpgradeModalOpen(true)}
            className="bg-[#0B192C] text-[#39ff14] border border-[#39ff14]/40 font-bold text-xs hover:bg-black"
          >
            <Lock className="w-3.5 h-3.5 mr-1" /> Unlock KDS
          </Button>
        )}
      </div>

      {/* KDS LOCKED PAYWALL BANNER FOR STARTER PLAN */}
      {!isKdsEnabled && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0B192C] to-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#39ff14]/30 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Kitchen Display System (KDS) is Locked on {activePlan.name}
              </h3>
              <p className="text-xs text-zinc-300 mt-0.5 max-w-xl">
                Real-time audio chime alerts, chef prep dispatch, and kitchen station timers require the Pro Resto or Enterprise plan.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsUpgradeModalOpen(true)}
            size="sm"
            className="bg-[#39ff14] hover:bg-emerald-400 text-[#0B192C] font-black text-xs shrink-0 cursor-pointer"
          >
            Upgrade to Pro Resto (Unlock KDS) <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      )}

      {/* ACTIVE TABLE CALLS & SERVICE REQUESTS ALERT BANNER */}
      {serviceRequests.length > 0 && (
        <Card className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-amber-400/90 rounded-2xl shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[#0B192C] text-[#39ff14] border border-[#39ff14]/40 flex items-center justify-center font-bold shadow-xs animate-bounce">
                <Bell className="w-4 h-4 text-[#39ff14]" />
              </span>
              <div>
                <h3 className="text-sm font-black text-zinc-950 flex items-center gap-2">
                  <span>Active Table Calls & Service Requests</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white">
                    {serviceRequests.length} {serviceRequests.length === 1 ? "Call" : "Calls"} Waiting
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Diners at your tables tapped their phone to request assistance or their bill.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {serviceRequests.map((req) => (
              <div
                key={req.id}
                className="p-3 bg-white rounded-xl border border-amber-200/90 shadow-2xs flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#0B192C] text-[#39ff14] flex flex-col items-center justify-center shrink-0 border border-[#39ff14]/30">
                    <span className="text-[9px] uppercase font-bold text-zinc-400">T#</span>
                    <span className="text-sm font-black text-[#39ff14] -mt-1">{req.table_number}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-zinc-900 truncate">
                        {req.request_type === "call_waiter" && "🙋‍♂️ Call Waiter"}
                        {req.request_type === "water" && "💧 Water Glasses"}
                        {req.request_type === "bill" && "🧾 Final Bill"}
                        {req.request_type === "cutlery" && "🍴 Extra Cutlery"}
                        {req.request_type === "clean" && "🧼 Clean Table"}
                        {req.request_type === "other" && "💬 Special Request"}
                      </span>
                    </div>
                    {req.diner_name && (
                      <span className="text-[10px] font-semibold text-emerald-700 block truncate">
                        {req.diner_name}
                      </span>
                    )}
                    {req.note && (
                      <span className="text-[10px] text-zinc-500 italic block truncate">
                        &quot;{req.note}&quot;
                      </span>
                    )}
                    <span className="text-[9px] text-zinc-400 block">
                      {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleMarkAttended(req.id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1 px-2.5 h-auto shrink-0 shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  <span>Attended</span>
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-zinc-100/90 p-1 rounded-xl border border-zinc-200/70 select-none overflow-x-auto">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 min-w-[95px] py-1 px-2.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "pending"
              ? "bg-white text-zinc-900 shadow-2xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          <span>Pending</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === "pending"
                ? "bg-orange-100 text-orange-700"
                : "bg-zinc-200 text-zinc-600"
            }`}
          >
            {counts.pending}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("active")}
          className={`flex-1 min-w-[95px] py-1 px-2.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "active"
              ? "bg-white text-zinc-900 shadow-2xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          <span>Cooking</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === "active"
                ? "bg-blue-100 text-blue-700"
                : "bg-zinc-200 text-zinc-600"
            }`}
          >
            {counts.active}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("completed")}
          className={`flex-1 min-w-[95px] py-1 px-2.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "completed"
              ? "bg-white text-zinc-900 shadow-2xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          <span>Completed</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === "completed"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-200 text-zinc-600"
            }`}
          >
            {counts.completed}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`py-1 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            activeTab === "all"
              ? "bg-white text-zinc-900 shadow-2xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          All ({orders.length})
        </button>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card className="text-center py-12 px-4">
          <Clock className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-zinc-800">
            No orders found
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            As soon as a guest orders from a table, it will appear here in real time.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredOrders.map((order) => {
            const isPending = order.status === "pending";
            const isAccepted = order.status === "accepted";
            const isPreparing = order.status === "preparing";
            const isReady = order.status === "ready";
            const isActionLoading = actionLoadingId === order.id;

            return (
              <Card
                key={order.id}
                className={`p-3.5 space-y-2.5 transition border ${
                  isPending
                    ? "border-amber-300 ring-2 ring-amber-100 bg-amber-50/15"
                    : "border-zinc-200/80 shadow-2xs hover:shadow-xs"
                }`}
              >
                {/* Header: Table, Status & Time */}
                <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-zinc-900 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">
                        T-{order.table_number}
                      </span>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                      #{order.id.slice(0, 8)} •{" "}
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-zinc-900">
                      ₹{order.total_amount}
                    </span>
                  </div>
                </div>

                {/* Customer Details */}
                {(order.customer_name || order.customer_phone) && (
                  <div className="text-[11px] text-zinc-500 flex items-center gap-2">
                    {order.customer_name && (
                      <span className="font-semibold text-zinc-800 truncate">
                        {order.customer_name}
                      </span>
                    )}
                    {order.customer_phone && (
                      <span className="flex items-center gap-1 text-zinc-500 shrink-0">
                        <Phone className="w-2.5 h-2.5" /> {order.customer_phone}
                      </span>
                    )}
                  </div>
                )}

                {/* Note */}
                {order.note && (
                  <div className="px-2 py-1.5 rounded-md bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-950 flex items-start gap-1.5">
                    <FileText className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      <strong className="font-semibold text-amber-900">Note:</strong> {order.note}
                    </span>
                  </div>
                )}

                {/* Order Items */}
                <div className="divide-y divide-zinc-100/80 text-xs py-0.5">
                  {order.order_items?.map((it) => (
                    <div
                      key={it.id}
                      className="py-1 flex justify-between items-center text-[12px]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <span className="font-mono text-[11px] font-bold text-zinc-900 bg-zinc-100 px-1 py-0.2 rounded shrink-0">
                          {it.quantity}×
                        </span>
                        <span className="font-medium text-zinc-800 truncate">
                          {it.item_name}
                        </span>
                      </div>
                      <span className="font-medium text-zinc-600 shrink-0">
                        ₹{Number(it.price) * it.quantity}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-1.5">
                  {isPending && (
                    <>
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={isActionLoading}
                        onClick={() => handleUpdateStatus(order.id, "rejected")}
                        className="h-8 px-2.5 text-xs flex-1 sm:flex-initial"
                      >
                        <XCircle className="w-3 h-3 mr-1" /> Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={isActionLoading}
                        onClick={() => handleUpdateStatus(order.id, "accepted")}
                        className="h-8 px-3 text-xs flex-1 sm:flex-initial bg-[#0B192C] text-[#39ff14] border border-[#39ff14]/40 font-bold hover:bg-black"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Accept
                      </Button>
                    </>
                  )}

                  {isAccepted && (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isActionLoading}
                      onClick={() => handleUpdateStatus(order.id, "preparing")}
                      className="h-8 px-3 text-xs w-full sm:w-auto bg-[#0B192C] text-[#39ff14] border border-[#39ff14]/40 font-bold hover:bg-black"
                    >
                      <ChefHat className="w-3 h-3 mr-1" /> Start Cooking
                    </Button>
                  )}

                  {isPreparing && (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isActionLoading}
                      onClick={() => handleUpdateStatus(order.id, "ready")}
                      className="h-8 px-3 text-xs w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <BellRing className="w-3 h-3 mr-1" /> Mark Ready
                    </Button>
                  )}

                  {isReady && (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isActionLoading}
                      onClick={() => handleUpdateStatus(order.id, "served")}
                      className="h-8 px-3 text-xs w-full sm:w-auto bg-zinc-900 hover:bg-black text-white font-bold"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Served
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
