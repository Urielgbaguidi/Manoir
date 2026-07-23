"use client";

import { Bell, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, Notification } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Date relative en français, avec repli sur une date absolue au-delà d'une semaine. */
function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "à l'instant";
  const min = Math.round(diffSec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `il y a ${day} j`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

const isUnread = (notification: Notification) => notification.status !== "read";

/**
 * Cloche de notifications in-app. Ne s'affiche que pour un utilisateur connecté.
 * Récupère les notifications au montage, ouvre un dropdown en verre au clic,
 * et se ferme au clic extérieur ou avec Échap.
 */
export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch {
      /* silencieux : la cloche ne doit jamais casser la navbar */
    } finally {
      setLoading(false);
    }
  }, []);

  // Chargement initial et réinitialisation à la (dé)connexion.
  useEffect(() => {
    if (user) {
      load();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setOpen(false);
    }
  }, [user, load]);

  // Fermeture au clic extérieur + touche Échap.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      if (next) load();
      return next;
    });
  };

  const handleMarkRead = async (notification: Notification) => {
    if (!isUnread(notification)) return;
    try {
      await api.markNotificationRead(notification.id);
      await load();
    } catch {
      /* ignore : l'état sera resynchronisé au prochain chargement */
    }
  };

  const handleMarkAll = async () => {
    try {
      await api.markAllNotificationsRead();
      await load();
    } catch {
      /* ignore */
    }
  };

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Notifications"
        className="relative grid size-10 place-items-center rounded-full border border-gold/25 bg-white/5 text-cream backdrop-blur-md transition hover:border-gold/60 hover:bg-gold/15"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-night">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="!absolute right-0 top-12 z-[100] w-80 overflow-hidden rounded-2xl border border-gold/15 glass-dark glass-edge shadow-glass"
        >
          <div className="flex items-center justify-between border-b border-gold/15 px-4 py-3">
            <span className="font-display text-sm uppercase tracking-[0.16em] text-cream">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-light transition hover:text-gold"
              >
                <Check size={12} />
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-cream/60">Chargement…</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-cream/60">Aucune notification.</p>
            ) : (
              <ul>
                {notifications.map((notification) => {
                  const unread = isUnread(notification);
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => handleMarkRead(notification)}
                        className={cn(
                          "flex w-full gap-3 border-b border-gold/10 px-4 py-3 text-left transition last:border-b-0 hover:bg-white/5",
                          unread ? "cursor-pointer" : "cursor-default"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            unread ? "bg-gold" : "bg-transparent"
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-sm leading-snug",
                              unread ? "text-cream" : "text-cream/70"
                            )}
                          >
                            {notification.content || notification.type}
                          </span>
                          <span
                            className={cn(
                              "mt-1 block text-[11px] uppercase tracking-[0.1em]",
                              unread ? "text-gold-light" : "text-cream/40"
                            )}
                          >
                            {relativeDate(notification.created_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
