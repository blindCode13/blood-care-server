require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require('firebase-admin');
const port = process.env.PORT || 3000;
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf-8');

const serviceAccount = JSON.parse(decoded)
  admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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

const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'Unauthorized Access!' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).send({ message: 'Unauthorized Access!', err });
  }
}

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

        const verifyADMIN = async (req, res, next) => {
          const email = req.tokenEmail;
          const user = await usersCollection.findOne({ email });
            if (user?.role !== 'admin')
              return res
                .status(403)
                .send({ message: 'Admin only Actions!', role: user?.role });
              next();
          }


        //
        app.get("/users/check-status/:email", async (req, res) => {
          const result = await usersCollection.findOne({email: req.params.email}, {projection: {status: 1, _id: 0}});
          res.send(result);
        });


        //
        app.get("/application-stats", verifyJWT, async (req, res) => {
          const totalUsers = await usersCollection.countDocuments();
          const totalDonationRequest = await donationReqCollection.countDocuments();
          res.send({totalUsers, totalDonationRequest}); 
        });


        //
        app.get("/bloodType/:email", async (req, res) => {
          const email = req.params.email
          const result = await usersCollection.findOne({email}, {projection: {bloodGroup: 1, _id: 0}});
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
        app.get("/users/donors", async (req, res) => {
          const currentUser = req.query.currentUser;
          const {blood, district, upazila} = req.query;
          const searchFilter = {};
          if (blood !== 'all') searchFilter.bloodGroup = blood;
          if (district) searchFilter.district = district;
          if (upazila) searchFilter.upazila = upazila;
          if (currentUser) searchFilter.email = {$ne: currentUser};

          const result = await usersCollection.find({...searchFilter, role: 'donor'}).toArray();
          res.send(result);
        });


        //
        app.get("/users/:email", verifyJWT, async (req, res) => {
          const email = req.params.email;
          const result = await usersCollection.findOne({email});
          res.send(result);
        });


        //
        app.patch("/users/update/:email", verifyJWT, async (req, res) => {
          const email = req.params.email;
          const {name, avatar, bloodGroup, district, upazila} = req.body;

          const result = await usersCollection.updateOne({email}, {$set: {name, avatar, bloodGroup, district, upazila}});
          res.send(result);
        });


        //
        app.get("/users", verifyJWT, verifyADMIN, async (req, res) => {
          const result = await usersCollection.find({email: {$ne: req.tokenEmail}}).toArray();
          res.send(result);
        });


        //
        app.patch("/users/block/:id", verifyJWT, verifyADMIN, async (req, res) => {
          const id = req.params.id;
          const result = await usersCollection.updateOne({_id: new ObjectId(id)}, {$set: {status: 'blocked'}});
          res.send(result);
        });


        //
        app.patch("/users/unblock/:id", verifyJWT, verifyADMIN, async (req, res) => {
          const id = req.params.id;
          const result = await usersCollection.updateOne({_id: new ObjectId(id)}, {$set: {status: 'active'}});
          res.send(result);
        });


        //
        app.patch("/users/make-volunteer/:id", verifyJWT, verifyADMIN, async (req, res) => {
          const id = req.params.id;
          const result = await usersCollection.updateOne({_id: new ObjectId(id)}, {$set: {role: 'volunteer'}});
          res.send(result);
        });


        //
        app.patch("/users/make-admin/:id", verifyJWT, verifyADMIN, async (req, res) => {
          const id = req.params.id;
          const result = await usersCollection.updateOne({_id: new ObjectId(id)}, {$set: {role: 'admin'}});
          res.send(result);
        });


        //
        app.get('/user/role', verifyJWT, async (req, res) => {
          const result = await usersCollection.findOne({ email: req.tokenEmail });
          res.send({ role: result?.role });
        });


        //
        app.post("/donation-requests", verifyJWT, async (req, res) => {
          const requestData = req.body;
          if (requestData.donorEmail) {
            requestData.donationStatus = "inprogress";
          } else { requestData.donationStatus = "pending"; }
          requestData.createdAt = new Date().toISOString();
          requestData.updatedAt = new Date().toISOString();

          const result = await donationReqCollection.insertOne(requestData);
          res.send(result);
        });


        //
        app.get("/donation-requests/public", async (req, res) => {
          const result = await donationReqCollection.find({donationStatus: 'pending'}).toArray();
          res.send(result);
        });


        //
        app.get("/donation-requests", verifyJWT, async (req, res) => {
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
          if (statusFilterQuery) {
            const result = await donationReqCollection.find({donationStatus: statusFilterQuery}).toArray();
            return res.send(result);
          }

          const result = await donationReqCollection.find().toArray();
          res.send(result);
        });


        //
        app.get("/donations", verifyJWT, async (req, res) => {
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
        app.patch("/update-donation-status/:id", verifyJWT, async (req, res) => {
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
        app.patch("/donation-requests/edit/:id", verifyJWT, async (req, res) => {
          
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
        app.delete("/donation-requests/delete/:id", verifyJWT, async (req, res) => {
          const email = req.query.email;

          if (email !== req.tokenEmail) {
            return res.status(403).send({ message: 'Forbidden Access'});
          }

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