const express = require("express");
const cors = require("cors");
const db = require("./database");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
// Health check
app.get("/api/health", (req, res) => {
  res.json({
    message: "SmartAttend backend is running",
  });
});

// Get all employees
app.get("/api/employees", (req, res) => {
  try {
    const employees = db
      .prepare("SELECT * FROM employees")
      .all();

    res.json(employees);
  } catch (error) {
    console.error("Employee loading error:", error);

    res.status(500).json({
      message: "Could not load employees.",
    });
  }
});

// Register a new employee
app.post("/api/employees", (req, res) => {
  const { name, section, pin } = req.body;

  if (!name || !section || !pin) {
    return res.status(400).json({
      message: "Name, section and PIN are required",
    });
  }

  try {
    const result = db
      .prepare(`
        INSERT INTO employees (name, section, pin)
        VALUES (?, ?, ?)
      `)
      .run(name, section, pin);

    const newEmployee = db
      .prepare("SELECT * FROM employees WHERE id = ?")
      .get(result.lastInsertRowid);

    res.status(201).json({
      message: "Employee registered successfully",
      employee: newEmployee,
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        message: "That PIN is already registered.",
      });
    }

    console.error("Employee registration error:", error);

    res.status(500).json({
      message: "Could not register employee.",
    });
  }
});

// Record employee attendance
app.post("/api/attendance/check-in", (req, res) => {
  const { employeeId } = req.body;

  if (!employeeId) {
    return res.status(400).json({
      message: "Employee ID is required",
    });
  }

  const employee = db
    .prepare("SELECT * FROM employees WHERE id = ?")
    .get(employeeId);

  if (!employee) {
    return res.status(404).json({
      message: "Employee not found",
    });
  }

  const now = new Date();

  const date = now.toISOString().split("T")[0];

  const clockInTime = now.toLocaleTimeString();

  const status = "Present";

  try {
    const result = db
      .prepare(`
        INSERT INTO attendance (
          employee_id,
          date,
          clock_in_time,
          status
        )
        VALUES (?, ?, ?, ?)
      `)
      .run(
        employee.id,
        date,
        clockInTime,
        status
      );

    res.status(201).json({
      message: "Attendance recorded successfully",
      attendance: {
        id: result.lastInsertRowid,
        employeeId: employee.id,
        name: employee.name,
        section: employee.section,
        date: date,
        clockInTime: clockInTime,
        status: status,
      },
    });
  } catch (error) {
    console.error("Attendance check-in error:", error.message);

    // Employee has already checked in today
    if (
      error.code === "SQLITE_CONSTRAINT_UNIQUE" ||
      error.message.includes(
        "UNIQUE constraint failed"
      )
    ) {
      return res.status(409).json({
        message:
          "This employee has already checked in today.",
      });
    }

    res.status(500).json({
      message: "Could not record attendance",
    });
  }
});

// Get all attendance records
app.get("/api/attendance", (req, res) => {
  try {
    const attendance = db
      .prepare(`
        SELECT
          attendance.id,
          attendance.employee_id AS employeeId,
          employees.name,
          employees.section,
          attendance.date,
          attendance.clock_in_time AS clockInTime,
          attendance.status
        FROM attendance
        JOIN employees
          ON attendance.employee_id = employees.id
        ORDER BY attendance.id DESC
      `)
      .all();

    res.json(attendance);
  } catch (error) {
    console.error("Attendance loading error:", error);

    res.status(500).json({
      message: "Could not load attendance records",
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`SmartAttend backend running on port ${PORT}`);
});