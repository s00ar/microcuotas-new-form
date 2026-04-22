import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Paso5 from "../Paso5";

jest.mock("../../services/solicitudes", () => ({
  saveAceptada: jest.fn().mockResolvedValue(null),
  isCuilRegistrable: jest.fn().mockResolvedValue(true),
}));

const { saveAceptada, isCuilRegistrable } = require("../../services/solicitudes");

describe("Paso5 age validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    isCuilRegistrable.mockResolvedValue(true);
    saveAceptada.mockResolvedValue(null);
  });

  const renderPaso5 = (state) =>
    render(
      <MemoryRouter initialEntries={[{ pathname: "/paso5", state }]}>
        <Paso5 />
      </MemoryRouter>
    );

  test("blocks submission when user is under 30", async () => {
    const underage = new Date();
    underage.setFullYear(underage.getFullYear() - 29);
    renderPaso5({
      cuil: "20123456789",
      cuotas: "12",
      monto: 100000,
      birthdate: underage.toISOString().split("T")[0],
      nombre: "Juan Perez",
    });

    fireEvent.change(screen.getByLabelText(/Teléfono/i), { target: { value: "1123456789" } });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { value: "test@example.com" },
    });
    const form = document.querySelector("form.verification__form");
    fireEvent.submit(form);

    expect(window.alert).toHaveBeenCalledWith("Debes ser mayor de 30 años para continuar.");
    expect(saveAceptada).not.toHaveBeenCalled();
  });

  test("allows submission when user is 30 or older", async () => {
    const adult = new Date();
    adult.setFullYear(adult.getFullYear() - 31);
    renderPaso5({
      cuil: "20123456789",
      cuotas: "12",
      monto: 100000,
      birthdate: adult.toISOString().split("T")[0],
      nombre: "Juan Perez",
    });

    expect(jest.isMockFunction(isCuilRegistrable)).toBe(true);
    expect(jest.isMockFunction(saveAceptada)).toBe(true);

    fireEvent.change(screen.getByLabelText(/Teléfono/i), { target: { value: "1123456789" } });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { value: "test@example.com" },
    });
    const form = document.querySelector("form.verification__form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(isCuilRegistrable).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(saveAceptada).toHaveBeenCalled();
    });
  });
});
