import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Paso2 from './pages/Paso2';

test('shows error when user is under 18 years and 6 months', async () => {
  const initialEntries = [{ pathname: '/paso2', state: { cuotas: '12', monto: 100000 } }];
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Paso2 />
    </MemoryRouter>
  );

  const underage = new Date();
  underage.setFullYear(underage.getFullYear() - 18);
  underage.setMonth(underage.getMonth() - 5);
  fireEvent.change(screen.getByLabelText(/Fecha de nacimiento/i), {
    target: { value: underage.toISOString().split('T')[0] },
  });
  fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
  expect(
    await screen.findByText(/Lamentablemente por el momento no podemos ofrecerle ningun préstamo/i)
  ).toBeInTheDocument();
});
