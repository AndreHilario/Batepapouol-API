import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

app.post("/participants", (req, res) => {
    
});
app.get("/participants", (req, res) => {
    
});
app.post("/messages", (req, res) => {
    
});
app.get("/messages", (req, res) => {
    
});
app.post("/status", (req, res) => {

});

const PORT = 5000;
app.listen(PORT, () => console.log(`API Bate papouol funcionando na porta ${PORT}`));