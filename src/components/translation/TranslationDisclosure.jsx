import React from "react";

import { getTranslationDisclosure } from "../../translation/translationUtils";

export default function TranslationDisclosure({
  sourceLanguage = "",
  targetLanguage = "",
  notice = "",
}) {
  const text = getTranslationDisclosure({
    sourceLanguage,
    targetLanguage,
    notice,
  });
  if (!text) return null;
  return <div className="translation-disclosure">{text}</div>;
}
