import React, { useEffect } from "react";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { GlobalLoadingProvider, useGlobalLoading } from "../GlobalLoadingProvider";

const TriggerLoading = () => {
  const { startLoading, stopLoading } = useGlobalLoading();

  useEffect(() => {
    startLoading();
    return () => stopLoading();
  }, [startLoading, stopLoading]);

  return null;
};

describe("GlobalLoadingProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("delays showing the global spinner until the threshold is exceeded", () => {
    render(
      <GlobalLoadingProvider>
        <TriggerLoading />
      </GlobalLoadingProvider>
    );

    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      jest.advanceTimersByTime(399);
    });
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      jest.advanceTimersByTime(2);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("hides the spinner once all tracked loads finish", () => {
    const { unmount } = render(
      <GlobalLoadingProvider>
        <TriggerLoading />
      </GlobalLoadingProvider>
    );

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      unmount();
    });

    expect(screen.queryByRole("status")).toBeNull();
  });
});
