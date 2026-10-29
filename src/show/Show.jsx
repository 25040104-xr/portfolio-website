import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import content from "../data/content.json";
import projects from "../data/projects.json";
import profile from "../data/profile.json";
import { COPY } from "./copy.js";
import Logo from "./Logo.jsx";
import CaseStudy from "./CaseStudy.jsx";
import "./Show.css";
import "./Work.css";
import "./Opening.css";

// The 3D scene is loaded after the page, so the words never wait for it
const Scene = lazy(() => import("./Scene.jsx"));

const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const ACTS = ["Home", "Work", "About", "Contact"];
const OUTFITS = ["hello", "work", "hello", "contact"]; // the costume for each act
const FILTERS = [
  ["all", "All"],
  ["code", "Code"],
  ["design", "Design"],
];
const PER_PAGE = 6; // how many posters one side of the wall shows before it turns the page
const real = (url) => url && !url.includes("yourname");

/* ---------------- About: me, skills, and why live entertainment ---------------- */
function AboutPanel() {
  const [view, setView] = useState("me");
  const s = content.stack;
  const groups = [
    ["Front-end", s.stage],
    ["Design", s.design || []],
    ["Back-end", s.backstage],
  ];
  const live = content.offstage;

  return (
    <>
      <h2>{COPY.about.title}</h2>

      {view === "me" && (
        <>
          <p className="lead">{content.aboutHero.join(" ")}</p>
          <ul className="facts">
            {content.passes.map((p) => (
              <li key={p.zone}>
                <b>{p.stat === "{projects}" ? projects.length : p.stat}</b>
                <span>{p.label}</span>
                <p>{p.text}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {view === "skills" &&
        groups.map(([label, list]) => (
          <div key={label} className="skill-row">
            <span>{label}</span>
            <p>{list.map((x) => x.name).join(" · ")}</p>
          </div>
        ))}

      {view === "live" && (
        <>
          <p className="lead">{live.line}</p>
          <p>{live.after}</p>
        </>
      )}

      <div className="chips">
        {[
          ["me", "Me"],
          ["skills", "Skills"],
          ["live", "Why live entertainment"],
        ].map(([id, label]) => (
          <button key={id} type="button" className={view === id ? "chip fill" : "chip"} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
        {content.resume && (
          <a className="chip" href={content.resume} target="_blank" rel="noreferrer">
            Résumé
          </a>
        )}
      </div>
    </>
  );
}

/* ---------------- Contact: your turn at the microphone ---------------- */
function ContactPanel() {
  const [form, setForm] = useState({ name: "", email: "", message: "", extra_note: "" });
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("sent");
      setForm({ name: "", email: "", message: "", extra_note: "" });
    } catch {
      setStatus("error");
    }
  }

  const links = (
    <div className="chips">
      {profile.email && (
        <a className="chip" href={`mailto:${profile.email}`}>
          Email
        </a>
      )}
      {real(profile.github) && (
        <a className="chip" href={profile.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
      )}
      {real(profile.linkedin) && (
        <a className="chip" href={profile.linkedin} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
      )}
    </div>
  );

  if (status === "sent") {
    return (
      <>
        <h2>Thank you.</h2>
        <p role="status">{COPY.contact.thanks}</p>
        <div className="chips">
          <button type="button" className="chip fill" onClick={() => setStatus("idle")}>
            Send another
          </button>
        </div>
        {links}
      </>
    );
  }

  return (
    <>
      <h2>{COPY.contact.title}</h2>
      <p>{COPY.contact.note}</p>
      <form onSubmit={submit}>
        {/* Honeypot: hidden from people, bots fill it in */}
        <input
          type="text"
          name="extra_note"
          value={form.extra_note}
          onChange={set}
          className="hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        <label className="field">
          <span>Name</span>
          <input name="name" value={form.name} onChange={set} autoComplete="name" required />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" value={form.email} onChange={set} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Message</span>
          <textarea name="message" rows="3" value={form.message} onChange={set} required />
        </label>
        <div className="chips">
          <button type="submit" className="chip fill" disabled={status === "sending"}>
            {status === "sending" ? "Sending..." : "Send"}
          </button>
        </div>
        {status === "error" && (
          <p className="msg" role="alert">
            {COPY.contact.error}
          </p>
        )}
      </form>
      {links}
    </>
  );
}

/* ---------------- The show ---------------- */
export default function Show() {
  const reduced = useMemo(prefersReduced, []);
  const gl = useMemo(webglAvailable, []);
  const [sceneReady, setSceneReady] = useState(false); // the stage has been built: fade it in
  const [open, setOpen] = useState(false); // the curtain has been tapped
  const [instant, setInstant] = useState(false); // the visitor skipped the opening
  const [ready, setReady] = useState(false); // I have risen: the bubble can appear
  const [act, setAct] = useState(0);
  const [outfit, setOutfit] = useState("hello");
  const [blackout, setBlackout] = useState(false);
  const [category, setCategory] = useState(null); // Work: code | design | null (all)
  const [page, setPage] = useState(0); // Work: which page of posters, when there are many
  const [hover, setHover] = useState(null); // Work: the poster under the pointer
  const [openSlug, setOpenSlug] = useState(null); // the case study that is open
  const scrollRef = useRef(null);
  const progress = useRef(0);
  const pickRef = useRef(null); // the 3D scene fills this in: "which poster is at this point?"
  const pickFrame = useRef(0);

  const openCurtain = useCallback(() => setOpen(true), []);
  // Skip the opening: the curtain is open at once, and I am already on the stage
  const skipIntro = useCallback(() => {
    setInstant(true);
    setOpen(true);
  }, []);
  const onSceneReady = useCallback(() => {
    setTimeout(() => setSceneReady(true), 250);
  }, []);
  const closeCase = useCallback(() => {
    setOpenSlug(null);
    setHover(null);
  }, []);

  // The bubble appears once the curtain has opened and I have risen
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => setReady(true), reduced ? 0 : instant ? 500 : 3300);
    return () => clearTimeout(t);
  }, [open, reduced, instant]);

  // Scrolling moves the camera: tell the scene how far along the show we are
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const p = el.scrollTop / (el.clientHeight || 1);
        progress.current = p;
        const a = Math.round(p);
        setAct((cur) => (cur === a ? cur : a));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // A change of act is a quick change of costume, done in a blackout
  useEffect(() => {
    const want = OUTFITS[act] || "hello";
    if (want === outfit) {
      setBlackout(false);
      return undefined;
    }
    if (reduced) {
      setOutfit(want);
      return undefined;
    }
    setBlackout(true);
    const t1 = setTimeout(() => setOutfit(want), 280);
    const t2 = setTimeout(() => setBlackout(false), 620);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [act]);

  // Leaving Work: nothing is under the pointer any more
  useEffect(() => {
    if (act !== 1) setHover(null);
  }, [act]);

  const go = useCallback(
    (n) => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: n * el.clientHeight, behavior: reduced ? "auto" : "smooth" });
    },
    [reduced]
  );

  // How many pages of posters the wall needs for the side(s) now shown
  const sideCount = (c) => projects.filter((p) => p.category === c).length;
  const biggest = category ? sideCount(category) : Math.max(sideCount("code"), sideCount("design"));
  const pages = Math.max(1, Math.ceil(biggest / PER_PAGE));

  // The poster at a point of the screen, if it is not filtered out
  const posterAt = (x, y) => {
    const slug = pickRef.current ? pickRef.current(x, y) : null;
    if (!slug) return null;
    const p = projects.find((q) => q.slug === slug);
    if (!p || (category && p.category !== category)) return null;
    return slug;
  };

  // On the Work act, the posters on the wall can be pointed at and clicked
  const onStageMove = (e) => {
    if (act !== 1 || e.pointerType === "touch") return;
    if (e.target.closest(".workbar, .kbd-list, .cue")) return;
    const { clientX, clientY, currentTarget } = e;
    cancelAnimationFrame(pickFrame.current);
    pickFrame.current = requestAnimationFrame(() => {
      const slug = posterAt(clientX, clientY);
      setHover((h) => (h === slug ? h : slug));
      currentTarget.style.cursor = slug ? "pointer" : "";
    });
  };

  const onStageClick = (e) => {
    if (act !== 1 || e.target.closest(".workbar, .kbd-list, .cue, button, a")) return;
    const slug = posterAt(e.clientX, e.clientY);
    if (slug) setOpenSlug(slug);
  };

  // No 3D on this device: the words and the links are still all here
  if (!gl) {
    return (
      <div className="show-fallback">
        <h1>Khoo Xin Rui</h1>
        <p>Developer and designer. Information Technology student, Republic Polytechnic.</p>
        {COPY.hello.lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <p>
          {profile.email && <a href={`mailto:${profile.email}`}>Email</a>}
          {real(profile.github) && (
            <>
              {" · "}
              <a href={profile.github}>GitHub</a>
            </>
          )}
          {real(profile.linkedin) && (
            <>
              {" · "}
              <a href={profile.linkedin}>LinkedIn</a>
            </>
          )}
        </p>
      </div>
    );
  }

  const work = { category, hover, open: openSlug, pickRef, page, perPage: PER_PAGE };

  return (
    <div className="show">
      <h1 className="sr-only">Khoo Xin Rui, developer and designer</h1>

      <div className={sceneReady ? "show-canvas ready" : "show-canvas"} aria-hidden="true">
        <Suspense fallback={null}>
          <Scene
            open={open}
            progressRef={progress}
            outfit={outfit}
            blackout={blackout}
            reduced={reduced || instant}
            onOpen={openCurtain}
            onReady={onSceneReady}
            work={work}
          />
        </Suspense>
      </div>

      <header className={open ? "show-nav on" : "show-nav"}>
        <button type="button" className="brand" onClick={() => go(0)} aria-label="Khoo Xin Rui, back to the start">
          <Logo size={40} />
        </button>
        <span className="avail">{COPY.available}</span>
        <nav aria-label="Acts">
          {ACTS.map((a, i) => (
            <button
              key={a}
              type="button"
              className={act === i ? "on" : ""}
              aria-current={act === i ? "true" : undefined}
              onClick={() => go(i)}
            >
              {a}
            </button>
          ))}
        </nav>
      </header>

      {/* The first thing to read: one line that says what I do, centred on the closed curtain */}
      {sceneReady && (
        <p className={open ? "show-tagline gone" : "show-tagline"} aria-hidden={open}>
          {COPY.tagline[0]} <span>{COPY.tagline[1]}</span>
        </p>
      )}

      {!open && sceneReady && (
        <>
          <button type="button" className="show-prompt" onClick={openCurtain}>
            {COPY.prompt}
          </button>
          <button type="button" className="show-skip" onClick={skipIntro}>
            {COPY.skip}
          </button>
        </>
      )}

      <main
        ref={scrollRef}
        className={open ? "show-scroll on" : "show-scroll"}
        onPointerMove={onStageMove}
        onPointerLeave={() => setHover(null)}
        onClick={onStageClick}
      >
        {/* Act 1: Home */}
        <section className="act" aria-label="Home">
          <div className={ready ? "panel side tail in" : "panel side tail"}>
            <h2>{COPY.hello.title}</h2>
            {COPY.hello.lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
            <div className="chips">
              <button type="button" className="chip fill" onClick={() => go(1)}>
                See my work
              </button>
              <button type="button" className="chip" onClick={() => go(2)}>
                About me
              </button>
              <button type="button" className="chip" onClick={() => go(3)}>
                Contact me
              </button>
            </div>
          </div>
          {ready && (
            <button type="button" className="cue" onClick={() => go(1)}>
              Next: Work ↓
            </button>
          )}
        </section>

        {/* Act 2: Work. The posters on the wall are the way in; this bar only filters them. */}
        <section className="act" aria-label="Work">
          <div className={act === 1 ? "workbar in" : "workbar"}>
            <p>Click a poster to read the case study.</p>
            <div className="chips" role="group" aria-label="Show">
              {FILTERS.map(([id, label]) => {
                const n = id === "all" ? projects.length : projects.filter((p) => p.category === id).length;
                const on = (category || "all") === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={on ? "chip fill" : "chip"}
                    aria-pressed={on}
                    onClick={() => {
                      setCategory(id === "all" ? null : id);
                      setPage(0);
                    }}
                  >
                    {label} ({n})
                  </button>
                );
              })}
            </div>
            {pages > 1 && (
              <div className="pager" role="group" aria-label="Pages of projects">
                <button
                  type="button"
                  className="chip"
                  disabled={page === 0}
                  onClick={() => setPage((n) => Math.max(0, n - 1))}
                  aria-label="Previous page"
                >
                  ‹
                </button>
                <span>
                  Page {page + 1} of {pages}
                </span>
                <button
                  type="button"
                  className="chip"
                  disabled={page >= pages - 1}
                  onClick={() => setPage((n) => Math.min(pages - 1, n + 1))}
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {/* For keyboard users: all the posters can be reached with Tab too */}
          <ul className="kbd-list" aria-label="Projects">
            {projects.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  className="chip"
                  onClick={() => setOpenSlug(p.slug)}
                  onFocus={() => setHover(p.slug)}
                  onBlur={() => setHover(null)}
                >
                  {p.title}
                </button>
              </li>
            ))}
          </ul>

          <button type="button" className="cue" onClick={() => go(2)}>
            Next: About ↓
          </button>
        </section>

        {/* Act 3: About */}
        <section className="act" aria-label="About">
          <div className={act === 2 ? "panel side in" : "panel side"}>
            <AboutPanel />
          </div>
          <button type="button" className="cue" onClick={() => go(3)}>
            Next: Contact ↓
          </button>
        </section>

        {/* Act 4: Contact */}
        <section className="act" aria-label="Contact">
          <div className={act === 3 ? "panel side in" : "panel side"}>
            <ContactPanel />
          </div>
        </section>
      </main>

      {openSlug && <CaseStudy slug={openSlug} onClose={closeCase} onOpen={setOpenSlug} />}
    </div>
  );
}