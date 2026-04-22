import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Paso4 from "../Paso4";

jest.mock("../../components/Header", () => () => <div data-testid="mock-banner" />);
jest.mock("../../components/LottieAnim", () => () => <div data-testid="mock-lottie" />);
jest.mock("../../components/GlobalLoadingProvider", () => ({
  useGlobalLoadingEffect: jest.fn(),
}));

const makeResponse = ({ ok = true, status = 200, headers = {}, body = "" }) => ({
  ok,
  status,
  headers: {
    get: (key) => headers[key.toLowerCase()] || headers[key] || null,
  },
  text: async () => body,
});

describe("Paso4 BCRA fetch handling", () => {
  let warnSpy;
  let errorSpy;
  let infoSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy?.mockRestore();
    errorSpy?.mockRestore();
    infoSpy?.mockRestore();
  });

  const renderPaso4 = (state) =>
    render(
      <MemoryRouter initialEntries={[{ pathname: "/paso4", state }]}>
        <Paso4 />
      </MemoryRouter>
    );

  test("shows error when API returns non-JSON payload", async () => {
    global.fetch.mockResolvedValue(
      makeResponse({
        ok: true,
        status: 200,
        headers: { "content-type": "text/html" },
        body: "<html>maintenance</html>",
      })
    );

    renderPaso4({
      cuil: "20123456789",
      cuotas: "12",
      monto: 100000,
      birthdate: "1990-01-01",
    });

    const error = await screen.findByText(/No pudimos validar la informacion del BCRA/i);
    expect(error).toBeInTheDocument();
    expect(error.textContent).toMatch(/Detalle: BCRA invalid payload/i);
  });

  test("retries on 500 and recovers with valid data", async () => {
    let actualCalls = 0;
    let historicoCalls = 0;
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("historico=1")) {
        historicoCalls += 1;
        return Promise.resolve(
          makeResponse({
            ok: true,
            status: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              results: {
                identificacion: 20123456789,
                denominacion: "HISTORICO OK",
                periodos: [],
              },
            }),
          })
        );
      }
      actualCalls += 1;
      if (actualCalls === 1) {
        return Promise.resolve(
          makeResponse({
            ok: false,
            status: 500,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: 500, message: "error" }),
          })
        );
      }
      return Promise.resolve(
        makeResponse({
          ok: true,
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            results: {
              identificacion: 20123456789,
              denominacion: "NOMBRE OK",
              periodos: [
                { periodo: "202507", entidades: [{ entidad: "BANCO", situacion: 1 }] },
              ],
            },
          }),
        })
      );
    });

    renderPaso4({
      cuil: "20123456789",
      cuotas: "12",
      monto: 100000,
      birthdate: "1990-01-01",
    });

    await screen.findByText(/NOMBRE OK/i);
    await waitFor(() => {
      expect(actualCalls).toBeGreaterThanOrEqual(2);
      expect(historicoCalls).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText(/No pudimos validar la informacion del BCRA/i)).toBeNull();
  });

  test("retries on 429 and recovers with valid data", async () => {
    let actualCalls = 0;
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("historico=1")) {
        return Promise.resolve(
          makeResponse({
            ok: true,
            status: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              results: {
                identificacion: 20123456789,
                denominacion: "HISTORICO OK",
                periodos: [],
              },
            }),
          })
        );
      }
      actualCalls += 1;
      if (actualCalls === 1) {
        return Promise.resolve(
          makeResponse({
            ok: false,
            status: 429,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: 429, message: "rate limit" }),
          })
        );
      }
      return Promise.resolve(
        makeResponse({
          ok: true,
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            results: {
              identificacion: 20123456789,
              denominacion: "NOMBRE OK 429",
              periodos: [
                { periodo: "202507", entidades: [{ entidad: "BANCO", situacion: 1 }] },
              ],
            },
          }),
        })
      );
    });

    renderPaso4({
      cuil: "20123456789",
      cuotas: "12",
      monto: 100000,
      birthdate: "1990-01-01",
    });

    await screen.findByText(/NOMBRE OK 429/i);
    await waitFor(() => {
      expect(actualCalls).toBeGreaterThanOrEqual(2);
    });
  });

  test("retries on AbortError (timeout) and recovers", async () => {
    let actualCalls = 0;
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("historico=1")) {
        return Promise.resolve(
          makeResponse({
            ok: true,
            status: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              results: {
                identificacion: 20123456789,
                denominacion: "HISTORICO OK",
                periodos: [],
              },
            }),
          })
        );
      }
      actualCalls += 1;
      if (actualCalls === 1) {
        const abortError = new Error("The operation was aborted.");
        abortError.name = "AbortError";
        return Promise.reject(abortError);
      }
      return Promise.resolve(
        makeResponse({
          ok: true,
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            results: {
              identificacion: 20123456789,
              denominacion: "NOMBRE OK TIMEOUT",
              periodos: [
                { periodo: "202507", entidades: [{ entidad: "BANCO", situacion: 1 }] },
              ],
            },
          }),
        })
      );
    });

    renderPaso4({
      cuil: "20123456789",
      cuotas: "12",
      monto: 100000,
      birthdate: "1990-01-01",
    });

    await screen.findByText(/NOMBRE OK TIMEOUT/i);
    await waitFor(() => {
      expect(actualCalls).toBeGreaterThanOrEqual(2);
    });
  });

  test("blocks when historical endpoint fails even if actual is ok", async () => {
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("historico=1")) {
        return Promise.resolve(
          makeResponse({
            ok: false,
            status: 404,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: 404, message: "not found" }),
          })
        );
      }
      return Promise.resolve(
        makeResponse({
          ok: true,
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            results: {
              identificacion: 20123456789,
              denominacion: "NOMBRE OK",
              periodos: [{ periodo: "202507", entidades: [{ entidad: "BANCO", situacion: 1 }] }],
            },
          }),
        })
      );
    });

    renderPaso4({
      cuil: "20123456789",
      cuotas: "12",
      monto: 100000,
      birthdate: "1990-01-01",
    });

    const error = await screen.findByText(/No pudimos validar la informacion del BCRA/i);
    expect(error).toBeInTheDocument();
    expect(screen.queryByText(/NOMBRE OK/i)).toBeNull();
  });
});
