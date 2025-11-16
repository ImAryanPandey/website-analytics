import express from 'express';
import {Queue} from 'bullmq';

const app = express();

app.use(express.json());

const eventQueue = new Queue('analytics-events', {
    connection: {
        host: 'localhost',
        port: 6379
    }
});

app.post('/event', async (req, res) => {
    const { site_id, event_type, path, user_id, timestamp } = req.body;

    if(!site_id || !event_type){
        return res.status(400).json({
            error: 'site_id and event_type are required'
        });
    }

    try {
        await eventQueue.add('new-event-job', req.body);

        res.status(202).json({ message: 'Event received' });
    } catch (error) {
        console.error('Error adding event to queue:', error);
        res.status(500).json({
            error: 'Internal server error while queuing event'
        });
    }
} );

app.listen(3000, () => {
    console.log('Ingestion API listening on port 3000');
})