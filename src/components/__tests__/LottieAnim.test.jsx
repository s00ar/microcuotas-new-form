import React from "react";
import { render } from "@testing-library/react";
import LottieAnim from "../LottieAnim";
import lottie from "lottie-web";

describe("LottieAnim component", () => {
  beforeEach(() => {
    lottie.loadAnimation.mockClear();
  });

  it("loads the animation with the provided container and defaults", () => {
    render(<LottieAnim />);

    expect(lottie.loadAnimation).toHaveBeenCalledTimes(1);
    const callArgs = lottie.loadAnimation.mock.calls[0][0];

    expect(callArgs).toMatchObject({
      renderer: "svg",
      loop: true,
      autoplay: true,
    });
    expect(callArgs.container).toBeInstanceOf(HTMLDivElement);
  });

  it("applies custom width and height styles", () => {
    render(<LottieAnim width={420} height={210} />);

    const container = document.querySelector(".lottie-web");
    expect(container).toHaveStyle({ width: "420px", height: "210px" });
  });

  it("destroys the animation when unmounted", () => {
    const destroySpy = jest.fn();
    lottie.loadAnimation.mockReturnValueOnce({ destroy: destroySpy });

    const { unmount } = render(<LottieAnim />);

    expect(destroySpy).not.toHaveBeenCalled();

    unmount();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
