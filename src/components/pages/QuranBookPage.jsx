import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { fetchQuranPage, stripBasmalaFromAyah } from "../../utils/reciterAudio.js";
import { sel } from "../../store.js";
import { computeDisplayedPartMastery, masteryColor } from "../common/Mastery.jsx";
import {
  MUSHAF_TOTAL_PAGES,
  OPEN_ANIM_DURATION_MS,
  computeCssBookLayout,
  computeCssBookPresentation,
  computeSpreadPages,
} from "../../utils/quranBookEngine.js";
import { withErrorRecovery, ERROR_CODES } from "../../utils/errorManager.js";

const MUSHAF_TOTAL = MUSHAF_TOTAL_PAGES;

export function QuranBookPage({ surahs }) {
  const navigate = useNavigate();
  const learnData = useSelector(sel.learnData) || {};
  const [spread, setSpread] = useState(0); // 0 = cover closed
  const [flipState, setFlipState] = useState("idle"); // 'idle'|'fwd'|'bwd'
  const [pageCache, setPageCache] = useState({});
  const [inputVal, setInputVal] = useState("1");
  const [bookOpen, setBookOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [sz, setSz] = useState(() =>
    computeCssBookLayout(
      typeof window !== "undefined" ? { vw: window.innerWidth, vh: window.innerHeight } : {}
    )
  );
  const [showSurahMenu, setShowSurahMenu] = useState(false);
  const [bookmark, setBookmark] = useState(() => {
    try {
      return parseInt(localStorage.getItem("quranbook_bm"), 10) || null;
    } catch {
      return null;
    }
  });

  const timersRef = useRef([]);
  const scheduleTimer = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  // Responsive single-page width (mobile-first bounds)
  useEffect(() => {
    const upd = () => {
      const nextLayout = computeCssBookLayout({
        vw: window.innerWidth,
        vh: window.innerHeight,
      });
      setSz(nextLayout);
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  const spreadPages = spread === 0 ? null : computeSpreadPages(spread, false);
  const rPage = spreadPages ? spreadPages.rPage : null;
  const lPage = spreadPages ? spreadPages.lPage : null;

  const loadPage = useCallback(
    async (n) => {
      if (!n || n < 1 || n > MUSHAF_TOTAL || pageCache[n] !== undefined) return;
      setPageCache((c) => ({ ...c, [n]: null }));
      const data = await withErrorRecovery(() => fetchQuranPage(n), [], {
        code: ERROR_CODES.NETWORK_ERROR,
        message: `Chargement page ${n} impossible`,
        context: { pageNum: n },
      });
      setPageCache((c) => ({ ...c, [n]: data || [] }));
    },
    [pageCache]
  );

  useEffect(() => {
    if (spread === 0 || !rPage) return;
    [rPage, lPage, rPage + 2, lPage + 2, rPage - 2, lPage - 2]
      .filter((p) => p && p >= 1 && p <= MUSHAF_TOTAL)
      .forEach(loadPage);
  }, [spread, rPage, lPage]);

  useEffect(() => {
    if (rPage) setInputVal(String(rPage));
  }, [rPage]);

  // Open book: lift cover from right side, then unfold left page smoothly as cover crosses spine
  const openBook = useCallback(() => {
    if (bookOpen) return;
    setBookOpen(true);
    setIsOpening(true);
    setSpread((s) => (s === 0 ? 1 : s));
    setFlipState("idle");
    scheduleTimer(() => setIsOpening(false), OPEN_ANIM_DURATION_MS);
  }, [bookOpen, scheduleTimer]);

  const closeBook = useCallback(() => {
    setFlipState("idle");
    setIsOpening(false);
    setBookOpen(false);
    scheduleTimer(() => setSpread(0), OPEN_ANIM_DURATION_MS);
  }, [scheduleTimer]);

  const goNext = useCallback(async () => {
    if (!bookOpen || flipState !== "idle" || !lPage || lPage >= MUSHAF_TOTAL) return;
    const np1 = rPage + 2;
    const np2 = lPage + 2;
    await Promise.all(
      [np1, np2]
        .filter((p) => p >= 1 && p <= MUSHAF_TOTAL && pageCache[p] === undefined)
        .map(async (p) => {
          setPageCache((c) => ({ ...c, [p]: null }));
          const d = await withErrorRecovery(() => fetchQuranPage(p), [], {
            code: ERROR_CODES.NETWORK_ERROR,
            context: { pageNum: p },
          });
          setPageCache((c) => ({ ...c, [p]: d || [] }));
        })
    );
    setFlipState("fwd");
    scheduleTimer(() => {
      setSpread((s) => s + 1);
      setFlipState("idle");
    }, 720);
  }, [bookOpen, flipState, lPage, rPage, pageCache, scheduleTimer]);

  const goPrev = useCallback(async () => {
    if (!bookOpen || flipState !== "idle" || spread <= 1) return;
    const pp1 = rPage - 2;
    const pp2 = lPage ? lPage - 2 : null;
    await Promise.all(
      [pp1, pp2]
        .filter((p) => p && p >= 1 && pageCache[p] === undefined)
        .map(async (p) => {
          setPageCache((c) => ({ ...c, [p]: null }));
          const d = await withErrorRecovery(() => fetchQuranPage(p), [], {
            code: ERROR_CODES.NETWORK_ERROR,
            context: { pageNum: p },
          });
          setPageCache((c) => ({ ...c, [p]: d || [] }));
        })
    );
    setFlipState("bwd");
    scheduleTimer(() => {
      setSpread((s) => Math.max(1, s - 1));
      setFlipState("idle");
    }, 720);
  }, [bookOpen, flipState, spread, rPage, lPage, pageCache, scheduleTimer]);

  const jumpTo = useCallback(
    (v) => {
      const p = Math.max(1, Math.min(MUSHAF_TOTAL, parseInt(v, 10) || 1));
      setSpread(Math.ceil(p / 2));
      if (!bookOpen) setBookOpen(true);
    },
    [bookOpen]
  );

  // Keyboard navigation
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") goNext();
      if (e.key === "ArrowRight") goPrev();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [goNext, goPrev]);

  const tx = useRef(0);

  const pageW = sz.pageWidth ?? 440;
  const pageH = sz.pageHeight ?? 560;
  const spineW = sz.spineWidth ?? Math.max(Math.round(pageW * 0.052), 20);
  const totalW = sz.totalWidth ?? pageW * 2 + spineW;

  const pres = computeCssBookPresentation({
    bookOpen,
    isOpening,
    spread,
    flipState,
    pageWidth: pageW,
    spineWidth: spineW,
  });

  // Page content renderer
  const PageContent = useCallback(
    ({ pageNum, side }) => {
      const ayahs = pageCache[pageNum];
      if (!pageNum) return null;
      if (ayahs === undefined || ayahs === null) {
        return <div className="qbook-loading-page">القرآن</div>;
      }

      const groups = [];
      (ayahs || []).forEach((a) => {
        const last = groups[groups.length - 1];
        if (!last || last.sn !== a.surah.number) {
          groups.push({
            sn: a.surah.number,
            name: a.surah.name,
            eng: a.surah.englishName,
            ayahs: [],
          });
        }
        groups[groups.length - 1].ayahs.push(a);
      });

      const fs = Math.max(Math.min(pageH / 20, pageW / 14, 16), 10);
      const pageHizb =
        ayahs?.[0]?.hizb ??
        (ayahs?.[0]?.hizbQuarter != null ? Math.ceil(ayahs[0].hizbQuarter / 4) : null);
      const pageMastery =
        ayahs?.length > 0
          ? computeDisplayedPartMastery(ayahs, learnData, ayahs[0]?.surah?.number || 1)
          : null;

      return (
        <div className={`qbook-page-content${side === "right" ? " qbook-page-content-right" : ""}`}>
          {groups.map((g, gi) => (
            <React.Fragment key={gi}>
              {g.ayahs[0]?.numberInSurah === 1 && (
                <>
                  <div className="qbook-surah-header">
                    {g.eng.toUpperCase()}
                    <span
                      style={{
                        fontFamily: "'Amiri Quran',serif",
                        fontSize: "1.3em",
                        margin: "0 5px",
                      }}
                    >
                      {g.name}
                    </span>
                  </div>
                  {g.sn !== 1 && g.sn !== 9 && (
                    <div className="qbook-basmala" style={{ fontSize: fs + 1 }}>
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                    </div>
                  )}
                </>
              )}
              <div className="qbook-ayah-text" style={{ fontSize: fs }}>
                {g.ayahs.map((a) => (
                  <React.Fragment key={a.numberInSurah}>
                    {stripBasmalaFromAyah(a.text, g.sn, a.numberInSurah)}
                    <span className="qbook-ayah-num">﴿{a.numberInSurah}﴾</span>{" "}
                  </React.Fragment>
                ))}
              </div>
            </React.Fragment>
          ))}
          <div className="qbook-page-num">
            {pageNum}
            {pageHizb ? ` · Hizb ${pageHizb}` : ""}
            {pageMastery && (
              <span
                style={{
                  marginLeft: 6,
                  color: masteryColor(pageMastery.masteryPct),
                  fontWeight: 700,
                }}
              >
                · {pageMastery.masteryPct}% ({pageMastery.learnedCount}/{pageMastery.totalCount})
              </span>
            )}
          </div>
        </div>
      );
    },
    [pageCache, pageW, pageH, learnData]
  );

  return (
    <div className="qbook-wrapper">
      {/* ── Top bar ── */}
      <div className="qbook-topbar" style={{ maxWidth: totalW + 60 }}>
        <button
          onClick={() => navigate("/quran")}
          style={{
            fontSize: 8,
            letterSpacing: 1.5,
            padding: "4px 12px",
            fontFamily: "'Cinzel',serif",
            background: "transparent",
            border: "1px solid rgba(201,168,76,.25)",
            color: "rgba(201,168,76,.55)",
            borderRadius: 6,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ← SOURATES
        </button>

        {/* Surah picker */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setShowSurahMenu((v) => !v)}
            style={{
              fontSize: 8,
              letterSpacing: 1.2,
              padding: "4px 10px",
              fontFamily: "'Cinzel',serif",
              background: "rgba(201,168,76,.07)",
              border: "1px solid rgba(201,168,76,.22)",
              color: "rgba(201,168,76,.6)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            SOURATE ▾
          </button>
          {showSurahMenu && (
            <div
              style={{
                position: "absolute",
                top: "115%",
                left: 0,
                zIndex: 300,
                minWidth: 240,
                background: "#120701",
                border: "1px solid rgba(201,168,76,.2)",
                borderRadius: 8,
                maxHeight: 260,
                overflowY: "auto",
                boxShadow: "0 10px 40px rgba(0,0,0,.85)",
              }}
            >
              {(surahs || []).map((s) => (
                <div
                  key={s.number}
                  onClick={() => {
                    jumpTo(s.startPage || s.number * 2 - 1);
                    setShowSurahMenu(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(201,168,76,.05)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(201,168,76,.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ fontSize: 8, color: "rgba(201,168,76,.4)", minWidth: 20 }}>
                    {s.number}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Amiri Quran',serif",
                      fontSize: 14,
                      color: "#c9a84c",
                      direction: "rtl",
                    }}
                  >
                    {s.name}
                  </span>
                  <span style={{ fontSize: 7, color: "rgba(201,168,76,.35)", marginLeft: "auto" }}>
                    {s.englishName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            fontFamily: "'Amiri Quran',serif",
            fontSize: Math.max(pageW * 0.044, 16),
            color: "rgba(201,168,76,.48)",
            direction: "rtl",
            textAlign: "center",
            flex: 1,
            textShadow: "0 0 16px rgba(201,168,76,.2)",
          }}
        >
          القرآن الكريم
        </div>

        {/* Bookmark */}
        <button
          onClick={() => {
            setBookmark(rPage);
            if (rPage) localStorage.setItem("quranbook_bm", String(rPage));
          }}
          style={{
            fontSize: 14,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            color: bookmark === rPage ? "#c0392b" : "rgba(201,168,76,.32)",
          }}
        >
          🔖
        </button>
        {bookmark && rPage && bookmark !== rPage && (
          <button
            onClick={() => jumpTo(bookmark)}
            style={{
              fontSize: 8,
              letterSpacing: 1,
              padding: "4px 8px",
              fontFamily: "'Cinzel',serif",
              background: "rgba(192,57,43,.14)",
              border: "1px solid rgba(192,57,43,.28)",
              color: "rgba(220,100,80,.7)",
              borderRadius: 6,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            p.{bookmark}
          </button>
        )}

        {/* Page input */}
        {bookOpen && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 7, color: "rgba(201,168,76,.4)", fontFamily: "'Cinzel',serif" }}>
              P.
            </span>
            <input
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && jumpTo(inputVal)}
              onBlur={() => jumpTo(inputVal)}
              style={{
                width: 44,
                textAlign: "center",
                background: "transparent",
                border: "1px solid rgba(201,168,76,.22)",
                borderRadius: 6,
                padding: "3px 5px",
                color: "var(--gold)",
                fontSize: 12,
                fontFamily: "'Cinzel',serif",
                outline: "none",
              }}
            />
            <span style={{ fontSize: 7, color: "rgba(201,168,76,.25)", fontFamily: "'Cinzel',serif" }}>
              /604
            </span>
          </div>
        )}
      </div>

      {/* ── Book scene ── */}
      <div
        className="qbook-scene"
        onTouchStart={(e) => {
          tx.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - tx.current;
          if (dx < -55) goNext();
          if (dx > 55) goPrev();
        }}
      >
        {/* Ambient glow under book */}
        <div
          style={{
            position: "absolute",
            bottom: "8%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "55%",
            height: 30,
            pointerEvents: "none",
            background: "radial-gradient(ellipse,rgba(180,110,20,.16) 0%,transparent 70%)",
          }}
        />

        {/* ── THE BOOK (never use CSS `filter` here — `filter` flattens `preserve-3d`) ── */}
        <div
          data-testid="qbook-root"
          data-open={bookOpen ? "true" : "false"}
          data-opening={pres.isOpening ? "true" : "false"}
          onClick={!bookOpen ? openBook : undefined}
          role={!bookOpen ? "button" : undefined}
          tabIndex={!bookOpen ? 0 : undefined}
          aria-label={!bookOpen ? "Ouvrir le Saint Coran" : undefined}
          onKeyDown={
            !bookOpen
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openBook();
                  }
                }
              : undefined
          }
          style={{
            position: "relative",
            width: totalW,
            height: pageH,
            transformStyle: "preserve-3d",
            transition: "transform .82s cubic-bezier(.645,.045,.355,1)",
            transform: `translateX(${pres.bookTranslateX}px) rotateX(4deg)`,
            cursor: !bookOpen ? "pointer" : "default",
          }}
        >
          {/* ── HARDCOVER BACK (unfolds with left page once cover crosses spine) ── */}
          {pres.showLeftHalf && (
            <ul
              data-testid="qbook-hc-back"
              className={pres.leftWingClassName}
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                position: "absolute",
                top: 0,
                left: 0,
                width: pageW,
                height: pageH,
                transformStyle: "preserve-3d",
                transformOrigin: "right center",
                zIndex: 0,
              }}
            >
              <li
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  borderRadius: "3px 0 0 3px",
                  background: "linear-gradient(135deg,#200800,#4a1508,#200800)",
                  boxShadow: "-6px 14px 36px rgba(0,0,0,.75),inset 4px 0 10px rgba(0,0,0,.3)",
                }}
              />
              <li
                style={{
                  position: "absolute",
                  top: 4,
                  right: -spineW * 0.35,
                  width: spineW * 0.35,
                  height: "calc(100% - 8px)",
                  background: "linear-gradient(to right,#1a0500,#0e0200)",
                  borderRadius: "0 2px 2px 0",
                }}
              />
            </ul>
          )}

          {/* ── STACKED PAGES (right half only when closed, expands left smoothly as cover opens) ── */}
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              position: "absolute",
              top: 3,
              left: pres.stackLeftOffset,
              width: pres.stackWidth,
              height: pageH - 6,
              transformStyle: "preserve-3d",
              zIndex: 1,
              transition: pres.isOpening
                ? "left .42s cubic-bezier(.25,.8,.25,1) .39s, width .42s cubic-bezier(.25,.8,.25,1) .39s"
                : "none",
            }}
          >
            {[0, 1, 2, 3, 4].map((k) => (
              <li
                key={k}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  borderRadius: "0 2px 2px 0",
                  background: ["#ede1bb", "#f0e4c0", "#f3e7c6", "#f6eacc", "#f9edd2"][k],
                  transform: `translateX(${-k}px)`,
                }}
              />
            ))}
          </ul>

          {/* ── LEFT PAGE (even) — strictly hidden while closed, unfolds from spine during opening ── */}
          {pres.showLeftHalf && (
            <div
              data-testid="qbook-left-page"
              className={pres.leftWingClassName}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: pageW,
                height: pageH,
                zIndex: 2,
                overflow: "hidden",
                transformOrigin: "right center",
                background: "linear-gradient(160deg,#fef9ee,#fdf3d8,#faecc0)",
                borderRadius: "2px 0 0 2px",
                boxShadow: "inset 8px 0 20px rgba(0,0,0,.08), -4px 12px 28px rgba(0,0,0,.6)",
              }}
            >
              {pres.showLeftPageContent && (
                <PageContent pageNum={pres.isFwd ? lPage + 2 : lPage} side="left" />
              )}
            </div>
          )}

          {/* ── RIGHT PAGE (odd) — covered by front cover until opened ── */}
          <div
            data-testid="qbook-right-page"
            style={{
              position: "absolute",
              top: 0,
              left: pageW + spineW,
              width: pageW,
              height: pageH,
              zIndex: 2,
              overflow: "hidden",
              background: "linear-gradient(160deg,#fef9ee,#fdf3d8,#faecc0)",
              borderRadius: "0 2px 2px 0",
              boxShadow: "inset -8px 0 20px rgba(0,0,0,.08), 6px 12px 28px rgba(0,0,0,.65)",
            }}
          >
            {bookOpen && <PageContent pageNum={pres.isBwd ? rPage - 2 : rPage} side="right" />}
          </div>

          {/* ── SPINE ── */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: pageW,
              width: spineW,
              height: pageH,
              zIndex: 20,
              background:
                "linear-gradient(to right,#0a0200 0%,#3a1204 18%,#8a3810 34%,#d08c38 50%,#8a3810 66%,#3a1204 82%,#0a0200 100%)",
              boxShadow: "0 8px 24px rgba(0,0,0,.75),inset 0 0 6px rgba(255,195,70,.08)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "repeating-linear-gradient(to bottom,transparent 0,transparent 20px,rgba(255,190,60,.07) 20px,rgba(255,190,60,.07) 21px)",
              }}
            />
          </div>

          {/* ── FLIPPING PAGE ── */}
          {pres.isFlip && (
            <div
              data-testid="qbook-flipping-page"
              className={`qbook-page${pres.isFwd ? " qbook-flip-fwd" : " qbook-flip-bwd"}`}
              style={{
                position: "absolute",
                top: 0,
                left: pres.flipConfig.left,
                width: pageW,
                height: pageH,
                transformOrigin: pres.flipConfig.transformOrigin,
                transformStyle: "preserve-3d",
                zIndex: 200,
              }}
            >
              {/* front face */}
              <div className="qbook-page-face">
                <PageContent pageNum={pres.isFwd ? lPage : rPage} side={pres.isFwd ? "left" : "right"} />
              </div>
              {/* back face */}
              <div className="qbook-page-face qbook-page-face-back">
                <PageContent
                  pageNum={pres.isFwd ? rPage + 2 : lPage - 2}
                  side={pres.isFwd ? "right" : "left"}
                />
              </div>
            </div>
          )}

          {/* ── HARDCOVER FRONT (flips away & hides completely once open; clickable anywhere while closed) ── */}
          <ul
            data-testid="qbook-hc-front"
            className={`qbook-hc-front${bookOpen ? " qbook-open" : ""}`}
            aria-hidden={bookOpen ? "true" : "false"}
            onClick={!bookOpen ? openBook : undefined}
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              position: "absolute",
              top: 0,
              left: pageW + spineW,
              width: pageW,
              height: pageH,
              transformStyle: "preserve-3d",
              transformOrigin: "left center",
              transform: pres.frontCover.transform,
              zIndex: pres.frontCover.zIndex,
              opacity: pres.frontCover.hidden ? 0 : 1,
              visibility: pres.frontCover.hidden ? "hidden" : "visible",
              pointerEvents: pres.frontCover.pointerEvents,
              cursor: pres.frontCover.cursor,
              transition: bookOpen
                ? "transform .82s cubic-bezier(.645,.045,.355,1), opacity .26s ease .52s, visibility 0s linear .78s"
                : "transform .82s cubic-bezier(.645,.045,.355,1), opacity .15s ease 0s, visibility 0s linear 0s",
            }}
          >
            {/* front face */}
            <li
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backfaceVisibility: "hidden",
                borderRadius: "0 3px 3px 0",
                overflow: "hidden",
                background:
                  "linear-gradient(135deg,#280b01 0%,#561c05 30%,#8b3210 50%,#561c05 70%,#280b01 100%)",
                boxShadow:
                  "inset -8px 0 24px rgba(0,0,0,.45),inset 0 0 40px rgba(0,0,0,.28), 0 18px 44px rgba(0,0,0,.78)",
              }}
            >
              <div className="qbook-cover-design">
                <div className="qbook-medallion">☽</div>
                <div className="qbook-cover-title">القرآن الكريم</div>
                <div className="qbook-cover-sub">THE NOBLE QURAN</div>
                {!bookOpen && (
                  <button
                    className="qbook-open-btn"
                    style={{ marginTop: 16 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openBook();
                    }}
                  >
                    OUVRIR LE LIVRE
                  </button>
                )}
              </div>
            </li>
            {/* back face (inside of front cover) */}
            <li
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                borderRadius: "0 3px 3px 0",
                overflow: "hidden",
                background: "linear-gradient(to right,#1c0601,#3a1008)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "'Amiri Quran',serif",
                  fontSize: "1.8em",
                  color: "rgba(201,168,76,.22)",
                  direction: "rtl",
                }}
              >
                ﷽
              </div>
            </li>
          </ul>

          {/* ── Click zones (when open) ── */}
          {bookOpen && !pres.isFlip && (
            <>
              <div
                className="qbook-click qbook-click-left"
                style={{
                  left: 0,
                  width: pageW * 0.46,
                  height: pageH,
                  position: "absolute",
                  top: 0,
                  zIndex: 250,
                  cursor: "pointer",
                }}
                onClick={goNext}
                title="Suivant (←)"
              />
              <div
                className="qbook-click qbook-click-right"
                style={{
                  left: pageW + spineW + pageW * 0.54,
                  width: pageW * 0.46,
                  height: pageH,
                  position: "absolute",
                  top: 0,
                  zIndex: 250,
                  cursor: "pointer",
                }}
                onClick={goPrev}
                title="Précédent (→)"
              />
            </>
          )}

          {/* ── Top & bottom hardcover boards (right half when closed, unfolds smoothly to full spread) ── */}
          <div
            style={{
              position: "absolute",
              top: -5,
              left: pres.boardLeftOffset,
              right: 0,
              height: 6,
              background: "linear-gradient(to bottom,#1e0602,#5a1a08)",
              borderRadius: "2px 2px 0 0",
              boxShadow: "0 -2px 8px rgba(0,0,0,.5)",
              transition: pres.isOpening ? "left .42s cubic-bezier(.25,.8,.25,1) .39s" : "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -5,
              left: pres.boardLeftOffset,
              right: 0,
              height: 6,
              background: "linear-gradient(to top,#1e0602,#5a1a08)",
              borderRadius: "0 0 2px 2px",
              boxShadow: "0 2px 8px rgba(0,0,0,.5)",
              transition: pres.isOpening ? "left .42s cubic-bezier(.25,.8,.25,1) .39s" : "none",
            }}
          />
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <div className="qbook-botnav">
        {bookOpen ? (
          <>
            <button
              className="qbook-navbtn"
              onClick={goPrev}
              disabled={spread <= 1 || pres.isFlip}
            >
              → PRÉC.
            </button>

            <div style={{ textAlign: "center", minWidth: 80 }}>
              <div className="qbook-navlabel">
                {rPage}
                {lPage && lPage <= MUSHAF_TOTAL ? "–" + lPage : ""}
              </div>
              <div className="qbook-progress">
                <div
                  className="qbook-progress-bar"
                  style={{ width: `${rPage ? (rPage / MUSHAF_TOTAL) * 100 : 0}%` }}
                />
              </div>
            </div>

            <button
              className="qbook-navbtn"
              onClick={goNext}
              disabled={!lPage || lPage >= MUSHAF_TOTAL || pres.isFlip}
            >
              SUIV. ←
            </button>

            <button
              className="qbook-navbtn"
              onClick={closeBook}
              style={{ fontSize: 8, padding: "5px 12px", opacity: 0.6 }}
            >
              ✕ FERMER
            </button>
          </>
        ) : (
          <button className="qbook-navbtn" onClick={openBook}>
            📖 OUVRIR LE LIVRE
          </button>
        )}
      </div>
    </div>
  );
}


// ─── QuranBook3DPage ─────────────────────────────────────────────────────────
// Architecture: single WebGL canvas for all rendering.
// Each page spread is drawn as a WebGL texture (parchment + text composited
// on an offscreen 2D canvas) then mapped through the curl shader.
// No separate 2D overlay — everything in one GL canvas.

