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
        const donationReqCollection = db.collection('donation_requests');


        //
        app.get("/users/check-status/:email", async (req, res) => {
          const result = await usersCollection.findOne({email: req.params.email}, {projection: {status: 1, _id: 0}});
          res.send(result);
        });


        //
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


        //
        app.post("/donation-requests", async (req, res) => {
          const requestData = req.body;
          requestData.donationStatus = "pending";
          requestData.donorName = null
          requestData.donorEmail = null
          requestData.createdAt = new Date().toISOString();
          requestData.updatedAt = new Date().toISOString();

          const result = await donationReqCollection.insertOne(requestData);
          res.send(result);
        });


        //
        app.get("/donation-requests", async (req, res) => {
          const emailQuery = req.query.email;
          const statusFilterQuery = req.query.statusFilter;

          if (emailQuery && statusFilterQuery) {
            const result = await donationReqCollection.find({requesterEmail: emailQuery, donationStatus: statusFilterQuery}).sort({createdAt: -1}).toArray();
            return res.send(result);
          }
          if (emailQuery) {
            const result = await donationReqCollection.find({requesterEmail: emailQuery}).toArray();
            return res.send(result);
          }

          const result = await donationReqCollection.find({donationStatus: statusFilterQuery}).toArray();
          res.send(result);
        });


        //
        app.get("/donations", async (req, res) => {
          const emailQuery = req.query.email;
          const statusFilterQuery = req.query.statusFilter;
          if (emailQuery && statusFilterQuery) {
            const result = await donationReqCollection.find({donorEmail: emailQuery, donationStatus: statusFilterQuery}).sort({createdAt: -1}).toArray();
            return res.send(result);
          }
          if (emailQuery) {
            const result = await donationReqCollection.find({donorEmail: emailQuery}).sort({createdAt: -1}).toArray();
            return res.send(result);
          }
        });


        //
        app.patch("/update-donation-status/:id", async (req, res) => {
          const id = req.params.id;
          const request = req.body;
          const result = await donationReqCollection.updateOne({_id: new ObjectId(id)}, {$set: request});
          res.send(result);
        });


        //
        app.patch("/donate/:id", async (req, res) => {
          const id = req.params.id;
          const {name, email} = req.body;
          const result = await donationReqCollection.updateOne({_id: new ObjectId(id)}, {$set: {donorName: name, donorEmail: email, donationStatus: 'inprogress'}});
          res.send(result);
        });


        //
        app.get("/donation-requests/:id", async (req, res) => {
          const id = req.params.id
          const result = await donationReqCollection.findOne({_id: new ObjectId(id)});
          res.send(result)
        });


        //
        app.patch("/donation-requests/edit/:id", async (req, res) => {
          const id = req.params.id;
          const {
            recipientName, recipientDistrict, recipientUpazila, hospitalName, fullAddress,
            bloodGroup, donationDate, donationTime, requestMessage
            } = req.body;
          const result = await donationReqCollection.updateOne({_id: new ObjectId(id)}, {
            $set: {
              recipientName, recipientDistrict, recipientUpazila, hospitalName, fullAddress,
              bloodGroup, donationDate, donationTime, requestMessage,
              updatedAt: new Date().toISOString()
            }
          });

          res.send(result);
        });


        //
        app.delete("/donation-requests/delete/:id", async (req, res) => {
          const id = req.params.id;
          const result = await donationReqCollection.deleteOne({_id: new ObjectId(id)});
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