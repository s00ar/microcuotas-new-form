// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

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

jest.mock("./services/solicitudes", () => {
  const actual = jest.requireActual("./services/solicitudes");
  return {
    ...actual,
    saveRechazo: jest.fn(async (payload) => ({ id: "mock-rechazo", payload })),
    saveAceptada: jest.fn(async (payload) => ({ id: "mock-aceptada", payload })),
    isCuilRegistrable: jest.fn(async () => true),
  };
});
