import { TonalSyncPlugin } from "@/components/plugin/TonalSyncPlugin";
import { Helmet } from "react-helmet";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Tonal Sync - AI-Powered Pitch Correction Plugin by Sweav</title>
        <meta
          name="description"
          content="Tonal Sync 2025 - Zero-latency real-time pitch correction with Adaptive AI Pitch Engine (AIPE), advanced graph mode, and harmonic retune technology."
        />
      </Helmet>
      <TonalSyncPlugin />
    </>
  );
};

export default Index;
