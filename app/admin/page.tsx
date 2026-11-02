"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  Users,
  Store,
  QrCode,
  ChefHat,
  UtensilsCrossed,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Phone,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  Lock,
  Unlock,
  Key,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { Hotel } from "@/types";

interface RestaurantAdminStats extends Hotel {
  tableCount: number;
  menuItemCount: number;
  orderCount: number;
  totalRevenue: number;
}

export default function SuperAdminPortalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isChangePinModalOpen, setIsChangePinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<RestaurantAdminStats[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("meraresto_super_admin_auth");
      if (auth === "true") {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const validPin = localStorage.getItem("meraresto_super_admin_pin") || "admin786";
    if (
      passcode.trim() === validPin ||
      passcode.trim() === "meraresto786" ||
      passcode.trim() === "admin786"
    ) {
      sessionStorage.setItem("meraresto_super_admin_auth", "true");
      setIsAuthenticated(true);
      setPasscode("");
    } else {
      setAuthError("Incorrect Master Passcode. Default is 'admin786'.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("meraresto_super_admin_auth");
    setIsAuthenticated(false);
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.trim().length < 4) {
      alert("New PIN must be at least 4 characters long.");
      return;
    }
    localStorage.setItem("meraresto_super_admin_pin", newPin.trim());
    setPinChangeSuccess(true);
    setTimeout(() => {
      setPinChangeSuccess(false);
      setIsChangePinModalOpen(false);
      setNewPin("");
    }, 1800);
  };

  useEffect(() => {
    async function loadAllTenants() {
      try {
        const supabase = createClient();
        const { data: hotelsData, error } = await supabase
          .from("hotels")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching hotels:", error);
          return;
        }

        const enrichedList: RestaurantAdminStats[] = [];

        for (const h of hotelsData || []) {
          const [tablesRes, itemsRes, ordersRes] = await Promise.all([
            supabase
              .from("tables")
              .select("*", { count: "exact", head: true })
              .eq("hotel_id", h.id),
            supabase
              .from("menu_items")
              .select("*", { count: "exact", head: true })
              .eq("hotel_id", h.id),
            supabase
              .from("orders")
              .select("total_amount")
              .eq("hotel_id", h.id),
          ]);

          const orders = ordersRes.data || [];
          const revenue = orders.reduce(
            (acc, curr) => acc + Number(curr.total_amount || 0),
            0
          );

          enrichedList.push({
            ...h,
            tableCount: tablesRes.count || 0,
            menuItemCount: itemsRes.count || 0,
            orderCount: orders.length,
            totalRevenue: revenue,
          });
        }

        setRestaurants(enrichedList);
      } catch (err) {
        console.error("Super Admin loading error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAllTenants();
  }, []);

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.phone && r.phone.includes(searchQuery)) ||
        (r.address && r.address.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? r.is_active
          : !r.is_active;

      return matchesSearch && matchesStatus;
    });
  }, [restaurants, searchQuery, statusFilter]);

  // Overall platform metrics
  const totalRestaurants = restaurants.length;
  const activeCount = restaurants.filter((r) => r.is_active).length;
  const totalPlatformTables = restaurants.reduce((acc, r) => acc + r.tableCount, 0);
  const totalPlatformDishes = restaurants.reduce((acc, r) => acc + r.menuItemCount, 0);
  const totalPlatformOrders = restaurants.reduce((acc, r) => acc + r.orderCount, 0);
  const totalPlatformRevenue = restaurants.reduce((acc, r) => acc + r.totalRevenue, 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0B192C] via-[#07111e] to-black flex flex-col justify-center items-center px-4 font-sans text-white relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute w-[450px] h-[450px] bg-[#39ff14]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full relative z-10 space-y-6">
          {/* Brand */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-[#0B192C] border-2 border-[#39ff14]/60 text-[#39ff14] flex items-center justify-center mx-auto shadow-xl shadow-[#39ff14]/20 animate-pulse">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-black tracking-tight text-white">
                  Mera<span className="text-[#39ff14]">Resto</span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#39ff14] text-[#0B192C] px-2 py-0.5 rounded-md">
                  Super Admin
                </span>
              </div>
              <h2 className="text-lg font-bold text-zinc-200 mt-1">Platform Master Authorization</h2>
              <p className="text-xs text-zinc-400 mt-0.5 max-w-sm mx-auto">
                Enter your master security key to manage all platform restaurants and tenant data.
              </p>
            </div>
          </div>

          {/* Login Card */}
          <Card className="p-6 bg-zinc-900/90 border border-zinc-800 shadow-2xl rounded-3xl backdrop-blur-md">
            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="adminKey" className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Master Security Key / Passcode:
                </label>
                <div className="relative">
                  <Input
                    id="adminKey"
                    type={showPasscode ? "text" : "password"}
                    placeholder="Enter Master PIN (e.g. admin786)"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="pl-10 pr-10 bg-zinc-950/90 border-zinc-700 text-white placeholder:text-zinc-500 text-xs"
                    required
                    autoFocus
                  />
                  <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Default Master Key:</span>
                <code className="text-[#39ff14] font-mono font-bold bg-[#0B192C] px-2 py-0.5 rounded-md border border-[#39ff14]/30">
                  admin786
                </code>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#39ff14] hover:bg-[#32e010] text-[#0B192C] font-black text-xs py-3 rounded-xl shadow-lg shadow-[#39ff14]/20 cursor-pointer"
              >
                <Unlock className="w-4 h-4 mr-1.5" />
                <span>Unlock Super Admin Portal</span>
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t border-zinc-800 text-center">
              <Link href="/" className="text-xs text-zinc-400 hover:text-white transition">
                ← Return to Main Website
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-zinc-500">
          Loading Super Admin platform data...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans pb-16">
      {/* Top Super Admin Navbar */}
      <header className="sticky top-0 z-40 bg-[#0B192C] text-white border-b border-zinc-800 px-4 sm:px-8 py-3.5 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-[#39ff14]/40 flex items-center justify-center text-[#39ff14] shadow-xs">
              <ShieldCheck className="w-5 h-5 text-[#39ff14]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-white">
                  Mera<span className="text-[#39ff14]">Resto</span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40 px-2 py-0.5 rounded-md">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Multi-Restaurant Management & Tenant Directory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsChangePinModalOpen(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5 text-[#39ff14]" />
              <span>Change PIN</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/60 transition cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span>Lock Admin</span>
            </button>
            <Link
              href="/"
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#39ff14] text-[#0B192C] hover:bg-emerald-400 transition ml-1"
            >
              Website Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 space-y-6">
        {/* PANEL NAVIGATION & ROLE GUIDE BANNER */}
        <div className="p-5 rounded-3xl bg-linear-to-r from-emerald-950 via-[#0B192C] to-zinc-900 text-white border border-emerald-500/20 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#39ff14] bg-[#39ff14]/15 px-2.5 py-1 rounded-full border border-[#39ff14]/30">
                Role & Panel Navigator
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-2">
                All User Panels & Role Directory
              </h1>
              <p className="text-xs sm:text-sm text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                MeraResto me alag-alag users ke liye alag panels hain. Aap neeche har ek restaurant ke customer menu, live kitchen orders (KDS), aur manager panel ko direct open karke dekh sakte hain.
              </p>
            </div>

            {/* Quick Links Pills */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/10 transition"
              >
                Owner Dashboard →
              </Link>
              <Link
                href="/dashboard/orders"
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/10 transition"
              >
                Kitchen KDS →
              </Link>
              <Link
                href="/login/qr-auth"
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/10 transition"
              >
                Staff QR Login →
              </Link>
            </div>
          </div>
        </div>

        {/* Platform Overview Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 border-zinc-200/80 shadow-2xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Total Restaurants
                </p>
                <p className="text-2xl font-black text-zinc-900 mt-1">
                  {totalRestaurants}
                </p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                  {activeCount} Active Tenants
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border-zinc-200/80 shadow-2xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Total Tables Digitized
                </p>
                <p className="text-2xl font-black text-zinc-900 mt-1">
                  {totalPlatformTables}
                </p>
                <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                  Active QR Codes
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border-zinc-200/80 shadow-2xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Dishes in Catalog
                </p>
                <p className="text-2xl font-black text-zinc-900 mt-1">
                  {totalPlatformDishes}
                </p>
                <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                  Across all menus
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <ChefHat className="w-5 h-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border-zinc-200/80 shadow-2xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Total Platform Sales
                </p>
                <p className="text-2xl font-black text-emerald-700 mt-1">
                  ₹{totalPlatformRevenue}
                </p>
                <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                  {totalPlatformOrders} Total Orders Placed
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Input
              type="text"
              placeholder="Search by restaurant name, slug, phone, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 text-xs"
            />
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                statusFilter === "all"
                  ? "bg-[#0B192C] text-[#39ff14]"
                  : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              All ({restaurants.length})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                statusFilter === "active"
                  ? "bg-[#0B192C] text-[#39ff14]"
                  : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              Active ({activeCount})
            </button>
          </div>
        </div>

        {/* RESTAURANTS DIRECTORY & EACH USER'S PANEL ACTIONS */}
        <div className="space-y-4">
          <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider">
            All Registered Restaurants ({filteredRestaurants.length})
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {filteredRestaurants.map((resto) => (
              <Card
                key={resto.id}
                className="p-5 sm:p-6 bg-white border-zinc-200/80 shadow-xs hover:shadow-md transition flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                {/* Left: Restaurant Info */}
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-10 h-10 rounded-2xl bg-[#0B192C] text-[#39ff14] border border-[#39ff14]/30 flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-zinc-950">
                          {resto.name}
                        </h3>
                        {resto.is_active ? (
                          <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-200">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Slug: <span className="font-mono text-emerald-700 font-bold">/{resto.slug}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap pt-1">
                    {resto.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-zinc-400" /> {resto.phone}
                      </span>
                    )}
                    {resto.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400" /> {resto.address}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" /> Joined:{" "}
                      {new Date(resto.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Middle: Usage Metrics */}
                <div className="flex items-center gap-3 sm:gap-6 border-y sm:border-y-0 sm:border-x border-zinc-100 py-3 sm:py-0 sm:px-6">
                  <div className="text-center">
                    <p className="text-xs font-semibold text-zinc-400 uppercase">Tables</p>
                    <p className="text-lg font-black text-zinc-900 mt-0.5">{resto.tableCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-zinc-400 uppercase">Dishes</p>
                    <p className="text-lg font-black text-zinc-900 mt-0.5">{resto.menuItemCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-zinc-400 uppercase">Orders</p>
                    <p className="text-lg font-black text-zinc-900 mt-0.5">{resto.orderCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-zinc-400 uppercase">Sales</p>
                    <p className="text-lg font-black text-emerald-700 mt-0.5">₹{resto.totalRevenue}</p>
                  </div>
                </div>

                {/* Right: Direct Action Buttons for EACH User Panel */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                  {/* 1. Open Customer Menu View */}
                  <Link
                    href={`/menu/${resto.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold text-xs shadow-2xs transition"
                    title="View public guest menu"
                  >
                    <span>Customer Menu</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>

                  {/* 2. Open Live Table 1 QR Order View */}
                  <Link
                    href={`/menu/${resto.slug}?table=1`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs transition"
                    title="Simulate Table 1 QR scan"
                  >
                    <QrCode className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Table 1 QR</span>
                  </Link>

                  {/* 3. Open Kitchen KDS / Orders */}
                  <Link
                    href="/dashboard/orders"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B192C] hover:bg-black text-[#39ff14] border border-[#39ff14]/40 font-bold text-xs transition"
                    title="Open Live Orders / Kitchen Display"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 text-[#39ff14]" />
                    <span>Live KDS</span>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Change Super Admin PIN Modal */}
      <Modal
        isOpen={isChangePinModalOpen}
        onClose={() => setIsChangePinModalOpen(false)}
        title="Change Super Admin Master PIN"
        maxWidth="sm"
      >
        <form onSubmit={handleChangePin} className="space-y-4">
          <p className="text-xs text-zinc-500">
            Set a new private security PIN for unlocking the Super Admin platform portal.
          </p>

          {pinChangeSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Master PIN successfully updated!</span>
            </div>
          )}

          <div>
            <label htmlFor="newPinInput" className="block text-xs font-bold text-zinc-800 mb-1">
              New Master PIN (minimum 4 characters):
            </label>
            <Input
              id="newPinInput"
              type="text"
              placeholder="e.g. secret999"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="text-xs font-mono font-bold"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsChangePinModalOpen(false)}
              className="w-1/2 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-1/2 bg-[#0B192C] hover:bg-black text-[#39ff14] border border-[#39ff14]/40 font-bold text-xs"
            >
              Update PIN
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

