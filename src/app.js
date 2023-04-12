import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import Joi from "joi";

const app = express();

app.use(cors());
app.use(express.json());
dotenv.config();


let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

const now = dayjs(); //Data atual
const currentTime = now.format('HH:mm:ss'); //Data no formato correto


app.post("/participants", async (req, res) => {
    try {

        const { name } = req.body;

        const userSchema = Joi.object({
            name: Joi.string().required()
        })
        const { error } = userSchema.validate(req.body);

        if (error) {
            return res.sendStatus(422);
        }

        const searchUsers = await db.collection("participants").find({ name }).toArray()
        
        if(searchUsers.length > 0) {
            return res.sendStatus(409);
        }

        const newUser = { name, lastStatus: Date.now() };
        const newMessage = { from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: currentTime };

        await db.collection("participants").insertOne(newUser);
        await db.collection("messages").insertOne(newMessage);

        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }
});
app.get("/participants", (req, res) => {

    db.collection("participants").find().toArray()
        .then(participants => res.send(participants))
        .catch(err => res.status(500).send(err.message))

});

app.post("/messages", async (req, res) => {
    try {
        const { to, text, type } = req.body;
        const { User } = req.headers;

        const sendMessage = { from: User, to, text, type, time: currentTime };

        await db.collection("messages").insertOne(sendMessage);

        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }

});
app.get("/messages", (req, res) => {

    const { limit } = req.query;
    const { user } = req.headers;

    if (Math.sign(limit) !== 1) {
        res.sendStatus(422);
    } else {
        db.collection("messages").find({ $or: [{ type: "message" }, { to: "Todos" }, { to: user }, { from: user }] }).toArray()
            .then(messages => res.send(!limit ? messages : messages.slice(-limit)))
            .catch(err => res.status(500).send(err.message))
    }

});
app.post("/status", (req, res) => {

});

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));