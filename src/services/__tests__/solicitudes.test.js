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
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn((dbArg, name) => ({ dbArg, name })),
  getDocs: jest.fn(),
  query: jest.fn((...parts) => ({ type: "query", parts })),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  serverTimestamp: jest.fn(() => "server-timestamp"),
}));

jest.mock("../../firebase", () => ({ db: { projectId: "demo-project" } }));

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
    getDocs.mockResolvedValue(buildSnapshot([]));
    addDoc.mockResolvedValue({ id: "mock-doc" });
    serverTimestamp.mockReturnValue("server-timestamp");
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
    getDocs.mockResolvedValueOnce(buildSnapshot([]));
    await expect(isFieldUnique("telefono", "1140000000")).resolves.toBe(true);
    expect(where).toHaveBeenCalledWith("telefono", "==", "1140000000");
  });

  it("ignores rejected states and same CUIL when testing uniqueness", async () => {
    getDocs.mockResolvedValueOnce(
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
    getDocs.mockRejectedValueOnce({ code: "permission-denied" });
    await expect(isFieldUnique("email", "demo@mail.com")).resolves.toBe(true);
  });

  it("calculates CUIL recency returning the latest timestamp", async () => {
    const today = Date.now();
    const oldDate = new Date(today - 40 * 24 * 60 * 60 * 1000);
    const recentDate = new Date(today - 5 * 24 * 60 * 60 * 1000);
    getDocs.mockResolvedValueOnce(
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
    getDocs.mockResolvedValueOnce(buildSnapshot([{ fechaSolicitud: older.toISOString() }]));

    const result = await getCuilRecency("20123456789", 30);
    expect(result.canRegister).toBe(true);
    expect(result.lastDate).toEqual(older);
  });

  it("treats permission-denied recency queries as registrable", async () => {
    getDocs.mockRejectedValueOnce({ code: "permission-denied" });
    await expect(getCuilRecency("20123456789")).resolves.toEqual({
      canRegister: true,
      lastDate: null,
    });
  });

  it("delegates isCuilRegistrable to getCuilRecency", async () => {
    const recent = new Date();
    getDocs.mockResolvedValueOnce(buildSnapshot([{ timestamp: recent }]));
    const registrable = await isCuilRegistrable("20123456789", 30);
    expect(registrable).toBe(false);
  });

  it("saves rechazos with mapped evaluation data", async () => {
    addDoc.mockResolvedValueOnce({ id: "rechazo-1" });
    await saveRechazo({
      motivoRechazo: null,
      motivoRechazoCodigo: "bcra_mora_activa",
      cuil: "20-12345678-9",
    });
    expect(addDoc).toHaveBeenCalled();
    const payload = addDoc.mock.calls[0][1];
    expect(payload.estado).toBe("rechazada");
    expect(payload.resultadoEvaluacionCodigo).toBe(RESULTADOS_EVALUACION.MORA_ACTIVA.codigo);
    expect(payload.timestamp).toBe("server-timestamp");
  });

  it("saves solicitudes aceptadas normalizando campos", async () => {
    addDoc.mockResolvedValueOnce({ id: "aceptada-1" });
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
    const payload = addDoc.mock.calls[0][1];
    expect(payload.telefono).toBe("01140001234");
    expect(payload.email).toBe("demo@mail.com");
    expect(payload.estado).toBe("aceptada");
    uniqueSpy.mockRestore();
  });

  it("throws duplicate_fields when uniqueness checks fail", async () => {
    getDocs.mockResolvedValueOnce(
      buildSnapshot([{ telefono: "1140000000", estado: "pendiente", cuil: "20123456789" }])
    );

    await expect(
      saveSolicitud({
        telefono: "1140000000",
        email: "demo@mail.com",
      })
    ).rejects.toMatchObject({ code: "duplicate_fields", fields: ["telefono"] });
    expect(addDoc).not.toHaveBeenCalled();
  });
});
