import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

require('dotenv').config({ path: '.env.local' });
const mongoDBURI = process.env.MONGO_DB_URI;
if (!mongoDBURI) {
  throw new Error('MongoDB URI is not defined in .env.local');
}

const app = express();
const port = 3000;

// Daily Rate Limiter: 1000 requests per day
const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1000,
  message: 'You have exceeded the 1000 requests in 24 hours limit!', 
  headers: true,
});

const shortTermLimiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: 1,
  message: 'You have exceeded the 5 seconds rate limit!', 
  headers: true,
});

// Enable CORS
app.use(cors());

app.use(express.json());

app.use(dailyLimiter);

app.use('/machinedata', (req, res, next) => {
  if (req.method === 'DELETE' || req.method === 'PUT' || req.method === 'POST') {
    shortTermLimiter(req, res, next);
  } else {
    next();
  }
});

mongoose.connect(mongoDBURI);


const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

const machineDataSchema = new mongoose.Schema({
  serialNumber: String,
  name: String,
  isWorking: Boolean,
  
  specifications: {
    weight: Number,
    dimensions: String
  },
  maintenanceHistory: [{
    date: Date,
    description: String
  }]
});

const MachineDataModel = mongoose.model('MachineData', machineDataSchema);

app.get('/', (req:express.Request, res:express.Response) => {
  res.send('Welcome to your Express app with Machine Data');
});

// GET endpoint to retrieve all machine data
app.get('/machinedata', async (req:express.Request, res:express.Response) => {
  try {
    const machineData = await MachineDataModel.find();
    res.json({ machineData });
  } catch (error) {
    console.error('Error fetching machine data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST endpoint to create new machine data
app.post('/machinedata', async (req:express.Request, res:express.Response) => {
  try {
    const { serialNumber, name, isWorking, specifications, maintenanceHistory } = req.body;

    if (!serialNumber || !name || isWorking === undefined) {
      res.status(400).json({ error: 'Fields missing in the request.' });
    } else {
      const newMachineData = new MachineDataModel({ serialNumber, name, isWorking, specifications, maintenanceHistory });
      await newMachineData.save();
      res.json({ message: 'Machine data created successfully', machineData: newMachineData });
    }
  } catch (error) {
    console.error('Error creating machine data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE endpoint to delete machine data by serialNumber
app.delete('/machinedata/:serialNumber', async (req:express.Request, res:express.Response) => {
  try {
    const serialNumber = req.params.serialNumber;
    const machineData = await MachineDataModel.findOneAndDelete({ serialNumber: serialNumber });

    if (!machineData) {
      res.status(404).json({ error: 'Machine data not found' });
    } else {
      res.json({ message: 'Machine data deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting machine data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
//PUT endpoint to change working status and maintenance log
app.put('/machinedata/:serialNumber', async (req:express.Request, res:express.Response) => {
  const serialNumber = req.params.serialNumber;
  const { isWorking } = req.body;

  try {
    const updatedMachineData = await MachineDataModel.findOneAndUpdate(
      { serialNumber: serialNumber },
      {
        $set: { isWorking: isWorking },
        $push: { 
          maintenanceHistory: {
            date: new Date(),
            description: isWorking ? "Machine is now Working" : "Machine is not working"
          }
        }
      },
      { new: true }
    );

    if (!updatedMachineData) {
      res.status(404).json({ error: 'Machine data not found' });
    } else {
      res.json(updatedMachineData);
    }
  } catch (error) {
    console.error('Error updating machine data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
