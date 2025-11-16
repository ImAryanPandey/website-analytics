import express from "express";
import { MongoClient } from "mongodb";

const app = express();
app.use(express.json());

const client = new MongoClient("mongodb://localhost:27017");
await client.connect();
const db = client.db("analyticsDB");
const eventsCollection = db.collection("events");
console.log("Reporting API connected to MongoDB");

app.get("/stats", async (req, res) => {
  const { site_id, date } = req.query;

  if (!site_id || !date) {
    return res.status(400).json({
      error: "site_id and date are required",
    });
  }

  const startDate = new Date(date);
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);

  try {
    const pipeline = [
      {
        $match: {
          site_id: site_id,
          timestamp: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $facet: {
          total_views: [{ $count: "count" }],
          unique_users: [{ $group: { _id: "$user_id" } }, { $count: "count" }],
          top_paths: [
            { $group: { _id: "$path", views: { $sum: 1 } } },
            { $sort: { views: -1 } },
            { $limit: 3 },
            { $project: { _id: 0, path: "$_id", views: "$views" } },
          ],
        },
      },
    ];

    const results = await eventsCollection.aggregate(pipeline).toArray();

    const stats = results[0];

    const formattedResponse = {
      site_id: site_id,
      date: date,
      total_views: stats.total_views[0]?.count || 0,
      unique_users: stats.unique_users[0]?.count || 0,
      top_paths: stats.top_paths,
    };

    res.status(200).json(formattedResponse);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
        error: 'Error fetching stats'
    });
  }
});

app.listen(3001, () => {
  console.log('Reporting API (Service 3) listening on port 3001');
});
