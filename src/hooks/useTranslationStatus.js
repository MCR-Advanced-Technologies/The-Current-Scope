import { useEffect, useState } from "react";

import { loadTranslationStatus } from "../translation/translationService";

const INITIAL_STATUS = {
  loading: true,
  enabled: false,
  provider: "",
  disclosure: "",
  defaultTargetLanguage: "en",
  message: "",
  reason: "",
};

export default function useTranslationStatus() {
  const [status, setStatus] = useState(INITIAL_STATUS);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      const nextStatus = await loadTranslationStatus();
      if (cancelled) return;
      setStatus({
        loading: false,
        ...nextStatus,
      });
    }

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
