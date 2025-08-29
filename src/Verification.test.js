import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Paso1 from './pages/Paso1';

test('shows error when monto is empty', () => {
  render(
    <MemoryRouter>
      <Paso1 />
    </MemoryRouter>
  );

  fireEvent.change(screen.getByPlaceholderText(/Cantidad de cuotas/i), {
    target: { value: '2' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Solicitar crédito/i }));
  expect(
    screen.getByText(/El monto no puede estar en blanco/i)
  ).toBeInTheDocument();
});

test('shows error when cuotas is empty', () => {
  render(
    <MemoryRouter>
      <Paso1 />
    </MemoryRouter>
  );

  fireEvent.change(screen.getByPlaceholderText(/Monto solicitado/i), {
    target: { value: '100000' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Solicitar crédito/i }));
  expect(
    screen.getByText(/La cantidad de cuotas no puede estar en blanco/i)
  ).toBeInTheDocument();
});
