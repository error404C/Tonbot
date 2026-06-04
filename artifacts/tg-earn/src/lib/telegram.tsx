import React, { createContext, useContext, useEffect, useState } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface TelegramUser {
  id: string;
  username?: string;
  firstName?: string;
}

interface TelegramContextType {
  user: TelegramUser | null;
  isLoading: boolean;
}

const TelegramContext = createContext<TelegramContextType>({ user: null, isLoading: true });

export const TelegramProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tgUser, setTgUser] = useState<TelegramUser | null>(null);
  const [initialized, setInitialized] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Add dark mode by default for that gaming vibe
    document.documentElement.classList.add("dark");

    try {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        const unsafeUser = window.Telegram.WebApp.initDataUnsafe?.user;
        if (unsafeUser) {
          setTgUser({
            id: unsafeUser.id.toString(),
            username: unsafeUser.username,
            firstName: unsafeUser.first_name,
          });
        } else {
          // Fallback for development outside Telegram but with SDK loaded
          setTgUser({ id: "test123", username: "testuser", firstName: "Test" });
        }
      } else {
        // Fallback for local development without SDK
        setTgUser({ id: "test123", username: "testuser", firstName: "Test" });
      }
    } catch (e) {
      console.error("Failed to initialize Telegram WebApp", e);
      setTgUser({ id: "test123", username: "testuser", firstName: "Test" });
    }
    setInitialized(true);
  }, []);

  const { isLoading: isApiLoading } = useGetMe(
    {
      telegramId: tgUser?.id ?? "",
      username: tgUser?.username,
      firstName: tgUser?.firstName,
    },
    {
      query: {
        enabled: !!tgUser?.id,
        queryKey: getGetMeQueryKey({
          telegramId: tgUser?.id ?? "",
          username: tgUser?.username,
          firstName: tgUser?.firstName,
        }),
      },
    }
  );

  return (
    <TelegramContext.Provider value={{ user: tgUser, isLoading: !initialized || isApiLoading }}>
      {children}
    </TelegramContext.Provider>
  );
};

export const useTelegram = () => useContext(TelegramContext);
