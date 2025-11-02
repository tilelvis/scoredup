require('dotenv').config();
const { Grok } = require('grok-sdk');
const axios = require('axios');
const { NeynarAPIClient } = require('@neynar/nodejs-sdk');
const neynar = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

const grok = new Grok({ apiKey: process.env.GROK_API_KEY });

async function getUserContext(fid) {
  try {
    const [user, casts, follows] = await Promise.all([
      neynar.v2.userByFid(fid),
      neynar.v2.feed({ fid, feed_type: 'following', limit: 20 }),
      neynar.v2.following(fid, { limit: 50 })
    ]);

    const userTopics = new Set();
    casts.result.casts.forEach(c => {
      (c.text.match(/#\w+/g) || []).forEach(t => userTopics.add(t));
    });

    return {
      username: user.result.user.username,
      score: user.result.neynar_user_score || 0.4,
      topics: Array.from(userTopics).slice(0, 3),
      follows: follows.result.users.map(u => u.username).slice(0, 5)
    };
  } catch (e) {
    return { username: 'user', score: 0.4, topics: ['#gm'], follows: ['dwr'] };
  }
}

async function generateAITasks(userFid, trends, highUsers, ctx) {
  const prompt = `
You are ScoreUp AI — Farcaster growth expert.
User: @${ctx.username} (FID: ${userFid}), score: ${ctx.score}
Interests: ${ctx.topics.join(', ')}
Follows: ${ctx.follows.join(', ')}

Generate 3 **UNIQUE** tasks:
- Pick **1 random** high-score user from: ${highUsers.map(u => u.username).join(', ')}
- Use **1** trending topic: ${trends.topics.slice(0,5).join(', ')}
- Use **latest cast** from that user (not pinned)
- **Never repeat** phrasing
- Include **Warpcast link** to that cast
- Estimate boost +0.03 to +0.09
- Keep < 120 chars

Return JSON with NO duplicates.
`;

  const res = await grok.chat.completions.create({
    model: 'grok-3',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 500
  });

  try {
    return JSON.parse(res.choices[0].message.content);
  } catch {
    return fallback(ctx, highUsers, trends);
  }
}

function fallback(ctx, highUsers, trends) {
  const user = highUsers[0]?.username || 'dwr';
  const topic = trends.topics[0] || '#gm';
  return [
    { task: `Reply to @${user}'s latest on ${topic}`, estBoost: '+0.05', link: 'https://warpcast.com/' + user },
    { task: `Recast @${user} and add your take`, estBoost: '+0.04' },
    { task: `Post about ${topic} with @${ctx.username}`, estBoost: '+0.03' }
  ];
}

module.exports = { generateAITasks, getUserContext };
