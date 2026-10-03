import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { backend } from "./backend";

function Player({ url }: { url: string }) {
  const [error, setError] = useState("");
  const player = useVideoPlayer(url);
  useEffect(() => {
    const sub = player.addListener("statusChange", (event) => {
      if (event.status === "error")
        setError("This video could not play. Reopen it to retry.");
    });
    return () => sub.remove();
  }, [player]);
  return (
    <View style={{ gap: 12 }}>
      <VideoView
        player={player}
        style={{ width: "100%", aspectRatio: 16 / 9 }}
        nativeControls
      />
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
    </View>
  );
}
export function LessonVideo({
  path,
  userId,
}: {
  path: string;
  userId?: string;
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
    <Player url={url} />
  ) : (
    <Text accessibilityRole="alert">{message}</Text>
  );
}
