import React, { useState } from "react";
import { View, Text, FlatList, Share, useWindowDimensions } from "./Theme";
import { LessonVideo } from "./LessonVideo";
import { FeatureButton } from "./FeatureWorkflows";
import { contentLink } from "./content-links";
import { VideoSocial } from "./CommunityFeatures";
import { Entry } from "./domain";
import { ReelAd } from "./Ads";
export function TalentFeed({
  entries,
  userId,
  moderator,
}: {
  entries: Entry[];
  userId?: string;
  moderator: boolean;
}) {
  const [active, setActive] = useState(0),
    [discussion, setDiscussion] = useState<string | null>(null);
  const { height } = useWindowDimensions(),
    pageHeight = Math.max(450, height - 220);
  const videos = entries.filter(
    (e) =>
      e.kind === "reel" &&
      e.video_format === "talent" &&
      e.status === "approved",
  );
  if (!videos.length)
    return <Text>No talent videos yet. Share yours to start the feed.</Text>;
  if (discussion)
    return (
      <View style={{ gap: 12 }}>
        <FeatureButton
          label="Back to talent feed"
          onPress={() => setDiscussion(null)}
        />
        <VideoSocial
          entryId={discussion}
          userId={userId}
          moderator={moderator}
        />
      </View>
    );
  return (
    <View>
      <View style={{ height: pageHeight }}>
        <FlatList
          data={videos}
          keyExtractor={(e) => e.id}
          pagingEnabled
          snapToInterval={pageHeight}
          decelerationRate="fast"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          onMomentumScrollEnd={(e) =>
            setActive(Math.round(e.nativeEvent.contentOffset.y / pageHeight))
          }
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          renderItem={({ item, index }) => (
            <View
              style={{
                height: pageHeight,
                backgroundColor: "#101b18",
                padding: 8,
                gap: 8,
              }}
            >
              <View style={{ flex: 1, overflow: "hidden" }}>
                {item.file_path && (
                  <LessonVideo
                    path={item.file_path}
                    entryId={item.id}
                    userId={userId}
                    active={index === active}
                    vertical
                    watermark={`Education Forum · ${item.author}`}
                  />
                )}
              </View>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
                {item.title}
              </Text>
              <Text style={{ color: "white" }}>
                Swipe up for the next video · Use video controls to unmute
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <FeatureButton
                  label="Share video"
                  onPress={() =>
                    void Share.share({
                      message: `${item.title} ${contentLink("video", item.id)}`,
                      url: contentLink("video", item.id),
                    })
                  }
                />
                <FeatureButton
                  label="Comments and likes"
                  onPress={() => setDiscussion(item.id)}
                />
              </View>
            </View>
          )}
        />
      </View>
      <ReelAd />
    </View>
  );
}
