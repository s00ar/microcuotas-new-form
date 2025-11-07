import React, { useEffect, useRef } from "react";
import lottie from "lottie-web";
import animationData from "../animations/chart.json";

export default function LottieAnim({ width = 300, height = 300 }) {
  const container = useRef(null);

  useEffect(() => {
    if (!container.current) {
      return undefined;
    }

    const animationInstance = lottie.loadAnimation({
      container: container.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData,
    });

    return () => {
      if (animationInstance && typeof animationInstance.destroy === "function") {
        animationInstance.destroy();
      }
    };
  }, []);

  return (
    <div className="lottie-web" ref={container} style={{ width, height, margin: "0 auto" }} />
  );
}
