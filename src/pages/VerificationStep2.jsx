import React from 'react';
import { useNavigate } from 'react-router-dom';

const VerificationStep2 = () => {
  const navigate = useNavigate();
  return (
    <div>
      <h2>Verification Step 2</h2>
      <input placeholder="step2-placeholder" value="step2-display" readOnly />
      <button onClick={() => navigate('/verification-step3')}>Ir al paso 3</button>
    </div>
  );
};

export default VerificationStep2;
