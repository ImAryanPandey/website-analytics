import { Worker } from "bullmq";
import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017");
await client.connect();
const db = client.db("analyticsDB");
const eventsCollection = db.collection("events");
console.log("Processor Connected to MongoDB");

console.log('Processor (Service 2) connecting to Redis...');

const worker = new Worker('analytics-events', async (job) => {
    const eventData = job.data;

    try {
        await eventsCollection.insertOne({
            ...eventData,
            timestamp: new Date(eventData.timestamp)
        });
        console.log(`[Processor] Successfully saved event for site: ${eventData.site_id}`);
    } catch (error) {
        console.error('[Processor] Failed to process/save event', error);
        throw error;
    }
}, {
    connection: {
        host: 'localhost',
        port: 6379
    }
});

worker.on('completed', (job) => {
    console.log(`[Processor] Job ${job.id} has completed.`);
});

worker.on('failed', (job, err) => {
  console.error(`[Processor] Job ${job.id} failed with ${err.message}`);
});

console.log('Processor (Service 2) is running and waiting for jobs...');
