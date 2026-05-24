// app/components/NotificationBell.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/firebase/firebaseConfig";
import { Notification } from "@/types/post.types";
import Link from "next/link";

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    loadNotifications(controller.signal);
    const interval = setInterval(() => loadNotifications(controller.signal), 30000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const loadNotifications = async (signal?: AbortSignal) => {
    if (!user) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();

      const response = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Error al cargar notificaciones:", error);
    }
  };

  const markAsRead = async (notificationIds: string[]) => {
    if (!user) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationIds }),
      });

      if (response.ok) {
        // Actualizar estado local
        setNotifications((prev) =>
          prev.map((n) =>
            notificationIds.includes(n.id) ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));
      }
    } catch (error) {
      console.error("Error al marcar notificaciones:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead([notification.id]);
    }
    setIsOpen(false);
  };

  const markAllAsRead = () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón de campana */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="relative p-2 text-gray-700 hover:text-bluegreen-eske transition-colors focus-ring-primary rounded dark:text-[#EAF2F8] dark:hover:text-[#6FC3EC]"
        aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`}
        aria-expanded={isOpen}
        aria-controls="notifications-dropdown"
        aria-haspopup="true"
      >
        <svg
          className="w-6 h-6 max-sm:w-5 max-sm:h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge de contador */}
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs max-sm:text-[10px] font-bold rounded-full w-5 h-5 max-sm:w-4 max-sm:h-4 flex items-center justify-center"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown de notificaciones */}
      {isOpen && (
        <div 
          id="notifications-dropdown"
          role="menu"
          aria-label="Menú de notificaciones"
          className="absolute right-0 mt-2 w-80 max-sm:w-[calc(100vw-2rem)] max-sm:max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 z-50 dark:bg-[#18324A] dark:border-white/10 dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 max-sm:p-3 border-b">
            <h3 className="font-semibold text-gray-800 text-base max-sm:text-sm dark:text-[#EAF2F8]">
              Notificaciones
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs max-sm:text-[10px] text-bluegreen-eske hover:text-bluegreen-eske-70 focus-ring-primary rounded px-1"
                aria-label="Marcar todas las notificaciones como leídas"
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          {/* Lista de notificaciones */}
          <div className="max-h-96 max-sm:max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div 
                className="p-4 max-sm:p-3 text-center text-gray-600"
                role="status"
                aria-live="polite"
              >
                <p className="text-sm max-sm:text-xs">No tienes notificaciones</p>
              </div>
            ) : (
              <ul role="list" aria-label={`${notifications.length} notificaciones`}>
                {notifications.map((notification) => (
                  <li key={notification.id} role="listitem">
                    <Link
                      href={`/blog/${notification.postSlug}#comment-${notification.commentId}`}
                      onClick={() => handleNotificationClick(notification)}
                      className={`block p-4 max-sm:p-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b last:border-b-0 border-gray-100 dark:border-white/10 focus-ring-primary ${
                        !notification.isRead ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                      role="menuitem"
                      aria-label={`${notification.message}. ${!notification.isRead ? 'No leída' : 'Leída'}`}
                    >
                      <div className="flex items-start gap-3 max-sm:gap-2">
                        {/* Icono */}
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-8 h-8 max-sm:w-6 max-sm:h-6 bg-bluegreen-eske rounded-full flex items-center justify-center">
                            <svg
                              className="w-4 h-4 max-sm:w-3 max-sm:h-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm max-sm:text-xs text-gray-800 dark:text-[#C7D6E0]" aria-hidden="true">
                            {notification.message}
                          </p>
                          <p className="text-xs max-sm:text-[10px] text-gray-500 dark:text-[#6D8294] mt-1">
                            <time dateTime={new Date(notification.createdAt).toISOString()}>
                              {new Date(notification.createdAt).toLocaleDateString(
                                "es-ES",
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </time>
                          </p>
                        </div>

                        {/* Indicador de no leído */}
                        {!notification.isRead && (
                          <div className="flex-shrink-0">
                            <div 
                              className="w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 bg-blue-500 rounded-full"
                              aria-label="No leída"
                            ></div>
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
