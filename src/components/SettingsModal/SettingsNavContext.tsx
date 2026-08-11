import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type BackHandler = () => void;

type SettingsNavContextValue = {
  /** Register a back action while a detail/edit view is open; pass null when closed. */
  registerBack: (handler: BackHandler | null) => void;
  canGoBack: boolean;
  goBack: () => void;
};

const SettingsNavContext = createContext<SettingsNavContextValue | null>(null);

export function SettingsNavProvider({
  children,
  resetKey,
}: {
  children: ReactNode;
  /** Clear nested back state when this changes (e.g. active settings tab). */
  resetKey: string;
}) {
  const handlerRef = useRef<BackHandler | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  const registerBack = useCallback((handler: BackHandler | null) => {
    handlerRef.current = handler;
    setCanGoBack(Boolean(handler));
  }, []);

  const goBack = useCallback(() => {
    handlerRef.current?.();
  }, []);

  useEffect(() => {
    handlerRef.current = null;
    setCanGoBack(false);
  }, [resetKey]);

  return (
    <SettingsNavContext.Provider value={{ registerBack, canGoBack, goBack }}>
      {children}
    </SettingsNavContext.Provider>
  );
}

export function useSettingsNav(): SettingsNavContextValue {
  const ctx = useContext(SettingsNavContext);
  if (!ctx) {
    throw new Error("useSettingsNav must be used within SettingsNavProvider");
  }
  return ctx;
}

/** While `active`, registers `onBack` as the settings header back action. */
export function useSettingsBack(active: boolean, onBack: BackHandler): void {
  const { registerBack } = useSettingsNav();
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) {
      registerBack(null);
      return;
    }
    registerBack(() => onBackRef.current());
    return () => registerBack(null);
  }, [active, registerBack]);
}
