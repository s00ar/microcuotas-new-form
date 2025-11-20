import React, { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  GlobalLoadingProvider,
  useGlobalLoading,
  useGlobalLoadingEffect,
} from "../GlobalLoadingProvider";

const Buttons = () => {
  const { startLoading, stopLoading } = useGlobalLoading();
  return (
    <div>
      <button onClick={startLoading}>cargar</button>
      <button onClick={stopLoading}>detener</button>
    </div>
  );
};

const EffectHarness = () => {
  const [active, setActive] = useState(false);
  useGlobalLoadingEffect(active);
  return (
    <button onClick={() => setActive((value) => !value)}>
      toggle:{active ? "on" : "off"}
    </button>
  );
};

describe("GlobalLoadingProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the overlay only after the delay and hides it when stopLoading runs", async () => {
    render(
      <GlobalLoadingProvider>
        <Buttons />
      </GlobalLoadingProvider>
    );

    await userEvent.click(screen.getByText("cargar"));
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(screen.queryByRole("status")).toBeNull();

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    await userEvent.click(screen.getByText("detener"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("starts and stops the spinner when the effect flag changes", async () => {
    render(
      <GlobalLoadingProvider>
        <EffectHarness />
      </GlobalLoadingProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: /toggle:off/i }));

    act(() => {
      jest.advanceTimersByTime(450);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /toggle:on/i }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
