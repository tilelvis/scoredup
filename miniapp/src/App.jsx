import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import axios from 'axios';

export default function App() {
  const [fid, setFid] = useState(null);
  const [score, setScore] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [credits, setCredits] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // CRITICAL: Call ready() immediately to dismiss loading screen
    sdk.actions.ready()
      .then(() => {
        console.log('Mini App ready — loading content');
        setLoading(false);
      })
      .catch((error) => {
        console.error('SDK ready failed:', error);
        // Fallback: Hide loading anyway
        setLoading(false);
      });

    // Get FID & score
    sdk.auth.getFid()
      .then(async (f) => {
        setFid(f);
        if (f) {
          try {
            const s = await axios.get(`http://localhost:3000/score?fid=${f}`);
            setScore(s.data.score);
          } catch (e) {
            console.error('Score fetch failed:', e);
            setScore(0.4); // Fallback
          }
        }
      })
      .catch((error) => {
        console.error('FID fetch failed:', error);
      });
  }, []);

  const getTasks = async () => {
    if (credits <= 0) return alert("Buy credits!");
    setCredits(credits - 1);
    try {
      const res = await axios.get(`http://localhost:3000/ai-tasks?fid=${fid}`);
      setTasks(res.data);
    } catch (e) {
      console.error('Tasks fetch failed:', e);
      alert("Backend error — check console");
    }
  };

  const buyCredits = () => {
    // Placeholder — implement wallet later
    setCredits(credits + 50);
    alert("Credits added! (Simulated)");
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center' }}>Loading ScoreUp...</div>;
  }

  return (
    <div style={{ padding: 20, background: '#000', color: '#0f0', fontFamily: 'monospace' }}>
      <h1>ScoreUp</h1>
      <p>Score: {score.toFixed(2)} | Credits: {credits}</p>
      <button onClick={buyCredits}>Buy 50 Credits ($5)</button>
      <button onClick={getTasks} disabled={credits === 0 || !fid}>
        Get AI Tasks (1 credit)
      </button>

      <div style={{ marginTop: 20 }}>
        {tasks.length > 0 ? tasks.map((t, i) => (
          <div key={i} style={{ margin: '10px 0', padding: 10, background: '#111', borderLeft: '4px solid #0f0' }}>
            <strong>{t.task}</strong> <small style={{ color: '#0f8' }}>({t.estBoost})</small>
            {t.link && <button onClick={() => sdk.actions.openUrl(t.link)}>Go</button>}
          </div>
        )) : <p>No tasks yet — click to generate!</p>}
      </div>
    </div>
  );
}