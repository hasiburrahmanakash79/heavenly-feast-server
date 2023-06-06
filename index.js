const express = require("express");
const cors = require("cors");
jwt = require('jsonwebtoken');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


// JWT token verify 
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization
  if(!authorization){
    return res.status(401).send({ error: true, message: 'unauthorized access'})
  }
  //bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
    if(err){
      return res.status(401).send({ error: true, message: 'unauthorized access'})
    }
    req.decoded = decoded;
    // console.log("verify jwt", req.decoded);
    next()
  })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xvcivem.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("heavenlyFeast").collection("users");
    const heavenlyFeastMenuCollection = client
      .db("heavenlyFeast")
      .collection("menu");
    const reviewCollection = client.db("heavenlyFeast").collection("review");
    const addToCartCollection = client.db("heavenlyFeast").collection("addToCart");

    //JWT
    app.post('/jwt',  async(req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.JWT_TOKEN , { expiresIn: '7d' })
      res.send({token})
    })

    const verifyAdmin = async(req, res, next) => {
      // console.log("verify admin:", req);
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query)
      if(user?.role !== 'admin'){
        return res.status(403).send({error: true, message: "You are not admin"})
      }
      next();
    }

    // user api 
    app.get('/users', verifyJWT, verifyAdmin, async(req, res) =>{
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.post('/users', async(req, res) => {
      const user = req.body
      const query = {email: user.email}
      const existingUser = await usersCollection.findOne(query)
      if(existingUser){
        return res.send([])
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })


    // verifyJWT, match email, & check admin 
    app.get('/users/admin/:email', verifyJWT, async(req, res) => {
      const email = req.params.email;

      if(req.decoded.email !== email){
        res.send({admin: false})
      }

      const query = {email: email}
      const user = await usersCollection.findOne(query)
      const result = {admin: user?.role === 'admin'}
      res.send(result)
    })

    // make admin
    app.patch('/users/admin/:id', async(req, res) => {
      const id = req.params.id;
      const filterId = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filterId, updateDoc)
      res.send(result)
    })


    //menu api
    app.get("/menu", async (req, res) => {
      const result = await heavenlyFeastMenuCollection.find().toArray();
      res.send(result);
    });

    app.post("/menu", verifyJWT, verifyAdmin, async(req, res) => {
      const newItem = req.body
      const result = await heavenlyFeastMenuCollection.insertOne(newItem)
      res.send(result)
    })

    // reviewCollection
    app.get("/review", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // add to cart api 
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error: true, message: 'no access'})
      }

      const query = { email: email };
      const result = await addToCartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const query = { id: item.id, email: item.email};
      try {
        const findItem = await addToCartCollection.find(query).toArray();
        if (findItem.length === 0) {
          const result = await addToCartCollection.insertOne(item);
          res.send(result);
        } else {
          res.send(["you have all ready added"]);
        }
      } catch (error) {
        console.log(error);
      }
    });

    // delete add to cart 
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await addToCartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Heavenly Feast restaurant");
});

app.listen(port, () => {
  console.log(`Heavenly Feast restaurant is running on port ${port}`);
});
