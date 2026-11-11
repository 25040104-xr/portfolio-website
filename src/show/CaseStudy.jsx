import { useCallback, useEffect, useRef, useState } from "react";
import projects from "../data/projects.json";
import "./Lightbox.css";

const hide = (e) => {
  e.currentTarget.style.display = "none";
};

/* A project, opened as a large sheet of paper over the stage: the second layer of the site.
   A click on a screenshot opens it large, with a caption, arrows and a link to the full-size file. */
export default function CaseStudy({ slug, onClose, onOpen }) {
  const closeRef = useRef(null);
  const boxRef = useRef(null);
  const lbCloseRef = useRef(null);
  const lastThumb = useRef(null);
  const touchX = useRef(null);
  const [zoom, setZoom] = useState(null); // the number of the screenshot that is open large, or null

  const p = projects.find((x) => x.slug === slug);
  const shots = (p && p.screens) || [];
  const n = shots.length;
  const siblings = p ? projects.filter((x) => x.category === p.category) : [];
  const next =
    siblings.length > 1 ? siblings[(siblings.findIndex((x) => x.slug === slug) + 1) % siblings.length] : null;
  const zoomOpen = zoom !== null;

  const step = useCallback(
    (d) => setZoom((i) => (i === null || n === 0 ? i : (i + d + n) % n)),
    [n]
  );
  const closeZoom = useCallback(() => {
    setZoom(null);
    // the focus goes back to the screenshot that was opened
    setTimeout(() => lastThumb.current && lastThumb.current.focus && lastThumb.current.focus(), 0);
  }, []);

  // The focus goes to the Close button when the page opens, and back to where it was when it closes
  useEffect(() => {
    const before = document.activeElement;
    closeRef.current?.focus();
    return () => before?.focus?.();
  }, []);

  // Keys: with a screenshot open, Esc closes only that, and the arrows move between screenshots.
  // Otherwise Esc closes the case study.
  useEffect(() => {
    const onKey = (e) => {
      if (zoomOpen) {
        if (e.key === "Escape") closeZoom();
        else if (e.key === "ArrowRight") step(1);
        else if (e.key === "ArrowLeft") step(-1);
        return;
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomOpen, closeZoom, step, onClose]);

  // A new project starts at the top, with nothing enlarged
  useEffect(() => {
    boxRef.current?.scrollTo(0, 0);
    setZoom(null);
  }, [slug]);

  // When a screenshot opens large, the focus goes to its Close button
  useEffect(() => {
    if (zoomOpen) lbCloseRef.current?.focus();
  }, [zoomOpen]);

  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  };

  if (!p) return null;

  return (
    <>
      <div className="case" role="dialog" aria-modal="true" aria-labelledby="case-title" onClick={onClose}>
        <article className="case-box" ref={boxRef} onClick={(e) => e.stopPropagation()}>
          <button ref={closeRef} type="button" className="case-close" onClick={onClose}>
            Close ✕
          </button>

          <p className="case-kicker">CASE STUDY · {p.category.toUpperCase()}</p>
          <h2 id="case-title">{p.title}</h2>
          <p className="case-lead">{p.summary}</p>

          <dl className="case-meta">
            {p.role && (
              <div>
                <dt>ROLE</dt>
                <dd>{p.role}</dd>
              </div>
            )}
            <div>
              <dt>TOOLS</dt>
              <dd>{p.tags.join(" · ")}</dd>
            </div>
          </dl>

          {n > 0 && (
            <div className="case-screens">
              {shots.map((s, i) => (
                <figure key={s.src}>
                  <button
                    type="button"
                    className="shot"
                    aria-label={`Enlarge screenshot ${i + 1}: ${s.caption}`}
                    onClick={(e) => {
                      lastThumb.current = e.currentTarget;
                      setZoom(i);
                    }}
                  >
                    <img src={s.src} alt={s.caption} loading="lazy" onError={hide} />
                  </button>
                  <figcaption>{s.caption}</figcaption>
                </figure>
              ))}
            </div>
          )}

          {p.problem && (
            <section>
              <h3>Problem</h3>
              <p>{p.problem}</p>
            </section>
          )}

          {p.process && p.process.length > 0 && (
            <section>
              <h3>Process</h3>
              <ol>
                {p.process.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
          )}

          {p.result && (
            <section>
              <h3>Result</h3>
              <p>{p.result}</p>
            </section>
          )}

          {p.links && p.links.length > 0 && (
            <section>
              <h3>Links</h3>
              <ul>
                {p.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {next && (
            <button type="button" className="case-next" onClick={() => onOpen(next.slug)}>
              Next project: {next.title} →
            </button>
          )}
        </article>
      </div>

      {zoomOpen && shots[zoom] && (
        <div
          className="lb"
          role="dialog"
          aria-modal="true"
          aria-label={`Screenshot ${zoom + 1} of ${n}`}
          onClick={closeZoom}
        >
          <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
            <span className="lb-count">
              {zoom + 1} / {n}
            </span>
            <a className="lb-open" href={shots[zoom].src} target="_blank" rel="noreferrer">
              Open full size
            </a>
            <button ref={lbCloseRef} type="button" className="lb-close" onClick={closeZoom}>
              Close ✕
            </button>
          </div>

          <figure
            className="lb-fig"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <img src={shots[zoom].src} alt={shots[zoom].caption} />
            <figcaption>{shots[zoom].caption}</figcaption>
          </figure>

          {n > 1 && (
            <>
              <button
                type="button"
                className="lb-nav prev"
                aria-label="Previous screenshot"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="lb-nav next"
                aria-label="Next screenshot"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}