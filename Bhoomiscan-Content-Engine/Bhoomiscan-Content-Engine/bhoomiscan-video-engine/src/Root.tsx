import { Composition } from "remotion";
import { ListingVideo } from "./ListingVideo";
import { sampleProperty, sampleMinimal } from "./fixtures/sampleProperty";
import { FPS, TOTAL_FRAMES } from "./utils/timing";
import { VIDEO } from "./utils/theme";
import { ListingVideoPropsSchema, ListingVideoProps } from "./types";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ListingVideo"
        component={ListingVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        schema={ListingVideoPropsSchema}
        defaultProps={sampleProperty}
        calculateMetadata={({ props }: { props: ListingVideoProps }) => ({
          durationInFrames: props.totalFrames || TOTAL_FRAMES,
        })}
      />
      <Composition
        id="ListingVideo-NoVideo"
        component={ListingVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={VIDEO.width}
        height={VIDEO.height}
        schema={ListingVideoPropsSchema}
        defaultProps={sampleMinimal}
        calculateMetadata={({ props }: { props: ListingVideoProps }) => ({
          durationInFrames: props.totalFrames || TOTAL_FRAMES,
        })}
      />
    </>
  );
};
