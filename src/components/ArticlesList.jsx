import React, { useEffect, useMemo, useState } from "react";

export default function ArticlesList({
  articles,
  resultsView,
  isAppRuntime,
  getArticleImage,
  normalizeProviderLabel,
  stripHtml,
  openReadOnly,
  openExternal,
}) {
  const PAGE_SIZE = 60;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [articles]);

  const visibleArticles = useMemo(
    () => articles.slice(0, Math.max(PAGE_SIZE, visibleCount)),
    [articles, visibleCount]
  );

  return (
    <>
      <div className={`results-grid ${resultsView === "card" ? "cards" : "list"}`}>
      {visibleArticles.map((article) => {
        const rowImage = getArticleImage(article);
        const metaItems = [
          article.source || "Unknown source",
          normalizeProviderLabel(article.provider) || "Unknown provider",
          article.publishedAt || "Unpublished",
        ];
        return (
          <article
            key={article.id}
            className="result-card"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (article.url) {
                  openReadOnly(article);
                }
              }
            }}
          >
            <div className={`result-media${rowImage ? "" : " placeholder"}`}>
              {rowImage ? (
                <img src={rowImage} alt={article.title || "Article image"} />
              ) : (
                <span>No image</span>
              )}
            </div>
            <div className="result-body">
              <div className="result-meta">{metaItems.join(" • ")}</div>
              <h4 className="result-title">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    if (isAppRuntime) {
                      event.preventDefault();
                      openExternal(article.url);
                    }
                  }}
                >
                  {article.title || "Untitled article"}
                </a>
              </h4>
              <p className="result-description">
                {stripHtml(article.description || article.content) ||
                  "No preview available."}
              </p>
              <div className="result-actions">
                {article.url && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => openReadOnly(article)}
                  >
                    Read-only
                  </button>
                )}
                {article.url && (
                  <button type="button" onClick={() => openExternal(article.url)}>
                    Original
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
      </div>
      {visibleArticles.length < articles.length ? (
        <div className="results-load-more">
          <button
            type="button"
            onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}
          >
            Load more ({visibleArticles.length}/{articles.length})
          </button>
        </div>
      ) : null}
    </>
  );
}
