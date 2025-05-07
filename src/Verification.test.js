// src/pages/Verification.test.js
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Verification from './Verification';
import { MemoryRouter } from 'react-router-dom';

// Mock de Firebase y navegación
jest.mock('../firebase', () => ({
  db: {},
  collection: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ forEach: () => {} }),
  query: jest.fn(),
  where: jest.fn(),
}));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

describe('Verification Component', () => {
  test('renders all form fields', () => {
    render(
      <MemoryRouter>
        <Verification />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText(/Ingresa tu cuil/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cantidad de Cuotas:/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Monto Solicitado:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Solicitar crédito/i })).toBeInTheDocument();
  });

  test('shows error when CUIL is empty and button is clicked', async () => {
    render(
      <MemoryRouter>
        <Verification />
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: /Solicitar crédito/i });
    fireEvent.click(button);

    expect(await screen.findByText(/CUIL no puede estar en blanco/i)).toBeInTheDocument();
  });

  test('checkbox toggles cliente recurrente', () => {
    render(
      <MemoryRouter>
        <Verification />
      </MemoryRouter>
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
