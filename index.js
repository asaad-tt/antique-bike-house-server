const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;

require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xz8clof.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// ==========jwt middleware start point ==========
function verifyJWT(req, res, next) {
  console.log("our-token", req.headers.authorization);
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}
// ==========jwt middleware end point ==========

async function run() {
  try {
    // -------collection start ------

    const categoriesCollection = client
      .db("antiqueBike")
      .collection("categories");
    const productsCollection = client.db("antiqueBike").collection("products");
    const bookingsCollection = client.db("antiqueBike").collection("bookings");
    const usersCollection = client.db("antiqueBike").collection("users");
    const paymentsCollection = client.db("antiqueBike").collection("payments");
    const reportsCollection = client.db("antiqueBike").collection("reports");

    // -----------collection  end ------

    app.get("/categories", async (req, res) => {
      const query = {};
      const result = await categoriesCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/categories/:category", async (req, res) => {
      const category = req.params.category;
      const query = { category: category };
      const result = await productsCollection.find(query).toArray();
      res.send(result);
    });

    //----- booking er data database e send -----------
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    //---------bookings er data database theke get------
    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    //--------payment er jonno booking data get ---------
    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const bookings = await bookingsCollection.findOne(query);
      res.send(bookings);
    });

    //--------JWT er joono api create ----------

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "5h",
        });
        return res.send({ accessToken: token });
      }
      // console.log(user);
      return res.status(403).send({ accessToken: "" });
    });

    //------- user er data database a save-----------
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // ------new added products sent to database-------
    app.post("/products", async (req, res) => {
      const product = req.body;
      console.log(product);
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    // seller get my products
    app.get("/products", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });

    // seller can delete any of his product
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    // ----------get all seller------------
    app.get("/buyerseller", async (req, res) => {
      const role = req.query.role;
      const query = { role: role };
      const seller = await usersCollection.find(query).toArray();
      res.send(seller);
    });

    //------ admin can delete any seller or buyer ------
    app.delete("/buyerseller/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // --------------- stripe ---------------------------
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await bookingsCollection.updateOne(
        filter,
        updatedDoc
      );

      res.send(result);
    });

    // ---------- Admin api create ----------
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = { email };
      const user = await usersCollection.findOne(query);
      console.log(user);
      res.send({ isAdmin: user?.role === "admin" });
    });

    // ---------- only Seller api create ----------
    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = { email };
      const user = await usersCollection.findOne(query);
      console.log(user);
      res.send({ isSeller: user?.role === "seller" });
    });
    // ---------- only buyer api create ----------
    app.get("/users/buyer/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = { email };
      const user = await usersCollection.findOne(query);
      console.log(user);
      res.send({ isBuyer: user?.role === "buyer" });
    });

    // ------------seller verify api -----------
    app.put("/verifySeller/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          isVerified: true,
        },
      };

      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );

      const updateProduct = await productsCollection.updateMany(
        filter,
        updatedDoc,
        options
      );

      res.send(result);
    });

    // ==========report to admin =======================
    // post report
    app.post("/reports", async (req, res) => {
      const reportData = req.body;
      const result = await reportsCollection.insertOne(reportData);
      res.send(result);
    });

    //------ get report data for client side-------
    app.get("/reportedProducts", async (req, res) => {
      const query = {};
      const result = await reportsCollection.find(query).toArray();
      res.send(result);
    });

    // ---------Delete data by admin----------
    app.delete("/reportedProducts/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await reportsCollection.deleteOne(filter);
      res.send(result);
    });
    //========== end point ===========
  } finally {
  }
}
run().catch((error) => console.log(error));

app.get("/", async (req, res) => {
  res.send("Antique bike house server is running");
});

app.listen(port, () => {
  console.log(`Antique bike house  running on ${port}`);
});
