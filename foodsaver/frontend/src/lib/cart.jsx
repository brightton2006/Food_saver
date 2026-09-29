import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "./session.jsx";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { session } = useSession();
  const userId = session?.id || session?.username || session?.email || "guest";
  const storageKey = `foodsaver.cart.${userId}`;

  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem(`foodsaver.cart.${userId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync cart state when logged-in user changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setCartItems(saved ? JSON.parse(saved) : []);
    } catch {
      setCartItems([]);
    }
  }, [storageKey]);

  // Persist cart items for the specific active user
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cartItems));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [cartItems, storageKey]);

  const addToCart = (listing, qty = 1) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.listing.id === listing.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const currentQty = updated[existingIndex].quantity;
        const maxQty = listing.quantityAvailable || 10;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: Math.min(maxQty, currentQty + qty),
        };
        return updated;
      } else {
        return [...prev, { listing, quantity: Math.max(1, qty) }];
      }
    });
  };

  const removeFromCart = (listingId) => {
    setCartItems((prev) => prev.filter((item) => item.listing.id !== listingId));
  };

  const updateQuantity = (listingId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(listingId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.listing.id === listingId) {
          const maxQty = item.listing.quantityAvailable || 10;
          return { ...item, quantity: Math.min(maxQty, newQty) };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = cartItems.reduce((sum, item) => {
    const originalPrice = Number(item.listing.originalPrice) || Number(item.listing.discountPrice) * 2;
    return sum + originalPrice * item.quantity;
  }, 0);

  const totalPayable = cartItems.reduce((sum, item) => {
    const discountPrice = Number(item.listing.discountPrice) || 60;
    return sum + discountPrice * item.quantity;
  }, 0);

  const totalSavings = subtotal - totalPayable;

  return (
    <CartContext.Provider
      value={{
        cartItems,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalCount,
        subtotal,
        totalSavings,
        totalPayable,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
