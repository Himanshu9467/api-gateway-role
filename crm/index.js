const express = require("express");

const app = express();

app.use(express.json());

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    service: "crm",
    status: "UP"
  });
});

// Mock CRM route
app.get("/", (req, res) => {
  res.json({
    message: "CRM service is running"
  });
});

// Mock client creation
app.post("/clients", (req, res) => {
  const client = req.body;

  console.log("CRM received client:", client);

  res.status(201).json({
    success: true,
    service: "crm",
    client
  });
});

app.listen(3003, () => {
  console.log("CRM service running on port 3003");
});