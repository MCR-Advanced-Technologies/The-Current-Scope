import React from "react";

import { splitTranslatedText } from "../../translation/translationUtils";

export default function ArticleTranslationBody({ text = "" }) {
  const paragraphs = splitTranslatedText(text);
  if (!paragraphs.length) return null;
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={`translated-read-only-${index}`}>{paragraph}</p>
      ))}
    </>
  );
}
