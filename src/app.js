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

const currentDate = dayjs(); //Data atual
const currentTime = currentDate.format('HH:mm:ss'); //Data no formato correto


app.post("/participants", async (req, res) => {
    try {

        const { name } = req.body;

        const userSchema = Joi.object({
            name: Joi.string().required()
        });

        const { error } = userSchema.validate(req.body);

        if (error) return res.sendStatus(422);
        
        const searchUsers = await db.collection("participants").find({ name }).toArray()

        if (searchUsers.length > 0) return res.sendStatus(409);
        
        const newUser = { name, lastStatus: Date.now() };
        const newMessage = { from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: currentTime };

        await db.collection("participants").insertOne(newUser);
        await db.collection("messages").insertOne(newMessage);

        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }
});
app.get("/participants", async (req, res) => {
    try {
        const allParticipants = await db.collection("participants").find().toArray()
        res.send(allParticipants);
    } catch (err) {
        res.status(500).send(err.message);
    }

});

app.post("/messages", async (req, res) => {
    try {
        const { to, text, type } = req.body;
        const { User } = req.headers;

        const messageSchema = Joi.object({
            from: Joi.string().required(),
            to: Joi.string().required(),
            text: Joi.string().required(),
            type: Joi.string().valid("message", "private_message").required()
        });

        const { error } = messageSchema.validate(req.body);

        if (error) return res.status(422).send("Campos inválidos");

        const userFromMessage = await db.collection("messages").find({ from: User }).toArray()
        
        if (userFromMessage.length === 0) return res.status(422).send("Usuário remetente não existe");

        const sendMessage = { from: User, to, text, type, time: currentTime };

        await db.collection("messages").insertOne(sendMessage);

        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }

});
app.get("/messages", async (req, res) => {
    try {

        const { limit } = req.query;
        const { User } = req.headers;

        if (Math.sign(limit) !== 1) res.sendStatus(422);

        const searchMessages = await db.collection("messages").find({ $or: [{ type: "message" }, { to: "Todos" }, { to: User }, { from: User }] }).toArray()

        res.send(!limit ? searchMessages : searchMessages.slice(-limit));
    } catch (err) {
        res.status(500).send(err.message);
    }

});
app.post("/status", (req, res) => {

});

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));