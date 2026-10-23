import React, { useEffect, useState } from "react";
import { View, Text, AppState } from "./Theme";
import { useVideoPlayer, VideoView } from "expo-video";
import { useContentUsage } from "./useContentUsage";
import { backend } from "./backend";

function Player({
  url,
  entryId,
  userId,
  active = false,
  vertical = false,
  watermark = "Education Forum",
}: {
  url: string;
  entryId?: string;
  userId?: string;
  active?: boolean;
  vertical?: boolean;
  watermark?: string;
}) {
  const [playing, setPlaying] = useState(false);
  useContentUsage(entryId, userId, playing);
  const [error, setError] = useState("");
  const player = useVideoPlayer(url);
  useEffect(() => {
    if (vertical) {
      player.loop = true;
      player.muted = true;
      if (active) player.play();
      else player.pause();
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") player.pause();
      else if (vertical && active) player.play();
    });
    return () => {
      sub.remove();
      player.pause();
    };
  }, [player, active, vertical]);
  useEffect(() => {
    const playback = player.addListener("playingChange", (event) =>
      setPlaying(event.isPlaying),
    );
    const sub = player.addListener("statusChange", (event) => {
      if (event.status === "error")
        setError("This video could not play. Reopen it to retry.");
    });
    return () => {
      sub.remove();
      playback.remove();
    };
  }, [player]);
  return (
    <View style={{ gap: 12 }}>
      <VideoView
        player={player}
        style={{
          width: "100%",
          aspectRatio: vertical ? 9 / 14 : 16 / 9,
          backgroundColor: "#000",
        }}
        nativeControls
        fullscreenOptions={{ enable: false }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: 12,
          top: 12,
          backgroundColor: "#0009",
          padding: 7,
          borderRadius: 6,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>
          {watermark}
        </Text>
        <Text style={{ color: "white", fontSize: 10 }}>Powered by Xenus</Text>
      </View>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
    </View>
  );
}
export function LessonVideo({
  path,
  userId,
  entryId,
  active,
  vertical,
  watermark,
}: {
  entryId?: string;
  path: string;
  userId?: string;
  active?: boolean;
  vertical?: boolean;
  watermark?: string;
}) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("Loading video…");
  useEffect(() => {
    let active = true;
    setUrl("");
    setMessage("Loading video…");
    if (!backend) {
      setUrl(path);
      return;
    }
    if (!userId) {
      setMessage("Sign in to watch this lesson.");
      return;
    }
    backend.storage
      .from("submissions")
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (active) {
          if (error)
            setMessage("Could not load video. Reopen the lesson to retry.");
          else setUrl(data.signedUrl);
        }
      });
    return () => {
      active = false;
    };
  }, [path, userId]);
  return url ? (
    <Player
      key={url}
      url={url}
      entryId={entryId}
      userId={userId}
      active={active}
      vertical={vertical}
      watermark={watermark}
    />
  ) : (
    <Text accessibilityRole="alert">{message}</Text>
  );
}
