const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

    // user api 
    app.post('/users', async(req, res) => {
      const user = req.body
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })


    //menu api
    app.get("/menu", async (req, res) => {
      const result = await heavenlyFeastMenuCollection.find().toArray();
      res.send(result);
    });

    // reviewCollection
    app.get("/review", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // add to cart api 
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await addToCartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const query = { id: item.id };
      try {
        const findItem = await addToCartCollection.find(query).toArray();
        if (findItem.length === 0) {
          const result = await addToCartCollection.insertOne(item);
          res.send(result);
        } else {
          res.send([]);
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
