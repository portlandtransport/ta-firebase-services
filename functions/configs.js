const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const https = require("https");

const db = admin.firestore();

/**
 * remap individual URL to https
 * @param {string} url individual url
 * @return {string} modified url
 */
function remapUrlToHttps(url) {
  let newUrl = url.replace("http://dev.transiboard.com", "https://dev.transitboard.com");
  newUrl = newUrl.replace("http://transitboard.com", "https://transitboard.com");
  newUrl = newUrl.replace("http://alt1.transitboard.com/", "https://d3e69nqsg1tckh.cloudfront.net/");
  return newUrl;
}

/**
 * remap URL structure to https
 * @param {object} configurations url structure
 * @return {object} modified url structure
 */
function remapConfigUrlsToHttps(configurations) {
  const newConfig = {};
  newConfig.url = remapUrlToHttps(configurations.url);
  newConfig.urls = [];
  configurations.urls.forEach(function(element) {
    const newElement = {};
    if (element.app_url) {
      newElement.app_url = remapUrlToHttps(element.app_url);
    }
    if (element.img_url) {
      newElement.img_url = remapUrlToHttps(element.img_url);
    }
    newConfig.urls.push(newElement);
  });
  return newConfig;
}

// configuration functions

const configs = express();
configs.use(cors({origin: true}));

// read config
configs.get("/configuration/:item_id", (req, res) => {
  cors()(req, res, () => {
    (async function() {
      try {
        const document = db.collection("configs").doc(req.params.item_id);
        const item = await document.get();
        if (item.exists) {
          const response = item.data();
          if ({}.hasOwnProperty.call(response, "value")) {
            const value = response["value"];
            if ({}.hasOwnProperty.call(value, "external_configuration")) {
              return res.status(200).
                  send(remapConfigUrlsToHttps(value.external_configuration));
            } else {
              return res.status(404)
                  .send({"error": "No matching configuration found",
                    "source": "firestore"});
            }
          } else {
            return res.status(404)
                .send({"error": "No matching configuration found",
                  "source": "firestore"});
          }
        } else {
          return res.status(404)
              .send({"error": "No matching configuration found",
                "source": "firestore"});
        }
      } catch (error) {
        console.log(error);
        return res.status(500).send(error);
      }
    })();
  });
});

configs.get("/configs/copyAll", (req, res) => {
  console.log("starting replication of configs from CouchDB to Firebase");
  let data = "";
  const options = {
    hostname: "68d011c8-fd22-4ad8-8471-c8b4d1729f90-bluemix.cloudant.com",
    port: 443,
    path: "/ta_config_production/_design/ta_config_production/_view/all",
    method: "GET",
  };
  let batchCount = 0;
  let updateCount = 0;
  let batchSeq = 0;
  let batch = db.batch();
  const request = https.request(options, (response) => {
    response.on("data", (d) => {
      data += d;
    });
    response.on("end", async () => {
      console.log("Response ended");
      const raw = JSON.parse(data);
      const configurations = raw.rows;
      for (const val of configurations) {
        updateCount++;
        batchCount++;
        const docRef = db.collection("configs").doc(val.id);
        batch.set(docRef, val);
        if (batchCount >= 100) {
          await batch.commit().then(function(response) {
            console.log("batch write success on batch "+
                batchSeq+", "+batchCount+" items");
          }).catch(function(error) {
            console.log("batch write error on batch "+
                batchSeq+" "+error);
          });
          batchCount = 0;
          batchSeq++;
          batch = db.batch();
        }
      }
      if (batchCount > 0) {
        await batch.commit().then(function(response) {
          console.log("batch write success on batch "+
              batchSeq+", "+batchCount+" items");
        }).catch(function(error) {
          console.log("batch write error on batch "+
              batchSeq+" "+error);
        });
      }
      return res.status(200).send("wrote "+updateCount+" configurations");
    });
  });
  request.on("error", (e) => {
    console.error(e.message);
  });
  request.end();
  return null;
});

exports.configs = functions.region("us-central1").https.onRequest(configs);
