import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useApp } from './AppContext';
import { isMobileWalkingDevice } from '../services/walking';
import { createWalkingController } from '../services/walking-controller';
const WalkingContext = createContext<ReturnType<typeof createWalkingController> | null>(null);
export function WalkingProvider({
  children,
  controller: suppliedController,
}: {
  children: ReactNode;
  controller?: ReturnType<typeof createWalkingController>;
}) {
  const { session, mode, reload } = useApp();
  const refresh = useRef(reload);
  refresh.current = reload;
  const [controller] = useState(
    () =>
      suppliedController ||
      createWalkingController({
        geo: navigator.geolocation,
        mobile: isMobileWalkingDevice(navigator),
        screen: window.screen,
        hidden: () => document.hidden,
        onProgress: () => {
          void refresh.current();
        },
      }),
  );
  useEffect(() => {
    controller.setOwner(
      mode === 'live' && session.status === 'authenticated' ? session.wallet : null,
    );
  }, [controller, mode, session.status, session.wallet]);
  useEffect(() => {
    if (mode !== 'live') return;
    void controller.loadCapabilities();
    const visibility = () => controller.visibilityChanged();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pageshow', visibility);
    window.addEventListener('pagehide', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pageshow', visibility);
      window.removeEventListener('pagehide', visibility);
      controller.dispose();
    };
  }, [controller, mode]);
  return <WalkingContext.Provider value={controller}>{children}</WalkingContext.Provider>;
}
export function useWalking() {
  const controller = useContext(WalkingContext);
  if (!controller) throw new Error('WalkingProvider is missing.');
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return { ...state, controller };
}
export function useOptionalWalking() {
  return useContext(WalkingContext);
}
