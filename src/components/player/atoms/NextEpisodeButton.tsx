import classNames from "classnames";
import { debounce, throttle } from "lodash";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { isExtensionActiveCached } from "@/backend/extension/messaging";
import { Icon, Icons } from "@/components/Icon";
import { usePlayerMeta } from "@/components/player/hooks/usePlayerMeta";
import { Transition } from "@/components/utils/Transition";
import { conf } from "@/setup/config";
import { useAuthStore } from "@/stores/auth";
import { PlayerMeta } from "@/stores/player/slices/source";
import { usePlayerStore } from "@/stores/player/store";
import { usePreferencesStore } from "@/stores/preferences";
import { useProgressStore } from "@/stores/progress";

function shouldShowNextEpisodeButton(
  time: number,
  duration: number,
): "always" | "hover" | "none" {
  const percentage = time / duration;
  const secondsFromEnd = duration - time;
  if (secondsFromEnd <= 30) return "always";
  if (percentage >= 0.9) return "hover";
  return "none";
}

function Button(props: {
  className: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={classNames(
        "font-bold rounded h-10 w-40 scale-95 hover:scale-100 transition-all duration-200",
        props.className,
      )}
      type="button"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function NextEpisodeButton(props: {
  controlsShowing: boolean;
  onChange?: (meta: PlayerMeta) => void;
}) {
  const { t } = useTranslation();
  const duration = usePlayerStore((s) => s.progress.duration);
  const isHidden = usePlayerStore((s) => s.interface.hideNextEpisodeBtn);
  const meta = usePlayerStore((s) => s.meta);
  const { setDirectMeta } = usePlayerMeta();
  const hideNextEpisodeButton = usePlayerStore((s) => s.hideNextEpisodeButton);
  const metaType = usePlayerStore((s) => s.meta?.type);
  const time = usePlayerStore((s) => s.progress.time);
  const showingState = shouldShowNextEpisodeButton(time, duration);
  const status = usePlayerStore((s) => s.status);
  const setShouldStartFromBeginning = usePlayerStore(
    (s) => s.setShouldStartFromBeginning,
  );
  const updateItem = useProgressStore((s) => s.updateItem);
  const enableAutoplay = usePreferencesStore((s) => s.enableAutoplay);

  let show = false;
  if (showingState === "always") show = true;
  else if (showingState === "hover" && props.controlsShowing) show = true;
  if (isHidden || status !== "playing" || duration === 0) show = false;

  const animation = showingState === "hover" ? "slide-up" : "fade";
  let bottom = "bottom-[calc(6rem+env(safe-area-inset-bottom))]";
  if (showingState === "always")
    bottom = props.controlsShowing
      ? bottom
      : "bottom-[calc(3rem+env(safe-area-inset-bottom))]";

  const nextEp = meta?.episodes?.find(
    (v) => v.number === (meta?.episode?.number ?? 0) + 1,
  );

  const loadNextEpisode = useCallback(() => {
    if (!meta || !nextEp) return;
    const metaCopy = { ...meta };
    metaCopy.episode = nextEp;
    setShouldStartFromBeginning(true);
    setDirectMeta(metaCopy);
    props.onChange?.(metaCopy);
    const defaultProgress = { duration: 0, watched: 0 };
    updateItem({
      meta: metaCopy,
      progress: defaultProgress,
    });
  }, [
    setDirectMeta,
    nextEp,
    meta,
    props,
    setShouldStartFromBeginning,
    updateItem,
  ]);

  useEffect(() => {
    if (!enableAutoplay || !meta || !nextEp || metaType !== "show") return;
    const halfPercent = duration / 100;
    const isEnding = time >= duration - halfPercent && duration !== 0;

    const debouncedLoadNextEpisode = throttle(debounce(loadNextEpisode), 300);
    const allowAutoplay = Boolean(
      conf().ALLOW_AUTOPLAY ||
        isExtensionActiveCached() ||
        useAuthStore.getState().proxySet,
    );

    if (isEnding && allowAutoplay) debouncedLoadNextEpisode();

    return () => {
      debouncedLoadNextEpisode.cancel();
    };
  }, [duration, enableAutoplay, loadNextEpisode, meta, metaType, nextEp, time]);

  if (!meta?.episode || !nextEp) return null;
  if (metaType !== "show") return null;

  return (
    <Transition
      animation={animation}
      show={show}
      className="absolute right-[calc(3rem+env(safe-area-inset-right))] bottom-0"
    >
      <div
        className={classNames([
          "absolute bottom-0 right-0 transition-[bottom] duration-200 flex items-center space-x-3",
          bottom,
        ])}
      >
        <Button
          className="py-px box-content bg-buttons-secondary hover:bg-buttons-secondaryHover bg-opacity-90 text-buttons-secondaryText"
          onClick={hideNextEpisodeButton}
        >
          {t("player.nextEpisode.cancel")}
        </Button>
        <Button
          onClick={() => loadNextEpisode()}
          className="bg-buttons-primary hover:bg-buttons-primaryHover text-buttons-primaryText flex justify-center items-center"
        >
          <Icon className="text-xl mr-1" icon={Icons.SKIP_EPISODE} />
          {t("player.nextEpisode.next")}
        </Button>
      </div>
    </Transition>
  );
}
