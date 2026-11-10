"use client";

import React, { createContext, useCallback, useContext } from "react";
import { Slide, ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type ToastType = "success" | "error" | "info";

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Notifications via react-toastify.
 *
 * L'API `showToast(message, type)` est conservee : toutes les pages qui
 * l'appelaient fonctionnent sans modification. Le style est aligne sur la
 * charte du Manoir dans globals.css (classes .Toastify__*).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const showToast = useCallback((message: string, type: ToastType) => {
    // Evite d'empiler deux fois le meme message (double clic, double rendu).
    const toastId = `${type}:${message}`;
    if (toast.isActive(toastId)) return;

    const options = { toastId };
    if (type === "success") toast.success(message, options);
    else if (type === "error") toast.error(message, { ...options, autoClose: 6000 });
    else toast.info(message, options);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={4000}
        newestOnTop
        closeOnClick
        pauseOnHover
        pauseOnFocusLoss
        draggable
        limit={4}
        transition={Slide}
        className="manoir-toasts"
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
