import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { ListingVideoProps } from "./types";
import { SECTIONS } from "./utils/timing";
import { COLORS } from "./utils/theme";
import { SECTION_TRANSITIONS } from "./utils/transitions";
import { TopTicker } from "./components/TopTicker";
import { BottomTicker } from "./components/BottomTicker";
import { Watermark } from "./components/Watermark";
import { SectionTransition } from "./components/SectionTransition";
import { IntroHook } from "./sections/IntroHook";
import { PhotoShowcase } from "./sections/PhotoShowcase";
import { VideoWalkthrough } from "./sections/VideoWalkthrough";
import { DetailsCard } from "./sections/DetailsCard";
import { SellerCTA } from "./sections/SellerCTA";
import { EndCard } from "./sections/EndCard";

const FADE_FRAMES = 8;

export const ListingVideo: React.FC<ListingVideoProps> = (props) => {
  // Use dynamic timings if available, fall back to static SECTIONS
  const t = props.sectionTimings || SECTIONS;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.forest }}>
      {/* Voiceover audio — plays full duration */}
      {props.voiceoverAudioUrl && (
        <Audio src={staticFile(`audio/${props.voiceoverAudioUrl}`)} volume={0.85} />
      )}

      {/* 1. Intro Hook */}
      <Sequence
        from={t.introHook.from}
        durationInFrames={t.introHook.duration + FADE_FRAMES}
      >
        <SectionTransition
          durationInFrames={t.introHook.duration + FADE_FRAMES}
          enterTransition={SECTION_TRANSITIONS.introHook.enter}
          exitTransition={SECTION_TRANSITIONS.introHook.exit}
        >
          <IntroHook {...props} />
        </SectionTransition>
      </Sequence>

      {/* 2. Photo Showcase */}
      <Sequence
        from={t.photoShowcase.from}
        durationInFrames={t.photoShowcase.duration + FADE_FRAMES}
      >
        <SectionTransition
          durationInFrames={t.photoShowcase.duration + FADE_FRAMES}
          enterTransition={SECTION_TRANSITIONS.photoShowcase.enter}
          exitTransition={SECTION_TRANSITIONS.photoShowcase.exit}
        >
          <PhotoShowcase {...props} />
        </SectionTransition>
      </Sequence>

      {/* 3. Video Walkthrough */}
      <Sequence
        from={t.videoWalkthrough.from}
        durationInFrames={t.videoWalkthrough.duration + FADE_FRAMES}
      >
        <SectionTransition
          durationInFrames={t.videoWalkthrough.duration + FADE_FRAMES}
          enterTransition={SECTION_TRANSITIONS.videoWalkthrough.enter}
          exitTransition={SECTION_TRANSITIONS.videoWalkthrough.exit}
        >
          <VideoWalkthrough {...props} />
        </SectionTransition>
      </Sequence>

      {/* 4. Details Card */}
      <Sequence
        from={t.detailsCard.from}
        durationInFrames={t.detailsCard.duration + FADE_FRAMES}
      >
        <SectionTransition
          durationInFrames={t.detailsCard.duration + FADE_FRAMES}
          enterTransition={SECTION_TRANSITIONS.detailsCard.enter}
          exitTransition={SECTION_TRANSITIONS.detailsCard.exit}
        >
          <DetailsCard {...props} />
        </SectionTransition>
      </Sequence>

      {/* 5. Seller CTA */}
      <Sequence
        from={t.sellerCTA.from}
        durationInFrames={t.sellerCTA.duration + FADE_FRAMES}
      >
        <SectionTransition
          durationInFrames={t.sellerCTA.duration + FADE_FRAMES}
          enterTransition={SECTION_TRANSITIONS.sellerCTA.enter}
          exitTransition={SECTION_TRANSITIONS.sellerCTA.exit}
        >
          <SellerCTA {...props} />
        </SectionTransition>
      </Sequence>

      {/* 6. End Card */}
      <Sequence
        from={t.endCard.from}
        durationInFrames={t.endCard.duration}
      >
        <SectionTransition
          durationInFrames={t.endCard.duration}
          enterTransition={SECTION_TRANSITIONS.endCard.enter}
          exitTransition={SECTION_TRANSITIONS.endCard.exit}
        >
          <EndCard />
        </SectionTransition>
      </Sequence>

      {/* Persistent overlay elements — always visible */}
      <TopTicker text={props.topTickerText} />
      <BottomTicker text={props.bottomTickerText} />
      <Watermark />
    </AbsoluteFill>
  );
};
