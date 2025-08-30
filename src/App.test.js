import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Paso1 on root route', () => {
  window.history.pushState({}, 'Inicio', '/');
  render(<App />);
  expect(screen.getByRole('button', { name: /Solicitar crédito/i })).toBeInTheDocument();
});
