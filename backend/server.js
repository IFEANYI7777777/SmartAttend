const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000;

const employees = [
  {
    id: 1,
    name: "Ifeanyi Test",
    section: "Sports",
    pin: "1234",
  },
];

app.get("/api/health", (req, res) => {
  res.json({
    message: "SmartAttend backend is running",
  });
});

app.get("/api/employees", (req, res) => {
  res.json(employees);
});

app.post("/api/employees", (req, res) => {
  const { name, section, pin } = req.body;

  if (!name || !section || !pin) {
    return res.status(400).json({
      message: "Name, section and PIN are required",
    });
  }

  const newEmployee = {
    id: employees.length + 1,
    name,
    section,
    pin,
  };

  employees.push(newEmployee);

  res.status(201).json({
    message: "Employee registered successfully",
    employee: newEmployee,
  });
});

app.listen(PORT, () => {
  console.log(`SmartAttend backend running on http://localhost:${PORT}`);
});