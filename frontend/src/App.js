import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import './App.css';

function App() {
  const [stats, setStats] = useState({
    totalPosts: 0,
    activeSubreddits: 0,
    avgEngagement: 0
  });
  
  const [sentimentData, setSentimentData] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [subredditPerformance, setSubredditPerformance] = useState([]);
  const [activityHeatmap, setActivityHeatmap] = useState([]);
  const [volumeData, setVolumeData] = useState([]);
  const [pieChartData, setPieChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
  try {
    const response = await fetch('/reddit_processed_20260203_094456.csv');
    const csvText = await response.text();
    
    // Parse CSV better
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    const data = lines.slice(1).map(line => {
      // Handle quoted values properly
      const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index] ? values[index].replace(/^"|"$/g, '').trim() : '';
        return obj;
      }, {});
    }).filter(row => row.post_id && row.subreddit); // Filter valid rows

    // Filter to only our 5 main subreddits
    const mainSubreddits = ['technology', 'programming', 'datascience', 'MachineLearning', 'Python'];
    const filteredData = data.filter(row => mainSubreddits.includes(row.subreddit));

    // Calculate stats
    const totalPosts = filteredData.length;
    const activeSubreddits = new Set(filteredData.map(d => d.subreddit)).size;
    
    // Fix engagement calculation - handle NaN
    const totalEngagement = filteredData.reduce((sum, d) => {
      const engagement = parseInt(d.engagement);
      return sum + (isNaN(engagement) ? 0 : engagement);
    }, 0);
    const avgEngagement = Math.round(totalEngagement / totalPosts) || 0;

    setStats({ totalPosts, activeSubreddits, avgEngagement });

    // Rest of sentiment code stays the same...
    const sentimentCounts = filteredData.reduce((acc, d) => {
      const sentiment = d.sentiment_category;
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {});

    setSentimentData([
      { name: 'Negative', value: sentimentCounts.negative || 0 },
      { name: 'Neutral', value: sentimentCounts.neutral || 0 },
      { name: 'Positive', value: sentimentCounts.positive || 0 }
    ]);

    // Trending posts
    const sorted = filteredData
      .sort((a, b) => parseInt(b.score || 0) - parseInt(a.score || 0))
      .slice(0, 5);
    
    setTrendingPosts(sorted.map(post => ({
      title: post.title,
      subreddit: post.subreddit,
      score: post.score,
      comments: post.num_comments,
      sentiment: post.sentiment_category
    })));

      // Subreddit Performance
      const subredditStats = {};
    filteredData.forEach(post => {
      const sub = post.subreddit;
      if (!subredditStats[sub]) {
        subredditStats[sub] = { posts: 0, comments: 0, scores: [] };
      }
      subredditStats[sub].posts++;
      subredditStats[sub].comments += parseInt(post.num_comments || 0);
      const score = parseInt(post.score || 0);
      if (!isNaN(score)) subredditStats[sub].scores.push(score);
    });

    const perfData = Object.entries(subredditStats).map(([name, stats]) => ({
      name: `r/${name}`,
      posts: stats.posts,
      comments: stats.comments,
      avgScore: stats.scores.length > 0 
        ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length)
        : 0
    }));
    setSubredditPerformance(perfData);

    // Activity Heatmap, Volume, Pie chart - same as before but use filteredData
    const hourCounts = {};
    filteredData.forEach(post => {
      const hour = parseInt(post.created_hour || 0);
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const heatmapData = Object.entries(hourCounts)
      .map(([hour, count]) => ({
        time: `${hour}:00`,
        activity: count
      }))
      .sort((a, b) => parseInt(a.time) - parseInt(b.time));
    setActivityHeatmap(heatmapData);

    // Volume over time
    const dayCounts = {};
    const dayComments = {};
    filteredData.forEach(post => {
      const day = post.created_day;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
      dayComments[day] = (dayComments[day] || 0) + parseInt(post.num_comments || 0);
    });

    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const volumeChartData = dayOrder
      .filter(day => dayCounts[day])
      .map(day => ({
        day: day.slice(0, 3),
        posts: dayCounts[day] || 0,
        comments: dayComments[day] || 0
      }));
    setVolumeData(volumeChartData);

      // Top Performing Subreddits (pie chart)
      const colors = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa'];
    const pieData = perfData
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 5)
      .map((sub, index) => ({
        name: sub.name,
        value: sub.posts,
        color: colors[index]
      }));
    setPieChartData(pieData);

    setLoading(false);
  } catch (error) {
    console.error('Error fetching data:', error);
    setLoading(false);
  }
};

  if (loading) {
    return <div className="dashboard-container">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        {/* Header */}
        <div className="dashboard-header">
          <h1 className="dashboard-title">Reddit Data Pipeline Dashboard</h1>
          <p className="dashboard-subtitle">Real-time analytics from your Reddit data pipeline</p>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <h3 className="kpi-label">Total Posts Analyzed</h3>
            <div className="kpi-value">{stats.totalPosts}</div>
            <div className="kpi-description">Monitoring daily</div>
          </div>
          <div className="kpi-card">
            <h3 className="kpi-label">Active Subreddits</h3>
            <div className="kpi-value">{stats.activeSubreddits}</div>
            <div className="kpi-description">Monitoring daily</div>
          </div>
          <div className="kpi-card">
            <h3 className="kpi-label">Avg Engagement</h3>
            <div className="kpi-value">{stats.avgEngagement}</div>
            <div className="kpi-description">Comments + Upvotes</div>
          </div>
        </div>

        {/* First Row */}
        <div className="content-grid">
          {/* Trending Posts */}
          <div className="white-card">
            <div className="section-header">
              <div className="color-bar"></div>
              <h2 className="section-title">Trending Posts (Last 24h)</h2>
            </div>
            <div>
              {trendingPosts.map((post, index) => (
                <div key={index} className="trending-post">
                  <h3 className="post-title">{post.title}</h3>
                  <div className="post-meta">
                    <span>r/{post.subreddit}</span>
                    <span>{post.score} upvotes</span>
                    <span>{post.comments} comments</span>
                    <span className="positive-sentiment">{post.sentiment}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sentiment Analysis */}
          <div className="white-card">
            <div className="section-header">
              <div className="color-bar"></div>
              <h2 className="section-title">Sentiment Analysis Trends</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sentimentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Second Row */}
        <div className="content-grid">
          {/* Subreddit Performance */}
          <div className="white-card">
            <div className="section-header">
              <div className="color-bar"></div>
              <h2 className="section-title">Subreddit Performance</h2>
            </div>
            <div>
              {subredditPerformance.map((subreddit, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '12px 0',
                  borderBottom: index !== subredditPerformance.length - 1 ? '1px solid #f3f4f6' : 'none'
                }}>
                  <div style={{ fontWeight: '500', color: '#111827' }}>{subreddit.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px', color: '#6b7280' }}>
                    <span>{subreddit.posts} posts</span>
                    <span>{subreddit.comments.toLocaleString()} comments</span>
                    <span>Avg: {subreddit.avgScore} score</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="white-card">
            <div className="section-header">
              <div className="color-bar"></div>
              <h2 className="section-title">Activity Heatmap</h2>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityHeatmap}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="time" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <Bar dataKey="activity" fill="#ea580c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Third Row */}
        <div className="content-grid">
          {/* Post Volume Over Time */}
          <div className="white-card">
            <div className="section-header">
              <div className="color-bar"></div>
              <h2 className="section-title">Post Volume Over Time</h2>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <Line 
                  type="monotone" 
                  dataKey="posts" 
                  stroke="#ea580c" 
                  strokeWidth={3}
                  dot={{fill: '#ea580c', strokeWidth: 2, r: 4}}
                />
                <Line 
                  type="monotone" 
                  dataKey="comments" 
                  stroke="#f97316" 
                  strokeWidth={3}
                  dot={{fill: '#f97316', strokeWidth: 2, r: 4}}
                />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginTop: '16px', fontSize: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#ea580c', borderRadius: '2px', marginRight: '8px' }}></div>
                <span>Posts</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#f97316', borderRadius: '2px', marginRight: '8px' }}></div>
                <span>Comments</span>
              </div>
            </div>
          </div>

          {/* Top Performing Subreddits */}
          <div className="white-card">
            <div className="section-header">
              <div className="color-bar"></div>
              <h2 className="section-title">Top Performing Subreddits</h2>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '16px' }}>
              {pieChartData.map((item, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                  <div 
                    style={{ 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '2px', 
                      marginRight: '8px',
                      backgroundColor: item.color
                    }}
                  ></div>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;