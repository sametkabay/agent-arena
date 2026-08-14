import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SettingsNavContext } from "@/components/SettingsModal/settingsNav";

type BackHandler = () => void;
type SaveHandler = () => void;

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
