require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const { NeynarAPIClient } = require('@neynar/nodejs-sdk');
const { ethers } = require('ethers');
const crypto = require('crypto');
const { generateAITasks, getUserContext } = require('./ai-tasks');

const app = express();
const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY);
const ws = new WebSocket('ws://localhost:8080');

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const token = new ethers.Contract(process.env.TOKEN_ADDRESS, [
  'function balanceOf(address) view returns (uint256)',
  'function burnCredit(address) external'
], wallet);

let trends = { topics: [], users: {} };
let highScoreUsers = [];
const usedTasks = new Map(); // fid → Set<taskHash>

ws.on('open', () => ws.send('mysecret'));
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type !== 'cast' || msg.parent_hash) return;

  const words = msg.text.toLowerCase().match(/#\w+|[\w]{5,}/g) || [];
  words.forEach(w => {
    if (w.startsWith('#')) trends.topics.push(w);
    trends.users[msg.fid] = (trends.users[msg.fid] || 0) + 1;
  });
  trends.topics = [...new Set(trends.topics)].slice(-20);
});

setInterval(async () => {
  try {
    const res = await neynar.v2.usersByScore({ threshold: 0.7, limit: 10 });
    highScoreUsers = res.result.users;
  } catch (e) {}
}, 600000);

function hashTask(task) {
  return crypto.createHash('md5').update(task.task + (task.link || '')).digest('hex');
}

app.get('/ai-tasks', async (req, res) => {
  const { fid } = req.query;
  if (!fid) return res.status(400).json({ error: 'FID required' });

  const user = await neynar.v2.userByFid(fid);
  const walletAddr = user.result.user.custodyAddress;

  const balance = await token.balanceOf(walletAddr);
  if (balance < 1n) return res.status(402).json({ error: 'No $SCORE — buy credits' });

  const ctx = await getUserContext(fid);
  let tasks = await generateAITasks(fid, trends, highScoreUsers, ctx);

  const userUsed = usedTasks.get(fid) || new Set();
  tasks = tasks.filter(t => {
    const h = hashTask(t);
    if (userUsed.has(h)) return false;
    userUsed.add(h);
    return true;
  });
  if (!usedTasks.has(fid)) usedTasks.set(fid, userUsed);

  await token.burnCredit(walletAddr);
  res.json(tasks);
});

app.get('/score', async (req, res) => {
  const { fid } = req.query;
  try {
    const u = await neynar.v2.userByFid(fid);
    res.json({ score: u.result.neynar_user_score || 0.4 });
  } catch {
    res.json({ score: 0.4 });
  }
});

app.listen(3000, () => console.log('ScoreUp Backend LIVE: http://localhost:3000'));
