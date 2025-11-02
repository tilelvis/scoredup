import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { ethers } from 'ethers';
import axios from 'axios';

const TOKEN_ADDRESS = process.env.VITE_TOKEN_ADDRESS || '0xYourToken';

export default function App() {
  const [fid, setFid] = useState(null);
  const [score, setScore] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    sdk.actions.ready();
    sdk.auth.getFid().then(async (f) => {
      setFid(f);
      const s = await axios.get(`http://localhost:3000/score?fid=${f}`);
      setScore(s.data.score);
      updateCredits(f);
    });
  }, []);

  const updateCredits = async (f) => {
    const user = await sdk.auth.getUser();
    const provider = new ethers.BrowserProvider(window.ethereum);
    const token = new ethers.Contract(TOKEN_ADDRESS, ['function balanceOf(address) view returns (uint256)'], provider);
    const bal = await token.balanceOf(user.custodyAddress);
    setCredits(Number(bal));
  };

  const buyCredits = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const token = new ethers.Contract(TOKEN_ADDRESS, [
      'function buyCredits() payable'
    ], signer);
    const tx = await token.buyCredits({ value: ethers.parseEther('0.002') });
    await tx.wait();
    updateCredits(fid);
  };

  const getTasks = async () => {
    const res = await axios.get(`http://localhost:3000/ai-tasks?fid=${fid}`);
    setTasks(res.data);
  };

  return (
    <div style={{ padding: 20, background: '#000', color: '#0f0', fontFamily: 'monospace' }}>
      <h1>ScoreUp</h1>
      <p>Score: {score.toFixed(2)} | $SCORE: {credits}</p>
      <button onClick={buyCredits}>Buy 10 $SCORE ($5)</button>
      <button onClick={getTasks} disabled={credits === 0}>
        Get AI Tasks (1 $SCORE)
      </button>

      <div style={{ marginTop: 20 }}>
        {tasks.map((t, i) => (
          <div key={i} style={{ margin: '10px 0', padding: 10, background: '#111', borderLeft: '4px solid #0f0' }}>
            <strong>{t.task}</strong> <small style={{ color: '#0f8' }}>({t.estBoost})</small>
            {t.link && <button onClick={() => sdk.actions.openUrl(t.link)}>Go</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
