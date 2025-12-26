import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Paso2 from './pages/Paso2';

jest.mock('./services/solicitudes', () => ({
  RESULTADOS_EVALUACION: { MENOR_21: { codigo: 1, descripcion: "Rechazo por menor de 30 a?os." } },
  saveRechazo: jest.fn().mockResolvedValue(null),
}));

test('shows error when user is under 30 years', async () => {
  const initialEntries = [{ pathname: '/paso2', state: { cuotas: '12', monto: 100000 } }];
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Paso2 />
    </MemoryRouter>
  );

  const underage = new Date();
  underage.setFullYear(underage.getFullYear() - 29); // 29 a?os, debe rechazar
  fireEvent.change(screen.getByLabelText(/Fecha de nacimiento/i), {
    target: { value: underage.toISOString().split('T')[0] },
  });
  fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
  expect(await screen.findByText(/Debes ser mayor de 30/i)).toBeInTheDocument();
});
