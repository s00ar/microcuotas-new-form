import { splitFullName } from "../person";

describe("splitFullName", () => {
  it("returns empty fields when the name is blank", () => {
    expect(splitFullName("   ")).toEqual({ nombre: "", apellido: "" });
    expect(splitFullName()).toEqual({ nombre: "", apellido: "" });
  });

  it("splits a single word as nombre only", () => {
    expect(splitFullName("Candela")).toEqual({ nombre: "Candela", apellido: "" });
  });

  it("keeps the last token as apellido and the rest as nombre", () => {
    expect(splitFullName("Juan Pablo Perez")).toEqual({
      nombre: "Juan Pablo",
      apellido: "Perez",
    });
  });
});
