import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const API_BASE = process.env.REACT_APP_API_URL || "";

interface Query {
  query: string;
  timestamp: string;
}

interface TopicCount {
  topic: string;
  count: number;
}

const TOPICS = [
  { label: "Parachain", keywords: ["parachain"] },
  { label: "XCM", keywords: ["xcm", "cross-chain", "cross chain"] },
  { label: "Staking", keywords: ["staking", "stake", "validator"] },
  { label: "Pallet", keywords: ["pallet", "substrate", "frame"] },
  { label: "Accounts", keywords: ["account", "wallet", "address"] },
  { label: "Governance", keywords: ["governance", "voting", "referendum"] },
  { label: "Kusama", keywords: ["kusama"] },
  { label: "Code Gen", keywords: ["[code]"] },
];

function categorize(queries: Query[]): TopicCount[] {
  return TOPICS.map((topic) => ({
    topic: topic.label,
    count: queries.filter((q) =>
      topic.keywords.some((k) =>
        q.query.toLowerCase().includes(k)
      )
    ).length,
  })).sort((a, b) => b.count - a.count);
}

const COLORS = [
  "#e6007a",
  "#ff4da6",
  "#cc0066",
  "#ff80bf",
  "#990050",
  "#ff1a8c",
  "#b30059",
  "#ff66b3",
];

export default function Dashboard() {
  const [data, setData] = useState<{ queries: Query[]; total: number }>({
    queries: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API_BASE}/friction`);
        setData(res.data);
      } catch {
        console.error("Failed to fetch friction data");
      } finally {
        setLoading(false);
      }
    };
    fetch();
    const interval = setInterval(fetch, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const topicData = categorize(data.queries);
  const recentQueries = [...data.queries]
    .reverse()
    .slice(0, 8)
    .filter((q) => !q.query.startsWith("[CODE]"));
  const codeQueries = [...data.queries]
    .reverse()
    .slice(0, 5)
    .filter((q) => q.query.startsWith("[CODE]"));

  if (loading) {
    return (
      <div style={styles.loading}>Loading friction data...</div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Stats Row */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{data.total}</div>
          <div style={styles.statLabel}>Total Queries</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>
            {data.queries.filter((q) => q.query.startsWith("[CODE]")).length}
          </div>
          <div style={styles.statLabel}>Code Generations</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>
            {topicData.find((t) => t.count > 0)?.topic || "—"}
          </div>
          <div style={styles.statLabel}>Top Pain Point</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>
            {topicData.filter((t) => t.count > 0).length}
          </div>
          <div style={styles.statLabel}>Topic Clusters</div>
        </div>
      </div>

      {/* Chart + Recent */}
      <div style={styles.mainRow}>
        {/* Bar Chart */}
        <div style={styles.chartCard}>
          <div style={styles.cardTitle}>🔥 Developer Friction Map</div>
          <div style={styles.cardSubtitle}>
            Where developers get stuck most in the Polkadot ecosystem
          </div>
          {data.total === 0 ? (
            <div style={styles.empty}>
              No data yet — ask some questions in the chat!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topicData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="topic"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#13131f",
                    border: "1px solid #1e1e2e",
                    borderRadius: "8px",
                    color: "#e2e8f0",
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {topicData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Queries */}
        <div style={styles.recentCard}>
          <div style={styles.cardTitle}>💬 Recent Questions</div>
          <div style={styles.cardSubtitle}>Live feed of developer queries</div>
          <div style={styles.queryList}>
            {recentQueries.length === 0 ? (
              <div style={styles.empty}>No queries yet</div>
            ) : (
              recentQueries.map((q, i) => (
                <div key={i} style={styles.queryItem}>
                  <div style={styles.queryText}>{q.query}</div>
                  <div style={styles.queryTime}>
                    {new Date(q.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Code Gen Queries */}
      {codeQueries.length > 0 && (
        <div style={styles.codeCard}>
          <div style={styles.cardTitle}>⚡ Recent Code Generations</div>
          <div style={styles.cardSubtitle}>
            What developers are trying to build
          </div>
          <div style={styles.codeList}>
            {codeQueries.map((q, i) => (
              <div key={i} style={styles.codeItem}>
                {q.query.replace("[CODE] ", "")}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight */}
      {data.total > 0 && (
        <div style={styles.insightCard}>
          <div style={styles.insightTitle}>💡 Ecosystem Insight</div>
          <div style={styles.insightText}>
            Based on {data.total} developer interactions, the biggest friction
            point in the Polkadot ecosystem is{" "}
            <span style={styles.highlight}>
              {topicData.find((t) => t.count > 0)?.topic || "general onboarding"}
            </span>
            . This suggests documentation and tooling improvements in this area
            would have the highest impact on developer adoption.
          </div>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    padding: "24px",
    overflowY: "auto",
    flex: 1,
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    color: "#64748b",
    fontSize: "14px",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
  },
  statCard: {
    backgroundColor: "#13131f",
    border: "1px solid #1e1e2e",
    borderRadius: "12px",
    padding: "20px",
    textAlign: "center",
  },
  statNumber: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#e6007a",
    marginBottom: "6px",
  },
  statLabel: {
    fontSize: "12px",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  mainRow: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr",
    gap: "16px",
  },
  chartCard: {
    backgroundColor: "#13131f",
    border: "1px solid #1e1e2e",
    borderRadius: "12px",
    padding: "20px",
  },
  recentCard: {
    backgroundColor: "#13131f",
    border: "1px solid #1e1e2e",
    borderRadius: "12px",
    padding: "20px",
    overflowY: "auto",
    maxHeight: "380px",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: "4px",
  },
  cardSubtitle: {
    fontSize: "12px",
    color: "#64748b",
    marginBottom: "16px",
  },
  queryList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  queryItem: {
    backgroundColor: "#0a0a0f",
    border: "1px solid #1e1e2e",
    borderRadius: "8px",
    padding: "10px 12px",
  },
  queryText: {
    fontSize: "13px",
    color: "#e2e8f0",
    marginBottom: "4px",
  },
  queryTime: {
    fontSize: "11px",
    color: "#64748b",
  },
  codeCard: {
    backgroundColor: "#13131f",
    border: "1px solid #1e1e2e",
    borderRadius: "12px",
    padding: "20px",
  },
  codeList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  codeItem: {
    padding: "8px 14px",
    borderRadius: "20px",
    border: "1px solid #e6007a44",
    backgroundColor: "#1a0a2e",
    color: "#e6007a",
    fontSize: "12px",
  },
  insightCard: {
    backgroundColor: "#1a0a2e",
    border: "1px solid #e6007a44",
    borderRadius: "12px",
    padding: "20px",
  },
  insightTitle: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#e6007a",
    marginBottom: "8px",
  },
  insightText: {
    fontSize: "14px",
    color: "#e2e8f0",
    lineHeight: "1.6",
  },
  highlight: {
    color: "#e6007a",
    fontWeight: "700",
  },
  empty: {
    color: "#64748b",
    fontSize: "13px",
    textAlign: "center",
    padding: "20px",
  },
};