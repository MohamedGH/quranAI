import { useContext, useEffect, useState } from "react";
import { ReactReduxContext } from "react-redux";
import { sel } from "../store.js";
import {
  DEFAULT_PLAYBACK_RATE,
  applyAudioPlaybackRate,
  clampPlaybackRate,
} from "../utils/safeAudioPlayer.js";
import { safeGetItem } from "../utils/safeStorage.js";

/**
 * Subscribes safely to Redux `sel.playbackRate` (falling back to localStorage
 * if rendered standalone without a Redux Provider) and keeps `audioRef.current`
 * synchronized across rate changes, loadedmetadata, and play events.
 *
 * @param {React.MutableRefObject<HTMLAudioElement|null>|null} [audioRef]
 * @returns {number} Active playback rate in [0.5, 2.0]
 */
export function useSyncedAudioPlaybackRate(audioRef = null) {
  const reduxCtx = useContext(ReactReduxContext);
  const store = reduxCtx?.store || null;

  const [rate, setRate] = useState(() => {
    if (store) {
      return clampPlaybackRate(sel.playbackRate(store.getState()));
    }
    return clampPlaybackRate(safeGetItem("quran_playbackRate", DEFAULT_PLAYBACK_RATE));
  });

  useEffect(() => {
    if (!store) return;
    const syncFromStore = () => {
      const next = clampPlaybackRate(sel.playbackRate(store.getState()));
      setRate((prev) => (prev === next ? prev : next));
    };
    syncFromStore();
    return store.subscribe(syncFromStore);
  }, [store]);

  useEffect(() => {
    const el = audioRef?.current;
    if (!el) return;
    applyAudioPlaybackRate(el, rate);

    const handleReapply = () => applyAudioPlaybackRate(el, rate);
    el.addEventListener("loadedmetadata", handleReapply);
    el.addEventListener("play", handleReapply);
    return () => {
      el.removeEventListener("loadedmetadata", handleReapply);
      el.removeEventListener("play", handleReapply);
    };
  }, [audioRef, rate]);

  return rate;
}
