import React from 'react';
import { useNavigate } from 'react-router-dom';

const VerificationStep3 = () => {
  const navigate = useNavigate();
  return (
    <div>
      <h2>Verification Step 3</h2>
      <input placeholder="step3-placeholder" value="step3-display" readOnly />
      <button onClick={() => navigate('/')}>Finalizar</button>
    </div>
  );
};

export default VerificationStep3;
