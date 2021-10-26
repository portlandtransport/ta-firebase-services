const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors({ origin: true }));

const firebaseConfig = {
    apiKey: "AIzaSyBrzrK7tcSmV-XqbdZj5uBhiZAcMx3FsQ4",
    authDomain: "transit-appliance-config.firebaseapp.com",
    projectId: "transit-appliance-config",
    storageBucket: "transit-appliance-config.appspot.com",
    messagingSenderId: "881008083854",
    appId: "1:881008083854:web:464b10e392bd097f2edadf",
    measurementId: "G-SDYPNVDTPJ"
  };

var serviceAccount = require('../serviceAccount.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: firebaseConfig.databaseURL
});
const db = admin.firestore();

app.get('/hello-world', (req, res) => {
  return res.status(200).send('Hello World!');
});

// read stop
app.get('/stop/:item_id', (req, res) => {
    (async () => {
        try {
            const document = db.collection('stops').doc(req.params.item_id);
            let item = await document.get();
            let response = item.data();
            return res.status(200).send(response);
        } catch (error) {
            console.log(error);
            return res.status(500).send(error);
        }
        })();
    });

exports.app = functions.https.onRequest(app);