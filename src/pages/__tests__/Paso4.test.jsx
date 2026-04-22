import { evaluateBcraEligibility } from "../Paso4";

describe("evaluateBcraEligibility", () => {
  it("permite continuar cuando solo hay situacion 2 en historico", () => {
    const bcraData = {
      periodos: [
        {
          periodo: "202507",
          entidades: [{ entidad: "Banco Actual", situacion: 1 }],
        },
      ],
    };
    const bcraHistorico = {
      periodos: [
        {
          periodo: "202406",
          entidades: [{ entidad: "Banco Historico", situacion: 2 }],
        },
      ],
    };

    const evaluation = evaluateBcraEligibility(bcraData, bcraHistorico);

    expect(evaluation.ok).toBe(true);
  });

  it("rechaza cuando el historico tiene situacion mayor a 2", () => {
    const evaluation = evaluateBcraEligibility(
      {
        periodos: [
          {
            periodo: "202507",
            entidades: [{ entidad: "Banco Actual", situacion: 1 }],
          },
        ],
      },
      {
        periodos: [
          {
            periodo: "202406",
            entidades: [{ entidad: "Banco Historico", situacion: 3 }],
          },
        ],
      }
    );

    expect(evaluation).toMatchObject({ ok: false, reason: "bcra_mora_historica" });
  });

  it("rechaza cuando falta el historico aunque el actual venga OK", () => {
    const evaluation = evaluateBcraEligibility(
      {
        periodos: [
          {
            periodo: "202602",
            entidades: [{ entidad: "Banco Actual", situacion: 1 }],
          },
        ],
      },
      null
    );

    expect(evaluation).toMatchObject({ ok: false, reason: "bcra_sin_datos" });
  });
});
