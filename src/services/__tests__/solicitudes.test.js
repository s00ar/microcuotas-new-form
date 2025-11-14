const mockAddDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockCollection = jest.fn((dbArg, name) => ({ dbArg, name }));
const mockQuery = jest.fn((...parts) => ({ type: "query", parts }));
const mockWhere = jest.fn((field, op, value) => ({ field, op, value }));
const mockServerTimestamp = jest.fn(() => "server-timestamp");

jest.mock("firebase/firestore", () => ({
  addDoc: (...args) => mockAddDoc(...args),
  collection: (...args) => mockCollection(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  serverTimestamp: (...args) => mockServerTimestamp(...args),
}));

jest.mock("../../firebase", () => ({ db: { projectId: "demo-project" } }));

import saveSolicitud, {
  RESULTADOS_EVALUACION,
  getCuilRecency,
  isCuilRegistrable,
  isFieldUnique,
  mapReasonToResultado,
  normalizeFieldValue,
  saveAceptada,
  saveRechazo,
} from "../solicitudes";
import * as solicitudesModule from "../solicitudes";

const buildSnapshot = (docs) => {
  const docSnaps = docs.map((data) => ({
    data: () => data,
  }));
  return {
    empty: docSnaps.length === 0,
    docs: docSnaps,
    forEach: (callback) => docSnaps.forEach((doc) => callback(doc)),
  };
};

describe("solicitudes service helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps known rejection reasons", () => {
    expect(mapReasonToResultado("menor_21")).toEqual(RESULTADOS_EVALUACION.MENOR_21);
    expect(mapReasonToResultado("bcra_mora_activa")).toEqual(RESULTADOS_EVALUACION.MORA_ACTIVA);
    expect(mapReasonToResultado("inexistente")).toBeNull();
  });

  it("normalizes field values consistently", () => {
    expect(normalizeFieldValue("email", " Demo@MAIL.com ")).toBe("demo@mail.com");
    expect(normalizeFieldValue("cuil", "20-12345678-9")).toBe("20123456789");
    expect(normalizeFieldValue("telefono", "(011) 4000-1234")).toBe("01140001234");
    expect(normalizeFieldValue("otro", " valor ")).toBe("valor");
  });

  it("confirms uniqueness when Firestore returns no documents", async () => {
    mockGetDocs.mockResolvedValueOnce(buildSnapshot([]));
    await expect(isFieldUnique("telefono", "1140000000")).resolves.toBe(true);
    expect(mockWhere).toHaveBeenCalledWith("telefono", "==", "1140000000");
  });

  it("ignores rejected states and same CUIL when testing uniqueness", async () => {
    mockGetDocs.mockResolvedValueOnce(
      buildSnapshot([
        { estado: "rechazada", telefono: "1140000000" },
        { estado: "pendiente", telefono: "1140000000", cuil: "20123456789" },
        { estado: "pendiente", telefono: "1140000000", cuil: "20999999999" },
      ])
    );

    await expect(
      isFieldUnique("telefono", "1140000000", {
        ignoreEstados: ["rechazada"],
        sameCuilValue: "20-12345678-9",
      })
    ).resolves.toBe(false);
  });

  it("treats permission errors in uniqueness checks as non-blocking", async () => {
    mockGetDocs.mockRejectedValueOnce({ code: "permission-denied" });
    await expect(isFieldUnique("email", "demo@mail.com")).resolves.toBe(true);
  });

  it("calculates CUIL recency returning the latest timestamp", async () => {
    const today = Date.now();
    const oldDate = new Date(today - 40 * 24 * 60 * 60 * 1000);
    const recentDate = new Date(today - 5 * 24 * 60 * 60 * 1000);
    mockGetDocs.mockResolvedValueOnce(
      buildSnapshot([
        { timestamp: { toDate: () => oldDate } },
        { timestamp: recentDate },
      ])
    );

    const result = await getCuilRecency("20-12345678-9", 30);
    expect(result.canRegister).toBe(false);
    expect(result.lastDate).toEqual(recentDate);
  });

  it("allows registration when no documents or old timestamps exist", async () => {
    const older = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    mockGetDocs.mockResolvedValueOnce(buildSnapshot([{ fechaSolicitud: older.toISOString() }]));

    const result = await getCuilRecency("20123456789", 30);
    expect(result.canRegister).toBe(true);
    expect(result.lastDate).toEqual(older);
  });

  it("treats permission-denied recency queries as registrable", async () => {
    mockGetDocs.mockRejectedValueOnce({ code: "permission-denied" });
    await expect(getCuilRecency("20123456789")).resolves.toEqual({
      canRegister: true,
      lastDate: null,
    });
  });

  it("delegates isCuilRegistrable to getCuilRecency", async () => {
    const spy = jest.spyOn(solicitudesModule, "getCuilRecency").mockResolvedValueOnce({
      canRegister: false,
      lastDate: new Date(),
    });
    await expect(isCuilRegistrable("20123456789")).resolves.toBe(false);
    spy.mockRestore();
  });

  it("saves rechazos with mapped evaluation data", async () => {
    mockAddDoc.mockResolvedValueOnce({ id: "rechazo-1" });
    await saveRechazo({
      motivoRechazo: null,
      motivoRechazoCodigo: "bcra_mora_activa",
      cuil: "20-12345678-9",
    });
    expect(mockAddDoc).toHaveBeenCalled();
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.estado).toBe("rechazada");
    expect(payload.resultadoEvaluacionCodigo).toBe(RESULTADOS_EVALUACION.MORA_ACTIVA.codigo);
    expect(payload.timestamp).toBe("server-timestamp");
  });

  it("saves solicitudes aceptadas normalizando campos", async () => {
    mockAddDoc.mockResolvedValueOnce({ id: "aceptada-1" });
    const uniqueSpy = jest.spyOn(solicitudesModule, "isFieldUnique").mockResolvedValue(true);
    await saveAceptada({
      nombre: "Demo",
      apellido: "Test",
      cuil: "20-12345678-9",
      telefono: "(011) 4000-1234",
      email: " DEMO@MAIL.COM ",
      monto: 50000,
      cuotas: 12,
    });
    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.telefono).toBe("01140001234");
    expect(payload.email).toBe("demo@mail.com");
    expect(payload.estado).toBe("aceptada");
    uniqueSpy.mockRestore();
  });

  it("throws duplicate_fields when uniqueness checks fail", async () => {
    const uniqueSpy = jest
      .spyOn(solicitudesModule, "isFieldUnique")
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    await expect(
      saveSolicitud({
        telefono: "1140000000",
        email: "demo@mail.com",
      })
    ).rejects.toMatchObject({ code: "duplicate_fields", fields: ["telefono"] });
    expect(mockAddDoc).not.toHaveBeenCalled();
    uniqueSpy.mockRestore();
  });
});
