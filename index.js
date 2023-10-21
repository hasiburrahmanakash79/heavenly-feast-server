const express = require("express");
const cors = require("cors");
jwt = require("jsonwebtoken");
const SSLCommerzPayment = require("sslcommerz-lts");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// JWT token verify
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  //bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xvcivem.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// TODO
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false;

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("heavenlyFeast").collection("users");
    const heavenlyFeastMenuCollection = client
      .db("heavenlyFeast")
      .collection("menu");
    const reviewCollection = client.db("heavenlyFeast").collection("review");
    const confirmOrderCollection = client.db("heavenlyFeast").collection("confirmOrder");
    const addToCartCollection = client
      .db("heavenlyFeast")
      .collection("addToCart");

    //JWT
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: "7d" });
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      // console.log("verify admin:", req);
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "You are not admin" });
      }
      next();
    };

    const tran_id = new ObjectId().toString();
    app.post("/order", async (req, res) => {
      const item = await addToCartCollection.findOne({
        _id: new ObjectId(req.body.itemsID),
      });
      const data = {
        total_amount: item?.price,
        currency: req.body?.currency,
        tran_id: tran_id,
        success_url: `http://localhost:5000/payment/success/${tran_id}`,
        fail_url: "http://localhost:3030/fail",
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: item?.name,
        product_category: "Electronic",
        product_profile: item?.image,
        cus_name: req.body?.name,
        cus_email: req.body?.email,
        cus_add1: req.body?.location,
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: req.body?.phone,
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });
        console.log("Redirecting to: ", GatewayPageURL);

        const confirmOrder = {
          item,
          paymentStatus: false,
          transactionId: tran_id,
        };
        const result = confirmOrderCollection.insertOne(confirmOrder)
      });

      app.post('/payment/success/:tranId', async(req, res) =>{
        const result = await confirmOrderCollection.updateOne(
          {transactionId: req.params.tranId},
          {
            $set:{
              paymentStatus: true,
            }
          }
        );
        if((await result).modifiedCount>0){
          res.redirect(`http://localhost:5173/payment/success/${req.params.tranId}`)
        }
      })
    });

    // user api
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send([]);
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // verifyJWT, match email, & check admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // make admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filterId = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filterId, updateDoc);
      res.send(result);
    });

    //menu api
    app.get("/menu", async (req, res) => {
      const result = await heavenlyFeastMenuCollection.find().toArray();
      res.send(result);
    });

    app.post("/menu", verifyJWT, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await heavenlyFeastMenuCollection.insertOne(newItem);
      res.send(result);
    });

    app.delete("/menu/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await heavenlyFeastMenuCollection.deleteOne(query);
      res.send(result);
    });

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
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "no access" });
      }

      const query = { email: email };
      const result = await addToCartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const query = { id: item.id, email: item.email };
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
