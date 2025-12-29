import React from "react";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Report from "../Report";
import { GlobalLoadingProvider } from "../../components/GlobalLoadingProvider";

const mockFetchContactsData = jest.fn();
const mockDeleteOldClientesBefore = jest.fn();
const mockDeleteDoc = jest.fn();
const mockUseAuthState = jest.fn();

jest.mock("../../firebase", () => ({
  auth: {},
  db: {},
  deleteDoc: (...args) => mockDeleteDoc(...args),
  fetchContactsData: (...args) => mockFetchContactsData(...args),
  deleteOldClientesBefore: (...args) => mockDeleteOldClientesBefore(...args),
  logout: jest.fn(),
}));

jest.mock("react-firebase-hooks/auth", () => ({
  useAuthState: (...args) => mockUseAuthState(...args),
}));

const buildRows = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `doc-${index + 1}`,
    cuil: `20${index.toString().padStart(9, "0")}`,
    nombre: `Persona ${index + 1}`,
    apellido: `Apellido ${index + 1}`,
    telefono: `1140000${index.toString().padStart(3, "0")}`,
    timestamp: { seconds: 1700000000 + index, nanoseconds: 0 },
    estado: index % 2 === 0 ? "aceptada" : "rechazada",
    motivoRechazo: index % 2 === 0 ? null : "Falta de documentación",
    resultadoEvaluacionDescripcion: index % 2 === 0 ? "Procesamiento satisfactorio" : null,
  }));

const renderReport = () =>
  render(
    <GlobalLoadingProvider>
      <MemoryRouter>
        <Report />
      </MemoryRouter>
    </GlobalLoadingProvider>
  );

describe("Report page", () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockUseAuthState.mockReturnValue([{ uid: "demo-user" }, false]);
    mockDeleteOldClientesBefore.mockResolvedValue({ deleted: 0, hasMore: false });
    mockFetchContactsData.mockResolvedValue({ rows: buildRows(12), lastDoc: null });
    mockDeleteDoc.mockResolvedValue();
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("purges old records before fetching data and updates pagination when the page size changes", async () => {
    renderReport();

    await waitFor(() => expect(mockDeleteOldClientesBefore).toHaveBeenCalled());
    await waitFor(() => expect(mockFetchContactsData).toHaveBeenCalled());

    const purgeCallOrder = mockDeleteOldClientesBefore.mock.invocationCallOrder[0];
    const fetchCallOrder = mockFetchContactsData.mock.invocationCallOrder[0];
    expect(purgeCallOrder).toBeLessThan(fetchCallOrder);

    const table = await screen.findByRole("table");
    await within(table).findByRole("cell", { name: "Persona 1" });
    const dataRows = within(table)
      .getAllByRole("row")
      .filter((row) => row.querySelectorAll("td").length > 0);
    expect(dataRows).toHaveLength(12);
    expect(screen.getByText(/Pagina 1 de 1/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/Elementos por página/i), "10");

    await waitFor(() => expect(screen.getByText(/Pagina 1 de 2/)).toBeInTheDocument());
    const paginatedRows = within(table)
      .getAllByRole("row")
      .filter((row) => row.querySelectorAll("td").length > 0);
    expect(paginatedRows).toHaveLength(10);
  });

  it("shows and hides the global spinner around purge and initial fetch", async () => {
    jest.useFakeTimers();
    let resolveFetch;
    let resolvePurge;

    mockDeleteOldClientesBefore.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePurge = resolve;
        })
    );

    mockFetchContactsData.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    renderReport();

    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    expect(await screen.findByRole("status")).toBeInTheDocument();

    act(() => {
      resolvePurge({ deleted: 0, hasMore: false });
    });

    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      resolveFetch({ rows: buildRows(1), lastDoc: null });
    });

    const table = await screen.findByRole("table");
    await within(table).findByRole("cell", { name: "Persona 1" });
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());

    jest.useRealTimers();
  });
});
