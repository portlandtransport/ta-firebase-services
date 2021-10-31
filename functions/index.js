const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors({origin: true}));

const firebaseConfig = require("./config.json");
const serviceAccount = require("./serviceAccount.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: firebaseConfig.databaseURL,
});
const db = admin.firestore();

// read stop
app.get("/stop/:item_id", (req, res) => {
  (async function() {
    try {
      const document = db.collection("stops").doc(req.params.item_id);
      const item = await document.get();
      if (item.exists) {
        const response = item.data();
        return res.status(200).send(response);
      } else {
        return res.status(404).send(req.params.item_id+" not found");
      }
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  })();
});

// read all
app.get("/stops", (req, res) => {
  (async () => {
    try {
      const querySnapshot = await db.collection("stops").get();
      const selectedStops = querySnapshot.docs.map((doc) => doc.data());
      return res.status(200).send(selectedStops);
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  })();
});

app.get("/stops/agency/:agency_id", (req, res) => {
  (async () => {
    try {
      const querySnapshot =
        await db.collection("stops").where(
            "agency", "==", req.params.agency_id,
        ).get();
      const selectedStops = querySnapshot.docs.map((doc) => doc.data());
      return res.status(200).send(selectedStops);
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  })();
});

exports.stops = functions.https.onRequest(app);
