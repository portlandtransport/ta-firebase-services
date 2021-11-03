const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const https = require("https");
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

app.post("/stop/:item_id", (req, res) => {
  const body = JSON.parse(req.body);
  (async () => {
    try {
      await db.collection("stops").doc(req.params.item_id)
          .set(body);
      return res.status(200).send(JSON.stringify(req));
    } catch (error) {
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

app.get("/stops/updates", (req, res) => {
  let data = "";
  const options = {
    hostname: "transitboard.com",
    port: 443,
    path: "/firebase_stop_updates.json",
    method: "GET",
  };
  const request = https.request(options, (response) => {
    response.on("data", (d) => {
      data += d;
    });
    response.on("close", () => {
      console.log("Response closed");
      const stops = JSON.parse(data);
      let log = "";
      Object.keys(stops.stops).forEach(function(key) {
        const val = stops.stops[key];
        (async () => {
          try {
            await db.collection("stops").doc(key).set(val);
            console.log("updated stop "+key);
            log += "updated stop "+key+"\n";
          } catch (error) {
            console.log("error updating stop "+key);
            log += "error updating stop "+key+"\n";
          }
        })();
      });
      res.status(200).send(log);
    });
  });
  request.on("error", (error) => {
    console.error(error);
    res.status(500).send(error);
  });
  request.end();
});

exports.stops = functions.https.onRequest(app);

exports.scheduledFunctionCrontab = functions.pubsub.schedule("10 12 * * *")
    .timeZone("America/Los_Angeles")
    .onRun((context) => {
      console.log("scheduled job to update TriMet entries");
      let data = "";
      const options = {
        hostname: "transitboard.com",
        port: 443,
        path: "/firebase_stop_updates.json",
        method: "GET",
      };
      const request = https.request(options, (response) => {
        response.on("data", (d) => {
          data += d;
        });
        response.on("close", () => {
          console.log("Response closed");
          const stops = JSON.parse(data);
          Object.keys(stops.stops).forEach(function(key) {
            const val = stops.stops[key];
            (async () => {
              try {
                await db.collection("stops").doc(key).set(val);
                console.log("updated stop "+key);
              } catch (error) {
                console.log("error updating stop "+key);
              }
            })();
          });
        });
      });
      request.end();
      return null;
    });
