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
type SaveHandler = () => void;

type SettingsNavContextValue = {
  /** Register a back action while a detail/edit view is open; pass null when closed. */
  registerBack: (handler: BackHandler | null) => void;
  canGoBack: boolean;
  goBack: () => void;
  registerSave: (
    registration: { onSave: SaveHandler; dirty: boolean; disabled: boolean } | null,
  ) => void;
  saveVisible: boolean;
  saveDisabled: boolean;
  save: () => void;
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
  const saveRef = useRef<SaveHandler | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [saveVisible, setSaveVisible] = useState(false);
  const [saveDisabled, setSaveDisabled] = useState(true);

  const registerBack = useCallback((handler: BackHandler | null) => {
    handlerRef.current = handler;
    setCanGoBack(Boolean(handler));
  }, []);

  const registerSave = useCallback(
    (registration: { onSave: SaveHandler; dirty: boolean; disabled: boolean } | null) => {
      saveRef.current = registration?.onSave ?? null;
      setSaveVisible(Boolean(registration?.dirty));
      setSaveDisabled(registration?.disabled ?? true);
    },
    [],
  );

  const goBack = useCallback(() => {
    handlerRef.current?.();
  }, []);

  const save = useCallback(() => {
    saveRef.current?.();
  }, []);

  useEffect(() => {
    handlerRef.current = null;
    saveRef.current = null;
    setCanGoBack(false);
    setSaveVisible(false);
    setSaveDisabled(true);
  }, [resetKey]);

  return (
    <SettingsNavContext.Provider
      value={{
        registerBack,
        canGoBack,
        goBack,
        registerSave,
        saveVisible,
        saveDisabled,
        save,
      }}
    >
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

/** While `active`, registers a header Save action. Visible only when `dirty`. */
export function useSettingsHeaderSave(
  active: boolean,
  dirty: boolean,
  onSave: SaveHandler,
  disabled = false,
): void {
  const { registerSave } = useSettingsNav();
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (!active) {
      registerSave(null);
      return;
    }
    registerSave({
      onSave: () => onSaveRef.current(),
      dirty,
      disabled,
    });
    return () => registerSave(null);
  }, [active, dirty, disabled, registerSave]);
}
