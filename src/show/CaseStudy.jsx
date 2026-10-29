import { useEffect, useRef } from "react";
import projects from "../data/projects.json";

const hide = (e) => {
  e.currentTarget.style.display = "none";
};

/* A project, opened as a large sheet of paper over the stage: the second layer of the site */
export default function CaseStudy({ slug, onClose, onOpen }) {
  const closeRef = useRef(null);
  const boxRef = useRef(null);
  const p = projects.find((x) => x.slug === slug);
  const siblings = p ? projects.filter((x) => x.category === p.category) : [];
  const next =
    siblings.length > 1 ? siblings[(siblings.findIndex((x) => x.slug === slug) + 1) % siblings.length] : null;

  // Esc closes it, and focus goes back to where it was
  useEffect(() => {
    const before = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [onClose]);

  // a new project starts at the top
  useEffect(() => {
    boxRef.current?.scrollTo(0, 0);
  }, [slug]);

  if (!p) return null;

  return (
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

        {p.screens && p.screens.length > 0 && (
          <div className="case-screens">
            {p.screens.map((s) => (
              <figure key={s.src}>
                <img src={s.src} alt={s.caption} loading="lazy" onError={hide} />
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
  );
}