"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  UtensilsCrossed,
  Search,
  Star,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  X,
  ArrowRight,
  Bell,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useCartStore } from "@/store/useCartStore";
import { Hotel, Category, MenuItem } from "@/types";
import { CallWaiterModal } from "@/components/menu/CallWaiterModal";

interface CustomerMenuViewProps {
  hotel: Hotel;
  categories: Category[];
  items: MenuItem[];
  avgRating: number;
  reviewCount: number;
}

export default function CustomerMenuView({
  hotel,
  categories,
  items,
  avgRating,
  reviewCount,
}: CustomerMenuViewProps) {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get("table");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const {
    items: cartItems,
    addItem,
    updateQuantity,
    removeItem,
    tableNumber,
    setTableNumber,
    getTotalItems,
    getTotalAmount,
  } = useCartStore();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (tableParam) {
      const parsed = parseInt(tableParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setTableNumber(parsed);
      }
    }
  }, [tableParam, setTableNumber]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === "all" || item.category_id === selectedCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  const totalItemsCount = mounted ? getTotalItems() : 0;
  const totalCartAmount = mounted ? getTotalAmount() : 0;

  return (
    <div className="min-h-screen bg-zinc-50 pb-28 font-sans">
      {/* ------------------------------------------------------------- */}
      {/* 1. RESTAURANT HERO HEADER                                     */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-white border-b border-zinc-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#0B192C] text-[#39ff14] border border-[#39ff14]/40 flex items-center justify-center shrink-0 shadow-xs">
              <UtensilsCrossed className="w-5 h-5 text-[#39ff14]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-zinc-900 truncate">
                {hotel.name}
              </h1>
              <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                <span className="flex items-center gap-1 font-bold text-amber-600">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {avgRating.toFixed(1)}
                  <span className="text-zinc-400 font-normal">({reviewCount})</span>
                </span>
                {hotel.address && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[150px]">{hotel.address}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Call Waiter & Table Badge */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCallWaiterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B192C] hover:bg-black text-[#39ff14] border border-[#39ff14]/40 text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
            >
              <Bell className="w-3.5 h-3.5 text-[#39ff14] animate-pulse" />
              <span>Call Waiter</span>
            </button>

            {tableNumber && (
              <div className="shrink-0 px-2.5 py-1.5 rounded-xl bg-zinc-100 text-zinc-900 text-xs font-black border border-zinc-200">
                T#{tableNumber}
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search dishes, drinks, starters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 text-xs sm:text-sm bg-zinc-100/80 border-transparent focus:bg-white"
            />
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-2.5 flex items-center gap-2 overflow-x-auto select-none no-scrollbar">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
              selectedCategory === "all"
                ? "bg-orange-600 text-white shadow-xs"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
                selectedCategory === cat.id
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. MENU ITEMS LIST                                            */}
      {/* ------------------------------------------------------------- */}
      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-3xl border border-zinc-200/80">
            <UtensilsCrossed className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-zinc-800">
              No dishes found
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Try changing your search keywords or dietary filters.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const inCart = cartItems.find((i) => i.menu_item_id === item.id);
            const quantity = inCart ? inCart.quantity : 0;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl bg-white border border-zinc-200/70 shadow-xs flex items-center justify-between gap-4 transition ${
                  !item.is_available ? "opacity-60 bg-zinc-50/70" : ""
                }`}
              >
                {/* Left Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={item.is_veg ? "veg" : "non-veg"}>
                      {item.is_veg ? "Veg" : "Non-Veg"}
                    </Badge>
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-base text-zinc-900 leading-snug">
                    {item.name}
                  </h3>
                  <p className="font-black text-orange-600 text-sm mt-1">
                    ₹{item.price}
                  </p>
                  {item.description && (
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Right: Image & Add / Stepper Button */}
                <div className="relative shrink-0 flex flex-col items-center">
                  <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-2xl bg-orange-50 border border-orange-100 overflow-hidden flex items-center justify-center">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UtensilsCrossed className="w-8 h-8 text-orange-300" />
                    )}
                  </div>

                  {/* Add / Stepper Control */}
                  <div className="-mt-3.5 z-10">
                    {!item.is_available ? (
                      <span className="px-2.5 py-1 rounded-lg bg-zinc-200 text-zinc-600 text-[10px] font-bold shadow-xs">
                        Out of stock
                      </span>
                    ) : quantity > 0 ? (
                      <div className="flex items-center gap-1.5 bg-orange-600 text-white rounded-xl shadow-md shadow-orange-600/30 px-1.5 py-1">
                        <button
                          onClick={() => updateQuantity(item.id, quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center hover:bg-orange-700 rounded-lg transition"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-4 text-center font-black text-xs">
                          {quantity}
                        </span>
                        <button
                          onClick={() => addItem(item, hotel.id)}
                          className="w-6 h-6 flex items-center justify-center hover:bg-orange-700 rounded-lg transition"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addItem(item, hotel.id)}
                        className="px-4 py-1.5 rounded-xl bg-white text-orange-600 font-extrabold text-xs shadow-md shadow-zinc-900/10 border border-orange-200 hover:bg-orange-50 active:scale-95 transition"
                      >
                        + ADD
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 3. FLOATING CART BOTTOM BAR (Prompt 5.5)                       */}
      {/* ------------------------------------------------------------- */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-xl mx-auto z-40 animate-in slide-in-from-bottom-3">
          <button
            onClick={() => setIsCartDrawerOpen(true)}
            className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white px-5 py-3.5 rounded-2xl shadow-xl shadow-orange-600/30 flex items-center justify-between font-sans hover:brightness-105 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-orange-100 uppercase tracking-wider">
                  {totalItemsCount} {totalItemsCount === 1 ? "Item" : "Items"} in Cart
                </p>
                <p className="text-base font-black">₹{totalCartAmount}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-sm font-bold bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-xs">
              View Cart <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. CART DRAWER / MODAL (Prompt 5.5)                           */}
      {/* ------------------------------------------------------------- */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in"
            onClick={() => setIsCartDrawerOpen(false)}
          />

          {/* Drawer Body */}
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl z-10 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-black text-zinc-900">Your Order Cart</h2>
              </div>
              <button
                onClick={() => setIsCartDrawerOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Table Number Bar */}
            <div className="py-3 px-3.5 my-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950">
                Table: {tableNumber ? `Table ${tableNumber}` : "Table not selected"}
              </span>
              <button
                onClick={() => {
                  const input = prompt("Enter your table number (1-50):", tableNumber?.toString() || "");
                  if (input) {
                    const parsed = parseInt(input, 10);
                    if (!isNaN(parsed) && parsed > 0) setTableNumber(parsed);
                  }
                }}
                className="text-xs font-bold text-orange-700 underline"
              >
                Badlein
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 my-2 pr-1">
              {cartItems.map((item) => (
                <div key={item.menu_item_id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{item.name}</p>
                    <p className="text-xs text-zinc-500 font-medium">₹{item.price} each</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-zinc-100 rounded-xl px-1.5 py-1">
                      <button
                        onClick={() => updateQuantity(item.menu_item_id, item.quantity - 1)}
                        className="w-5 h-5 flex items-center justify-center hover:bg-zinc-200 rounded"
                      >
                        <Minus className="w-3 h-3 text-zinc-700" />
                      </button>
                      <span className="w-4 text-center font-bold text-xs text-zinc-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.menu_item_id, item.quantity + 1)}
                        className="w-5 h-5 flex items-center justify-center hover:bg-zinc-200 rounded"
                      >
                        <Plus className="w-3 h-3 text-zinc-700" />
                      </button>
                    </div>

                    <span className="text-xs font-black text-zinc-900 w-14 text-right">
                      ₹{item.price * item.quantity}
                    </span>

                    <button
                      onClick={() => removeItem(item.menu_item_id)}
                      className="p-1 text-zinc-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Calculation & Checkout */}
            <div className="pt-4 border-t border-zinc-100 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500 font-medium">Subtotal</span>
                <span className="font-bold text-zinc-900">₹{totalCartAmount}</span>
              </div>
              <div className="flex justify-between items-center text-base font-black">
                <span>Grand Total</span>
                <span className="text-zinc-950 font-black">₹{totalCartAmount}</span>
              </div>

              <Link
                href={`/menu/${hotel.slug}/checkout`}
                onClick={() => setIsCartDrawerOpen(false)}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[#0B192C] hover:bg-black text-[#39ff14] border border-[#39ff14]/40 font-bold text-sm shadow-md shadow-[#39ff14]/15 transition mt-2"
              >
                Proceed to Checkout <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Call Waiter & Table Service Modal */}
      <CallWaiterModal
        isOpen={isCallWaiterOpen}
        onClose={() => setIsCallWaiterOpen(false)}
        hotelId={hotel.id}
        hotelName={hotel.name}
        tableNumber={tableNumber || 1}
      />
    </div>
  );
}
