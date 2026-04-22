import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

jest.mock("../../components/Header", () => () => <div data-testid="mock-banner" />);
jest.mock("../../components/LottieAnim", () => () => <div data-testid="mock-lottie" />);
jest.mock("../../components/GlobalLoadingProvider", () => ({
  useGlobalLoadingEffect: jest.fn(),
}));

const mockSaveRechazo = jest.fn();
const mockValidateTarjetaContact = jest.fn();

jest.mock("../../services/solicitudes", () => ({
  __esModule: true,
  saveRechazo: mockSaveRechazo,
  validateTarjetaContact: mockValidateTarjetaContact,
  mapReasonToResultado: (reason) => {
    if (reason === "bcra_mora_historica" || reason === "bcra_sin_productos") {
      return { codigo: 4, descripcion: "Productos historicos alcanzan situacion 3, o no tiene prod. hist." };
    }
    if (reason === "bcra_mora_activa") {
      return { codigo: 3, descripcion: "Rechazo por situación 2 de los activos." };
    }
    if (reason === "bcra_demasiados_activos") {
      return { codigo: 2, descripcion: "Rechazo por más de 5 productos activos." };
    }
    return null;
  },
}));

const makeResponse = ({ ok = true, status = 200, headers = {}, body = "" }) => ({
  ok,
  status,
  headers: {
    get: (key) => headers[key.toLowerCase()] || headers[key] || null,
  },
  text: async () => body,
});

describe("Paso4 flow for CUIL 27400383311", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    window.alert?.mockClear?.();
    mockSaveRechazo.mockResolvedValue({ id: "mock-doc" });
    mockValidateTarjetaContact.mockResolvedValue({
      ok: true,
      conflictos: [],
      recientes: [],
      duplicados: [],
    });
  });

  const renderPaso4 = (state) =>
    render(
      <MemoryRouter initialEntries={[{ pathname: "/paso4", state }]}>
        {React.createElement(require("../Paso4").default)}
      </MemoryRouter>
    );

  test("rechaza por mora historica (situacion 5) y permite enviar contacto ignorando ventana de 30 dias solo en la prueba", async () => {
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("historico=1")) {
        return Promise.resolve(
          makeResponse({
            ok: true,
            status: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              results: {
                identificacion: 27400383311,
                denominacion: "OLMEDO ERIKA DENISE",
                periodos: [
                  { periodo: "202602", entidades: [{ entidad: "MERCADOLIBRE S.R.L.", situacion: 1, monto: 50.0 }] },
                  { periodo: "202406", entidades: [{ entidad: "Waynicoin S.A.", situacion: 5, monto: 14.0 }] },
                ],
              },
            }),
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
              identificacion: 27400383311,
              denominacion: "OLMEDO ERIKA DENISE",
              periodos: [
                {
                  periodo: "202602",
                  entidades: [
                    { entidad: "MERCADOLIBRE S.R.L.", situacion: 1, monto: 50.0 },
                    { entidad: "NUEVO BANCO DE SANTA FE SOCIEDAD ANONIMA", situacion: 0, monto: 0.0 },
                  ],
                },
              ],
            },
          }),
        })
      );
    });

    renderPaso4({
      cuil: "27400383311",
      cuotas: "12",
      monto: 100000,
      birthdate: "1990-01-01",
    });

    await screen.findByText(/OLMEDO ERIKA DENISE/i);
    fireEvent.click(screen.getByRole("button", { name: /Si, soy yo/i }));

    await screen.findByText(/se registran atrasos recientes/i);
    fireEvent.change(screen.getByPlaceholderText(/11 2345 6789/i), {
      target: { value: "11 2345 6789" },
    });
    fireEvent.change(screen.getByPlaceholderText(/correo@ejemplo\.com/i), {
      target: { value: "qa+27400383311@microcuotas.test" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Enviar/i }));

    await waitFor(() => expect(mockValidateTarjetaContact).toHaveBeenCalled());
    await waitFor(() => expect(window.alert).toHaveBeenCalled());

    expect(mockValidateTarjetaContact.mock.calls[0][0]).toMatchObject({
      cuil: "27400383311",
    });

    const lastAlertMessage = window.alert.mock.calls[window.alert.mock.calls.length - 1][0];
    expect(lastAlertMessage).toMatch(/Enviamos tus datos de contacto/i);

    // Se cierra el modal al finalizar el envio.
    await waitFor(() => {
      expect(screen.queryByText(/se registran atrasos recientes/i)).toBeNull();
    });
  });
});
