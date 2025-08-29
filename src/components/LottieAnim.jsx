import React, { useEffect, useRef } from 'react'
import lottie from 'lottie-web'
import animationData from '../animations/chart.json'

export default function LottieAnim({ width = 300, height = 300 }) {
  const container = useRef(null)

  useEffect(() => {
    const anim = lottie.loadAnimation({
      container: container.current,
      renderer: 'svg',
      loop: true,         // se repite en bucle
      autoplay: true,     // arranca automáticamente
      animationData,      // tu JSON importado
    })

    return () => {
      anim.destroy()
    }
  }, [])

  return (
    <div
      ref={container}
      style={{ width, height, margin: '0 auto' }}
    />
  )
}
