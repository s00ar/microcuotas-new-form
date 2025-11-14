// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import React from "react";

const mockLoadAnimation = jest.fn(() => ({
  destroy: jest.fn(),
}));

jest.mock("lottie-web", () => ({
  __esModule: true,
  default: {
    loadAnimation: mockLoadAnimation,
  },
  loadAnimation: mockLoadAnimation,
}));

beforeAll(() => {
  jest.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  window.alert.mockClear();
});

jest.mock("./components/Header", () => () => <div data-testid="mock-banner" />);
jest.mock("./components/Header-Loged", () => () => <div data-testid="mock-header-loged" />);
jest.mock("./components/LottieAnim", () => (props) => (
  <div data-testid="mock-lottie" aria-label="animation" {...props} />
));
jest.mock("./components/DashboardCharts", () => ({ clients = [] }) => (
  <div data-testid="mock-dashboard">Total clientes: {clients.length}</div>
));

jest.mock("./services/solicitudes", () => {
  const actual = jest.requireActual("./services/solicitudes");
  return {
    ...actual,
    saveRechazo: jest.fn(async (payload) => ({ id: "mock-rechazo", payload })),
    saveAceptada: jest.fn(async (payload) => ({ id: "mock-aceptada", payload })),
    isCuilRegistrable: jest.fn(async () => true),
  };
});
