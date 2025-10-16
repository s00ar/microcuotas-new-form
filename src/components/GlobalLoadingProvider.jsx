import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const GlobalLoadingContext = createContext({
  startLoading: () => {},
  stopLoading: () => {},
});

const SPINNER_DELAY_MS = 400;

export const GlobalLoadingProvider = ({ children }) => {
  const [activeRequests, setActiveRequests] = useState(0);
  const [visible, setVisible] = useState(false);
  const delayRef = useRef(null);

  useEffect(() => {
    if (activeRequests > 0) {
      if (!delayRef.current) {
        delayRef.current = setTimeout(() => {
          setVisible(true);
          delayRef.current = null;
        }, SPINNER_DELAY_MS);
      }
    } else {
      if (delayRef.current) {
        clearTimeout(delayRef.current);
        delayRef.current = null;
      }
      setVisible(false);
    }
  }, [activeRequests]);

  useEffect(
    () => () => {
      if (delayRef.current) {
        clearTimeout(delayRef.current);
      }
    },
    []
  );

  const startLoading = useCallback(() => {
    setActiveRequests((current) => current + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setActiveRequests((current) => Math.max(0, current - 1));
  }, []);

  const value = useMemo(
    () => ({
      startLoading,
      stopLoading,
    }),
    [startLoading, stopLoading]
  );

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
      {visible && (
        <div className="global-loading-overlay" role="status" aria-live="polite">
          <div className="global-loading-spinner" aria-label="Cargando"></div>
        </div>
      )}
    </GlobalLoadingContext.Provider>
  );
};

export const useGlobalLoading = () => useContext(GlobalLoadingContext);

export const useGlobalLoadingEffect = (isActive) => {
  const { startLoading, stopLoading } = useGlobalLoading();
  const activeRef = useRef(false);

  useEffect(() => {
    if (isActive && !activeRef.current) {
      activeRef.current = true;
      startLoading();
    } else if (!isActive && activeRef.current) {
      activeRef.current = false;
      stopLoading();
    }
    return () => {
      if (activeRef.current) {
        activeRef.current = false;
        stopLoading();
      }
    };
  }, [isActive, startLoading, stopLoading]);
};

export default GlobalLoadingContext;
