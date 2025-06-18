// src/pages/Options.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getSimulationParams,
  updateSimulationParams
} from '../firebase'

export default function Options() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    minCuotas: 2,
    maxCuotas: 12,
    minMonto: 50000,
    maxMonto: 500000,
    interesesPorCuota: {}
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ← Este useEffect carga y desestructura todos los campos al montar
  useEffect(() => {
    async function load() {
      try {
        const {
          minCuotas,
          maxCuotas,
          minMonto,
          maxMonto,
          interesesPorCuota = {}
        } = await getSimulationParams()
        setForm({ minCuotas, maxCuotas, minMonto, maxMonto, interesesPorCuota })
      } catch (err) {
        console.error('Error al leer params:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleChange = e => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: Number(value) }))
  }

  const handleInteresChange = (cuota, value) => {
    setForm(f => ({
      ...f,
      interesesPorCuota: {
        ...f.interesesPorCuota,
        [cuota]: Number(value)
      }
    }))
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateSimulationParams(form)
      alert('Parámetros guardados correctamente')
    } catch (err) {
      console.error('Error al guardar params:', err)
      alert('Error al guardar parámetros')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Cargando configuración…</p>

  // Construyo el rango de cuotas dinámicamente
  const cuotaRange = Array.from(
    { length: form.maxCuotas - form.minCuotas + 1 },
    (_, i) => form.minCuotas + i
  )

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>Opciones del Sistema</h1>
      <form onSubmit={handleSubmit}>
        <fieldset style={{ marginBottom: 20, padding: 10 }}>
          <legend>Rangos de Cuotas y Montos</legend>

          <label style={{ display: 'block', marginBottom: 8 }}>
            Mínimo Cuotas:
            <input
              type="number"
              name="minCuotas"
              value={form.minCuotas}
              onChange={handleChange}
              min="1"
              style={{ marginLeft: 8 }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            Máximo Cuotas:
            <input
              type="number"
              name="maxCuotas"
              value={form.maxCuotas}
              onChange={handleChange}
              min={form.minCuotas}
              style={{ marginLeft: 8 }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            Monto Mínimo:
            <input
              type="number"
              name="minMonto"
              value={form.minMonto}
              onChange={handleChange}
              step="1000"
              style={{ marginLeft: 8 }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            Monto Máximo:
            <input
              type="number"
              name="maxMonto"
              value={form.maxMonto}
              onChange={handleChange}
              step="1000"
              min={form.minMonto}
              style={{ marginLeft: 8 }}
            />
          </label>
        </fieldset>

        <fieldset style={{ marginBottom: 20, padding: 10 }}>
          <legend>Intereses por Cuota (%)</legend>
          <table
            border="1"
            cellPadding="6"
            style={{ borderCollapse: 'collapse', width: '100%' }}
          >
            <thead>
              <tr>
                <th>Cuotas</th>
                <th>Interés %</th>
              </tr>
            </thead>
            <tbody>
              {cuotaRange.map(cuota => (
                <tr key={cuota}>
                  <td style={{ textAlign: 'center' }}>{cuota}</td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="number"
                      value={form.interesesPorCuota[cuota] ?? ''}
                      onChange={e =>
                        handleInteresChange(cuota, e.target.value)
                      }
                      step="0.1"
                      style={{ width: 60 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>

        <button
          type="submit"
          disabled={saving}
          style={{ marginRight: 10, padding: '8px 16px' }}
        >
          {saving ? 'Guardando…' : 'Guardar Cambios'}
        </button>

        {/* Botón para volver al menú principal */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{ padding: '8px 16px' }}
        >
          Volver al menú principal
        </button>
      </form>
    </div>
  )
}
