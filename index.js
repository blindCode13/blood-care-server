require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;

const app = express();

// middleware
app.use(
  cors({
    origin: [process.env.CLIENT_DOMAIN],
    credentials: true,
    optionSuccessStatus: 200,
  })
);
app.use(express.json());

// mongodb
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


// server entries
async function run() {
    try {
        const db = client.db('bloodCare');
        const usersCollection = db.collection('users');

        app.post("/users", async (req, res) => {
          const userData = req.body;
          userData.role = "donor";
          userData.status = "active";
          userData.createdAt = new Date().toISOString();
          userData.lastLoggedIn = new Date().toISOString();

          const exists = await usersCollection.findOne({email: userData.email});
          if (exists) {
            const result = await usersCollection.updateOne({email: userData.email}, {
              $set: { lastLoggedIn: new Date().toISOString() }
            });
            return res.send(result);
          }
          
          const result = usersCollection.insertOne(userData);
          res.send(result);
        });

        await client.db('admin').command({ ping: 1 })
        console.log('Pinged your deployment. You successfully connected to MongoDB!')
    }
    finally { }
}
run().catch(console.dir);


app.get("/", async (req, res) => {
    res.send("Welcome to BloodCare server!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});