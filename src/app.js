import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import Joi from "joi";

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();

// Conectando MongoDB com async/await
const mongoClient = new MongoClient(process.env.DATABASE_URL);
try {
    await mongoClient.connect();
    console.log("MongoDB conectado!");
} catch (err) {
    console.log(err.message);
}
const db = mongoClient.db();

const currentDate = dayjs(); //Data atual
const currentTime = currentDate.format('HH:mm:ss'); //Data no formato correto

async function checkLoggedUser() {
    const timeStatus = Date.now() - 10000;
    const userToBeDeleted = await db.collection("participants").findOne({ lastStatus: { $lt: timeStatus } });
    if (userToBeDeleted) {
        const removedUser = { from: userToBeDeleted.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: currentTime };
        await db.collection("participants").deleteOne({ _id: userToBeDeleted._id });
        await db.collection("messages").insertOne(removedUser);
        console.log(`Usuário ${userToBeDeleted.name} removido`);
    }
}

setInterval(checkLoggedUser, 15000);

app.post("/participants", async (req, res) => {
    const { name } = req.body;
    const userSchema = Joi.object({
        name: Joi.string().required()
    });
    const { error } = userSchema.validate(req.body);
    if (error) return res.sendStatus(422);
    try {
        const searchUsers = await db.collection("participants").find({ name }).toArray()
        if (searchUsers.length > 0) return res.sendStatus(409);
        const newUser = { name, lastStatus: Date.now() };
        const newMessage = { from: name, to: "Todos", text: "entra na sala...", type: "status", time: currentTime };
        await db.collection("participants").insertOne(newUser);
        await db.collection("messages").insertOne(newMessage);
        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get("/participants", async (req, res) => {
    try {
        const allParticipants = await db.collection("participants").find().toArray();
        res.send(allParticipants);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;
    function verifyBody(req) {
        if (req.body) {
            return { ...req.body, from: user };
        }
        return req;
    }
    const newBody = verifyBody(req);
    const messageBodySchema = Joi.object({
        from: Joi.string().required(),
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid("message", "private_message").required()
    });
    const { error: errorBody } = messageBodySchema.validate(newBody);
    if (errorBody) return res.status(422).send(errorBody.message);
    try {
        const userFromMessage = await db.collection("messages").find({ from: user }).toArray()
        if (userFromMessage.length === 0) return res.status(422).send("Usuário remetente não existe");
        const sendMessage = { from: user, to, text, type, time: currentTime };
        await db.collection("messages").insertOne(sendMessage);
        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get("/messages", async (req, res) => {
    const { limit } = req.query;
    const { user } = req.headers;
    const limitSchema = Joi.number()
        .integer()
        .min(1)
        .required();
    try {
        const searchMessages = await db.collection("messages").find
            ({
                $or: [
                    { type: "message" },
                    { type: "private_message", to: "Todos" },
                    { type: "private_message", to: user },
                    { type: "private_message", from: user },
                    { type: "status", to: "Todos" }
                ]
            }).toArray();
        if (limit) {
            const { error: errorLimit } = limitSchema.validate(limit);
            if (errorLimit) {
                res.status(422).send(errorLimit.message);
            } else {
                res.send(searchMessages.slice(-limit));
            }
        } else {
            res.send(searchMessages);
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/status", async (req, res) => {
    const { user } = req.headers;
    if (!user) return res.sendStatus(404);
    try {
        const findNewUser = await db.collection("participants").find({ name: user }).toArray();
        if (findNewUser.length === 0) return res.sendStatus(404);
        const refreshedUser = { lastStatus: Date.now() };
        await db.collection("participants").updateOne(
            {name: user},
            {$set: refreshedUser}
        );
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete("/messages/:id", async (req, res) => {
    const { id } = req.params;
    const { user } = req.headers;
    if (!id || !user) return res.status(422).send("User required on header and id on path params");
    try {
        const result = await db.collection("messages").findOne({ _id: new ObjectId(id) });
        if (!result) return res.status(404).send("Message not found");
        if (result.from !== user) return res.status(401).send("Unauthorized");
        await db.collection("messages").deleteOne({ _id: new ObjectId(id) });
        res.status(200).send("Message deleteds with sucess");
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.put("/messages/:id", async (req, res) => {

    const { id } = req.params;
    const { user } = req.headers;
    const { to, text, type } = req.body;

    const editedMessage = {};

    if (to) editedMessage.to = to;
    if (text) editedMessage.text = text;
    if (type) editedMessage.type = type;

    function verifyAgainBody(req) {
        if (req.body) {
            return { ...req.body, from: user };
        }

        return req;
    }

    const newBody = verifyAgainBody(req);

    const messageBodySchema = Joi.object({
        from: Joi.string().required(),
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid("message", "private_message").required()
    });

    const { error: errorBody } = messageBodySchema.validate(newBody);

    if (errorBody) return res.status(422).send(errorBody.message);

    try {
        const userFromMessageChanged = await db.collection("messages").find({ from: user }).toArray();

        if (userFromMessageChanged.length === 0) return res.status(422).send("User does not exist");

        const result = await db.collection("messages").findOne({ _id: new ObjectId(id) });

        if (!result) return res.status(404).send("Message not found");

        if (result.from !== user) return res.status(401).send("Unauthorized");

        await db.collection("messages").updateOne(
            { _id: new ObjectId(id) },
            { $set: editedMessage }
        );

        res.status(200).send("Recipes updated");
    } catch (err) {
        res.status(500).send(err.message);
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));